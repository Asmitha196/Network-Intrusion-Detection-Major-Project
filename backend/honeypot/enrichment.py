"""
honeypot/enrichment.py — Honeypot Event Alert Enrichment & IP Correlation Engine.

Enriches ML security alerts with contextual evidence when an attacking source IP
has also interacted with local honeypot decoy servers within a configurable time window.

Does NOT alter Stage 1 / Stage 2 ML model predictions.
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from db.models import Alert, FlowRecord, HoneypotEvent

logger = logging.getLogger(__name__)


async def enrich_alert_with_honeypot(
    alert: Alert,
    session: AsyncSession,
    src_ip: str,
    time_window_minutes: int = 15,
) -> bool:
    """
    Check if `src_ip` has interacted with honeypot decoys within `time_window_minutes`.
    If matching honeypot events exist, enrich `alert.tags` and `alert.threat_intel`.
    """
    if not src_ip:
        return False

    try:
        cutoff = datetime.now(timezone.utc) - timedelta(minutes=time_window_minutes)
        stmt = (
            select(HoneypotEvent)
            .where(HoneypotEvent.src_ip == src_ip)
            .where(HoneypotEvent.timestamp >= cutoff)
            .order_by(desc(HoneypotEvent.timestamp))
        )
        res = await session.execute(stmt)
        events = res.scalars().all()

        if not events:
            return False

        # Prepare Tags
        tags = alert.tags or []
        if isinstance(tags, str):
            tags = [tags]
        tags = list(tags)

        if "honeypot_activity" not in tags:
            tags.append("honeypot_activity")

        # Check for High/Critical severity probes
        has_critical = any(ev.severity in ("HIGH", "CRITICAL") for ev in events)
        if has_critical and "high_suspicion" not in tags:
            tags.append("high_suspicion")

        alert.tags = tags

        # Enrich Threat Intel metadata
        threat_intel = alert.threat_intel or {}
        if not isinstance(threat_intel, dict):
            threat_intel = {"raw": threat_intel}

        event_types = list(set(ev.event_type for ev in events))
        severities = list(set(ev.severity for ev in events))
        latest_event = events[0]

        threat_intel["honeypot_evidence"] = {
            "correlated": True,
            "total_decoy_hits": len(events),
            "event_types": event_types,
            "severities": severities,
            "latest_interaction": latest_event.timestamp.isoformat(),
            "latest_service": latest_event.service,
            "latest_request": latest_event.request_type,
            "time_window_minutes": time_window_minutes,
        }

        alert.threat_intel = threat_intel
        logger.info(
            "Enriched Alert [%s] for IP %s with %d Honeypot events (types=%s)",
            alert.id, src_ip, len(events), event_types
        )
        return True

    except Exception as e:
        logger.warning("Failed to enrich alert %s with honeypot evidence: %s", alert.id, e)
        return False


async def correlate_ip_events(
    ip_address: str,
    session: AsyncSession,
    time_window_minutes: int = 60,
) -> Dict[str, Any]:
    """
    Correlate ML security alerts and Honeypot decoy events for a target source IP address.
    """
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=time_window_minutes)

    # 1. Fetch Alerts for IP
    alert_stmt = (
        select(Alert, FlowRecord)
        .outerjoin(FlowRecord, Alert.flow_id == FlowRecord.id)
        .where(FlowRecord.src_ip == ip_address)
        .where(Alert.timestamp >= cutoff)
        .order_by(desc(Alert.timestamp))
    )
    alert_res = await session.execute(alert_stmt)
    alert_rows = alert_res.all()

    alerts_list = [
        {
            "id": str(a.id),
            "timestamp": a.timestamp.isoformat(),
            "attack_type": a.attack_type,
            "severity": a.severity,
            "confidence": a.confidence,
            "tags": a.tags,
        }
        for a, _ in alert_rows
    ]

    # 2. Fetch Honeypot Events for IP
    hp_stmt = (
        select(HoneypotEvent)
        .where(HoneypotEvent.src_ip == ip_address)
        .where(HoneypotEvent.timestamp >= cutoff)
        .order_by(desc(HoneypotEvent.timestamp))
    )
    hp_res = await session.execute(hp_stmt)
    hp_events = hp_res.scalars().all()

    hp_list = [
        {
            "id": str(h.id),
            "timestamp": h.timestamp.isoformat(),
            "event_type": h.event_type,
            "severity": h.severity,
            "service": h.service,
            "request_type": h.request_type,
        }
        for h in hp_events
    ]

    suspicion_score = len(alerts_list) * 20 + len(hp_list) * 15
    suspicion_level = "CRITICAL" if suspicion_score >= 80 else "HIGH" if suspicion_score >= 40 else "MEDIUM" if suspicion_score >= 15 else "LOW"

    return {
        "ip_address": ip_address,
        "time_window_minutes": time_window_minutes,
        "total_alerts": len(alerts_list),
        "total_honeypot_hits": len(hp_list),
        "suspicion_score": min(100, suspicion_score),
        "suspicion_level": suspicion_level,
        "alerts": alerts_list,
        "honeypot_events": hp_list,
    }
