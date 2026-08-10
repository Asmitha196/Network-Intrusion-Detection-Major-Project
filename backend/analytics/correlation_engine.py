"""
analytics/correlation_engine.py — Alert Correlation & Incident Synthesis Engine.

Groups related NIDS alerts and Honeypot decoy events from a target source IP within a
sliding time window (e.g., 5 minutes) into higher-level Correlated Security Incidents.
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from sqlalchemy import select, desc, func
from sqlalchemy.ext.asyncio import AsyncSession

from db.models import Alert, CorrelatedIncident, FlowRecord, HoneypotEvent, IncidentAlertLink
from analytics.risk_engine import calculate_risk_score

logger = logging.getLogger(__name__)


async def correlate_alert(
    alert: Alert,
    src_ip: str,
    session: AsyncSession,
    time_window_minutes: int = 5,
    dst_ip: Optional[str] = None,
) -> CorrelatedIncident:
    """
    Correlate a newly generated NIDS alert into an active incident or spawn a new Correlated Security Incident.
    """
    if not src_ip:
        src_ip = "0.0.0.0"

    alert_time = alert.timestamp or datetime.now(timezone.utc)
    cutoff = alert_time - timedelta(minutes=time_window_minutes)

    # 1. Search for an existing active (NEW or INVESTIGATING) incident for src_ip within time window
    stmt = (
        select(CorrelatedIncident)
        .where(CorrelatedIncident.source_ip == src_ip)
        .where(CorrelatedIncident.status.in_(["NEW", "INVESTIGATING"]))
        .where(CorrelatedIncident.last_activity >= cutoff)
        .order_by(desc(CorrelatedIncident.last_activity))
    )
    res = await session.execute(stmt)
    incident = res.scalar_one_or_none()

    # 2. Count Honeypot interactions for src_ip
    hp_stmt = select(func.count(HoneypotEvent.id)).where(HoneypotEvent.src_ip == src_ip)
    hp_res = await session.execute(hp_stmt)
    hp_cnt = hp_res.scalar() or 0

    attack_type = alert.attack_type or "Anomaly"

    if incident:
        # Existing incident found -> Link alert & update metrics
        logger.info("Correlating Alert %s into existing Incident %s for IP %s", alert.id, incident.id, src_ip)
        
        # Link table entry
        link = IncidentAlertLink(incident_id=incident.id, alert_id=alert.id)
        session.add(link)

        # Update properties
        incident.last_activity = max(incident.last_activity, alert_time)
        incident.alert_count += 1
        
        types_list = list(incident.attack_types or [])
        if attack_type not in types_list:
            types_list.append(attack_type)
        incident.attack_types = types_list
        incident.honeypot_interactions = hp_cnt

        # Calculate updated risk score
        risk_calc = calculate_risk_score({
            "stage1_attack_detected": True,
            "stage2_zero_day_anomaly": alert.stage == 2,
            "severity": alert.severity,
            "repeated_alert_count": incident.alert_count,
            "distinct_attack_types_count": len(types_list),
            "honeypot_interactions_count": hp_cnt,
        })
        incident.risk_score = risk_calc["score"]
        
        return incident

    else:
        # Create a new Correlated Security Incident
        logger.info("Creating NEW Correlated Security Incident for IP %s", src_ip)

        risk_calc = calculate_risk_score({
            "stage1_attack_detected": alert.stage == 1,
            "stage2_zero_day_anomaly": alert.stage == 2,
            "severity": alert.severity,
            "repeated_alert_count": 1,
            "distinct_attack_types_count": 1,
            "honeypot_interactions_count": hp_cnt,
        })

        new_incident = CorrelatedIncident(
            title=f"Correlated Security Incident - {src_ip}",
            source_ip=src_ip,
            destination_ip=dst_ip,
            start_time=alert_time,
            last_activity=alert_time,
            alert_count=1,
            attack_types=[attack_type],
            honeypot_interactions=hp_cnt,
            risk_score=risk_calc["score"],
            status="NEW",
        )
        session.add(new_incident)
        await session.flush()

        # Link alert to new incident
        link = IncidentAlertLink(incident_id=new_incident.id, alert_id=alert.id)
        session.add(link)

        await _broadcast_incident_event(new_incident)
        return new_incident


async def _broadcast_incident_event(incident: CorrelatedIncident) -> None:
    """Broadcast correlated incident updates over alert_manager WebSocket clients."""
    try:
        from api.routers.ws import alert_manager
        incident_dict = {
            "id": str(incident.id),
            "title": incident.title,
            "source_ip": incident.source_ip,
            "destination_ip": incident.destination_ip,
            "start_time": incident.start_time.isoformat() if incident.start_time else "",
            "last_activity": incident.last_activity.isoformat() if incident.last_activity else "",
            "alert_count": incident.alert_count,
            "attack_types": list(incident.attack_types or []),
            "honeypot_interactions": incident.honeypot_interactions,
            "risk_score": incident.risk_score,
            "status": incident.status,
        }
        await alert_manager.broadcast({
            "type": "correlated_incident",
            "incident": incident_dict,
        })
    except Exception as e:
        logger.debug("WS alert_manager broadcast skipped for correlated_incident: %s", e)


async def update_incident_status(
    incident_id: str,
    new_status: str,
    session: AsyncSession,
) -> Optional[CorrelatedIncident]:
    """Update status of a Correlated Security Incident (NEW -> INVESTIGATING -> RESOLVED)."""
    valid_statuses = {"NEW", "INVESTIGATING", "RESOLVED"}
    status_upper = new_status.upper()
    if status_upper not in valid_statuses:
        raise ValueError(f"Invalid status '{new_status}'. Must be one of {valid_statuses}")

    try:
        inc_uuid = uuid.UUID(incident_id)
    except ValueError:
        return None

    stmt = select(CorrelatedIncident).where(CorrelatedIncident.id == inc_uuid)
    res = await session.execute(stmt)
    incident = res.scalar_one_or_none()
    if not incident:
        return None

    incident.status = status_upper
    await session.commit()
    await session.refresh(incident)
    await _broadcast_incident_event(incident)
    return incident
