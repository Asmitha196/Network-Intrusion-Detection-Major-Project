"""
analytics/attacker_profiler.py — Threat Actor Aggregation & Profiling Engine.

Aggregates existing PostgreSQL records across `alerts`, `flow_records`, `honeypot_events`,
and `threat_intel_cache` to build rich Attacker Profiles with sub-second performance.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from sqlalchemy import select, func, desc, or_
from sqlalchemy.ext.asyncio import AsyncSession

from db.models import Alert, FlowRecord, HoneypotEvent, ThreatIntelCache

logger = logging.getLogger(__name__)


async def build_attacker_profile(source_ip: str, session: AsyncSession) -> Dict[str, Any]:
    """
    Build a comprehensive Attacker Profile for `source_ip` using fast SQL aggregation.
    """
    if not source_ip:
        return {"error": "Invalid source IP address"}

    # 1. Fast SQL aggregation for Alert stats
    stats_stmt = (
        select(
            func.count(Alert.id).label("total_alerts"),
            func.min(Alert.timestamp).label("first_seen"),
            func.max(Alert.timestamp).label("last_seen"),
            func.count(Alert.id).filter(func.upper(Alert.severity) == "CRITICAL").label("critical_alerts"),
            func.count(Alert.id).filter(func.upper(Alert.severity) == "HIGH").label("high_alerts"),
            func.count(Alert.id).filter(func.upper(Alert.severity) == "MEDIUM").label("medium_alerts"),
            func.count(Alert.id).filter(func.upper(Alert.severity) == "LOW").label("low_alerts"),
            func.count(Alert.id).filter(Alert.stage == 2).label("stage2_anomalies"),
        )
        .join(FlowRecord, Alert.flow_id == FlowRecord.id)
        .where(FlowRecord.src_ip == source_ip, Alert.deleted == False)
    )
    stats_res = await session.execute(stats_stmt)
    stats_row = stats_res.one()

    total_alerts = stats_row.total_alerts or 0
    first_seen_dt = stats_row.first_seen
    last_seen_dt = stats_row.last_seen
    critical_alerts = stats_row.critical_alerts or 0
    high_alerts = stats_row.high_alerts or 0
    medium_alerts = stats_row.medium_alerts or 0
    low_alerts = stats_row.low_alerts or 0
    stage2_anomalies = stats_row.stage2_anomalies or 0

    # Distinct attack types & counts
    at_stmt = (
        select(Alert.attack_type, func.count(Alert.id))
        .join(FlowRecord, Alert.flow_id == FlowRecord.id)
        .where(FlowRecord.src_ip == source_ip, Alert.deleted == False, Alert.attack_type != None)
        .group_by(Alert.attack_type)
        .limit(20)
    )
    at_res = await session.execute(at_stmt)
    at_rows = at_res.all()

    attack_types_set = [row[0] for row in at_rows if row[0]]
    port_scan_count = sum(cnt for at, cnt in at_rows if at and "portscan" in at.lower())
    brute_force_count = sum(cnt for at, cnt in at_rows if at and ("brute force" in at.lower() or "patator" in at.lower()))

    # Recent 15 alerts for timeline
    recent_alerts_stmt = (
        select(Alert, FlowRecord)
        .outerjoin(FlowRecord, Alert.flow_id == FlowRecord.id)
        .where(FlowRecord.src_ip == source_ip, Alert.deleted == False)
        .order_by(desc(Alert.timestamp))
        .limit(15)
    )
    recent_res = await session.execute(recent_alerts_stmt)
    recent_rows = recent_res.all()

    recent_alerts_list = []
    for alert, flow in recent_rows:
        recent_alerts_list.append({
            "id": str(alert.id),
            "timestamp": alert.timestamp.isoformat() if alert.timestamp else datetime.now(timezone.utc).isoformat(),
            "type": "ALERT",
            "attack_type": alert.attack_type or "Anomaly",
            "severity": alert.severity,
            "confidence": alert.confidence,
            "dst_ip": flow.dst_ip if flow else "0.0.0.0",
            "dst_port": flow.dst_port if flow else 0,
            "tags": alert.tags or [],
        })

    # 2. Query Honeypot Events for source_ip
    hp_stmt = (
        select(HoneypotEvent)
        .where(HoneypotEvent.src_ip == source_ip)
        .order_by(desc(HoneypotEvent.timestamp))
        .limit(15)
    )
    hp_res = await session.execute(hp_stmt)
    hp_events = hp_res.scalars().all()

    hp_count_stmt = select(func.count(HoneypotEvent.id)).where(HoneypotEvent.src_ip == source_ip)
    hp_count_res = await session.execute(hp_count_stmt)
    honeypot_interactions = hp_count_res.scalar_one() or 0

    recent_hp_list = []
    for h in hp_events:
        recent_hp_list.append({
            "id": str(h.id),
            "timestamp": h.timestamp.isoformat() if h.timestamp else datetime.now(timezone.utc).isoformat(),
            "type": "HONEYPOT",
            "event_type": h.event_type,
            "severity": h.severity,
            "service": h.service,
            "request_type": h.request_type,
            "dst_ip": h.dst_ip,
            "dst_port": h.dst_port,
        })

    # Combine timestamps to find first_seen and last_seen
    all_dates = [d for d in [first_seen_dt, last_seen_dt] if d]
    for h in hp_events:
        if h.timestamp:
            all_dates.append(h.timestamp)

    now_iso = datetime.now(timezone.utc).isoformat()
    first_seen = min(all_dates).isoformat() if all_dates else now_iso
    last_seen = max(all_dates).isoformat() if all_dates else now_iso

    recent_activity = sorted(
        recent_alerts_list + recent_hp_list,
        key=lambda x: x["timestamp"],
        reverse=True
    )[:20]

    # 3. Fetch Threat Intelligence Cache
    ti_stmt = select(ThreatIntelCache).where(ThreatIntelCache.ip_address == source_ip)
    ti_res = await session.execute(ti_stmt)
    ti_record = ti_res.scalar_one_or_none()

    is_malicious = False
    if ti_record and isinstance(ti_record.data, dict):
        is_malicious = bool(ti_record.data.get("is_malicious") or ti_record.data.get("known_malicious"))

    # 4. Calculate Risk Score
    from analytics.risk_engine import calculate_risk_score
    highest_severity = "CRITICAL" if critical_alerts > 0 else "HIGH" if high_alerts > 0 else "MEDIUM" if medium_alerts > 0 else "LOW"
    risk_calc = calculate_risk_score({
        "stage1_attack_detected": total_alerts > 0,
        "stage2_zero_day_anomaly": stage2_anomalies > 0,
        "severity": highest_severity,
        "repeated_alert_count": total_alerts,
        "distinct_attack_types_count": len(attack_types_set),
        "honeypot_interactions_count": honeypot_interactions,
        "is_known_malicious_ip": is_malicious,
    })

    risk_score = risk_calc["score"]
    risk_level = risk_calc["level"]

    threat_intel = ti_record.data if ti_record else {
        "ip": source_ip,
        "country": "Unknown",
        "country_code": "XX",
        "isp": "Local / Private Network",
        "reputation_score": risk_score,
        "is_malicious": risk_score >= 60,
    }

    return {
        "source_ip": source_ip,
        "first_seen": first_seen,
        "last_seen": last_seen,
        "total_alerts": total_alerts,
        "attack_types": attack_types_set,
        "port_scan_count": port_scan_count,
        "brute_force_count": brute_force_count,
        "honeypot_interactions": honeypot_interactions,
        "critical_alerts": critical_alerts,
        "high_alerts": high_alerts,
        "medium_alerts": medium_alerts,
        "low_alerts": low_alerts,
        "risk_score": risk_score,
        "risk_level": risk_level,
        "risk_breakdown": risk_calc.get("breakdown", {}),
        "threat_intelligence": threat_intel,
        "recent_activity": recent_activity,
    }


async def _broadcast_risk_update(source_ip: str, risk_score: int, risk_level: str) -> None:
    """Broadcast threat actor risk score updates over alert_manager WebSocket clients."""
    try:
        from api.routers.ws import alert_manager
        await alert_manager.broadcast({
            "type": "risk_score_update",
            "source_ip": source_ip,
            "risk_score": risk_score,
            "risk_level": risk_level,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })
    except Exception as e:
        logger.debug("WS alert_manager broadcast skipped for risk_score_update: %s", e)


async def get_top_attacker_summaries(session: AsyncSession, limit: int = 25) -> List[Dict[str, Any]]:
    """
    Retrieve top suspicious source IPs ranked by activity and honeypot hits.
    """
    # 1. Fetch top active source IPs from flow_records
    flow_ips_stmt = (
        select(FlowRecord.src_ip, func.count(FlowRecord.id).label("flow_cnt"))
        .where(FlowRecord.src_ip != None, FlowRecord.src_ip != "0.0.0.0", FlowRecord.src_ip != "127.0.0.1")
        .group_by(FlowRecord.src_ip)
        .order_by(desc("flow_cnt"))
        .limit(limit)
    )
    flow_ips_res = await session.execute(flow_ips_stmt)
    flow_ip_rows = flow_ips_res.all()

    # 2. Fetch IP counts from Honeypot
    hp_ips_stmt = (
        select(HoneypotEvent.src_ip, func.count(HoneypotEvent.id).label("hp_cnt"))
        .where(HoneypotEvent.src_ip != None, HoneypotEvent.src_ip != "0.0.0.0")
        .group_by(HoneypotEvent.src_ip)
        .order_by(desc("hp_cnt"))
        .limit(limit)
    )
    hp_ips_res = await session.execute(hp_ips_stmt)
    hp_ip_rows = hp_ips_res.all()

    # Combine unique IPs prioritizing honeypot attackers and top flow IPs
    unique_ips = []
    seen = set()
    for ip, _ in hp_ip_rows:
        if ip and ip not in seen:
            seen.add(ip)
            unique_ips.append(ip)
    for ip, _ in flow_ip_rows:
        if ip and ip not in seen:
            seen.add(ip)
            unique_ips.append(ip)

    profiles = []
    for ip in unique_ips[:limit]:
        profile = await build_attacker_profile(ip, session)
        profiles.append(profile)

    # Sort profiles by risk_score descending, then total_alerts descending
    profiles.sort(key=lambda p: (p.get("risk_score", 0), p.get("total_alerts", 0), p.get("honeypot_interactions", 0)), reverse=True)
    return profiles[:limit]
