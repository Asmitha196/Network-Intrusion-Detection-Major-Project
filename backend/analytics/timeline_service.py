"""
analytics/timeline_service.py — Attacker Behavior Timeline Synthesis Engine.

Aggregates and synthesizes event streams across ML Alerts, Flow Records, Honeypot Decoy Hits,
and Correlated Incidents into a chronological behavior timeline for a given source IP.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Dict, List

from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from db.models import Alert, CorrelatedIncident, FlowRecord, HoneypotEvent

logger = logging.getLogger(__name__)


async def build_attacker_timeline(
    source_ip: str,
    session: AsyncSession,
    limit: int = 100,
) -> List[Dict[str, Any]]:
    """
    Build a unified, chronological Attacker Behavior Timeline for `source_ip`.
    """
    if not source_ip:
        return []

    timeline_items = []

    # 1. Query ML Alerts & Flow Records
    alert_stmt = (
        select(Alert, FlowRecord)
        .outerjoin(FlowRecord, Alert.flow_id == FlowRecord.id)
        .where(FlowRecord.src_ip == source_ip)
        .where(Alert.deleted == False)
        .order_by(desc(Alert.timestamp))
        .limit(limit)
    )
    alert_res = await session.execute(alert_stmt)
    for alert, flow in alert_res.all():
        timeline_items.append({
            "id": f"alert-{alert.id}",
            "timestamp": alert.timestamp.isoformat(),
            "type": "ALERT",
            "title": f"{alert.attack_type or 'Anomaly'} Detected (Stage {alert.stage})",
            "severity": (alert.severity or "LOW").upper(),
            "details": {
                "alert_id": str(alert.id),
                "attack_type": alert.attack_type or "Anomaly",
                "stage": alert.stage,
                "confidence": alert.confidence,
                "dst_ip": flow.dst_ip if flow else "0.0.0.0",
                "dst_port": flow.dst_port if flow else 0,
                "protocol": flow.protocol if flow else "TCP",
                "tags": alert.tags or [],
            },
        })

    # 2. Query Honeypot Events
    hp_stmt = (
        select(HoneypotEvent)
        .where(HoneypotEvent.src_ip == source_ip)
        .order_by(desc(HoneypotEvent.timestamp))
        .limit(limit)
    )
    hp_res = await session.execute(hp_stmt)
    for hp in hp_res.scalars().all():
        timeline_items.append({
            "id": f"hp-{hp.id}",
            "timestamp": hp.timestamp.isoformat(),
            "type": "HONEYPOT",
            "title": f"Honeypot Decoy Interaction ({hp.event_type})",
            "severity": (hp.severity or "LOW").upper(),
            "details": {
                "event_id": str(hp.id),
                "event_type": hp.event_type,
                "service": hp.service,
                "request_type": hp.request_type,
                "dst_ip": hp.dst_ip,
                "dst_port": hp.dst_port,
                "protocol": hp.protocol,
            },
        })

    # 3. Query Correlated Incidents
    inc_stmt = (
        select(CorrelatedIncident)
        .where(CorrelatedIncident.source_ip == source_ip)
        .order_by(desc(CorrelatedIncident.start_time))
        .limit(limit)
    )
    inc_res = await session.execute(inc_stmt)
    for inc in inc_res.scalars().all():
        sev = "CRITICAL" if inc.risk_score >= 80 else "HIGH" if inc.risk_score >= 50 else "MEDIUM"
        timeline_items.append({
            "id": f"inc-{inc.id}",
            "timestamp": inc.start_time.isoformat(),
            "type": "INCIDENT",
            "title": f"Correlated Security Incident Synthesized ({inc.status})",
            "severity": sev,
            "details": {
                "incident_id": str(inc.id),
                "title": inc.title,
                "status": inc.status,
                "alert_count": inc.alert_count,
                "attack_types": inc.attack_types or [],
                "risk_score": inc.risk_score,
                "honeypot_interactions": inc.honeypot_interactions,
            },
        })

    # Sort all events descending by timestamp
    timeline_items.sort(key=lambda x: x["timestamp"], reverse=True)
    return timeline_items[:limit]
