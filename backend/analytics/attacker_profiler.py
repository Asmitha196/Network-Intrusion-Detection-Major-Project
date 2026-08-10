"""
analytics/attacker_profiler.py — Threat Actor Aggregation & Profiling Engine.

Aggregates existing PostgreSQL records across `alerts`, `flow_records`, `honeypot_events`,
and `threat_intel_cache` to build rich Attacker Profiles without duplicating data.
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
    Build a comprehensive Attacker Profile for `source_ip` from existing database records.
    """
    if not source_ip:
        return {"error": "Invalid source IP address"}

    # 1. Query Alerts & FlowRecords for source_ip
    alert_stmt = (
        select(Alert, FlowRecord)
        .outerjoin(FlowRecord, Alert.flow_id == FlowRecord.id)
        .where(FlowRecord.src_ip == source_ip)
        .where(Alert.deleted == False)
        .order_by(desc(Alert.timestamp))
    )
    alert_res = await session.execute(alert_stmt)
    alert_rows = alert_res.all()

    total_alerts = len(alert_rows)
    attack_types_set = set()
    port_scan_count = 0
    brute_force_count = 0
    critical_alerts = 0
    high_alerts = 0
    medium_alerts = 0
    low_alerts = 0

    alert_timestamps = []
    recent_alerts_list = []

    for alert, flow in alert_rows:
        alert_timestamps.append(alert.timestamp)
        if alert.attack_type:
            attack_types_set.add(alert.attack_type)
            at_lower = alert.attack_type.lower()
            if "portscan" in at_lower:
                port_scan_count += 1
            if "brute force" in at_lower or "patator" in at_lower:
                brute_force_count += 1

        sev_upper = (alert.severity or "LOW").upper()
        if sev_upper == "CRITICAL":
            critical_alerts += 1
        elif sev_upper == "HIGH":
            high_alerts += 1
        elif sev_upper == "MEDIUM":
            medium_alerts += 1
        else:
            low_alerts += 1

        if len(recent_alerts_list) < 15:
            recent_alerts_list.append({
                "id": str(alert.id),
                "timestamp": alert.timestamp.isoformat(),
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
    )
    hp_res = await session.execute(hp_stmt)
    hp_events = hp_res.scalars().all()

    honeypot_interactions = len(hp_events)
    hp_timestamps = [h.timestamp for h in hp_events]
    recent_hp_list = []

    for h in hp_events[:15]:
        recent_hp_list.append({
            "id": str(h.id),
            "timestamp": h.timestamp.isoformat(),
            "type": "HONEYPOT",
            "event_type": h.event_type,
            "severity": h.severity,
            "service": h.service,
            "request_type": h.request_type,
            "dst_ip": h.dst_ip,
            "dst_port": h.dst_port,
        })

    # Combine timestamps to find first_seen and last_seen
    all_timestamps = alert_timestamps + hp_timestamps
    first_seen = min(all_timestamps).isoformat() if all_timestamps else datetime.now(timezone.utc).isoformat()
    last_seen = max(all_timestamps).isoformat() if all_timestamps else datetime.now(timezone.utc).isoformat()

    # Combine recent activity into a single chronological timeline
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

    # 4. Calculate Risk Score using NIDS Risk Engine
    from analytics.risk_engine import calculate_risk_score
    highest_severity = "CRITICAL" if critical_alerts > 0 else "HIGH" if high_alerts > 0 else "MEDIUM" if medium_alerts > 0 else "LOW"
    risk_calc = calculate_risk_score({
        "stage1_attack_detected": total_alerts > 0,
        "stage2_zero_day_anomaly": any(a.stage == 2 for a, _ in alert_rows),
        "severity": highest_severity,
        "repeated_alert_count": total_alerts,
        "distinct_attack_types_count": len(attack_types_set),
        "honeypot_interactions_count": honeypot_interactions,
        "is_known_malicious_ip": is_malicious,
    })

    risk_score = risk_calc["score"]
    risk_level = risk_calc["level"]

    # Broadcast risk score update over WebSocket
    await _broadcast_risk_update(source_ip, risk_score, risk_level)

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
        "attack_types": list(attack_types_set),
        "port_scan_count": port_scan_count,
        "brute_force_count": brute_force_count,
        "honeypot_interactions": honeypot_interactions,
        "critical_alerts": critical_alerts,
        "high_alerts": high_alerts,
        "medium_alerts": medium_alerts,
        "low_alerts": low_alerts,
        "risk_score": risk_score,
        "risk_level": risk_level,
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


async def get_top_attacker_summaries(session: AsyncSession, limit: int = 50) -> List[Dict[str, Any]]:
    """
    Retrieve top suspicious source IPs ranked by alert activity and honeypot hits.
    """
    # 1. Fetch IP counts from Alerts
    alert_ips_stmt = (
        select(FlowRecord.src_ip, func.count(Alert.id).label("alert_cnt"))
        .join(Alert, Alert.flow_id == FlowRecord.id)
        .where(Alert.deleted == False)
        .group_by(FlowRecord.src_ip)
        .order_by(desc("alert_cnt"))
        .limit(limit)
    )
    alert_ips_res = await session.execute(alert_ips_stmt)
    alert_ip_rows = alert_ips_res.all()

    # 2. Fetch IP counts from Honeypot
    hp_ips_stmt = (
        select(HoneypotEvent.src_ip, func.count(HoneypotEvent.id).label("hp_cnt"))
        .group_by(HoneypotEvent.src_ip)
        .order_by(desc("hp_cnt"))
        .limit(limit)
    )
    hp_ips_res = await session.execute(hp_ips_stmt)
    hp_ip_rows = hp_ips_res.all()

    # Combine unique IPs
    unique_ips = set([ip for ip, _ in alert_ip_rows] + [ip for ip, _ in hp_ip_rows])

    profiles = []
    for ip in unique_ips:
        profile = await build_attacker_profile(ip, session)
        profiles.append(profile)

    # Sort profiles by risk_score descending, then total_alerts descending
    profiles.sort(key=lambda p: (p["risk_score"], p["total_alerts"], p["honeypot_interactions"]), reverse=True)
    return profiles[:limit]
