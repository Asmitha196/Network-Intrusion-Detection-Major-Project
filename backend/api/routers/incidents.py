"""
api/routers/incidents.py — Correlated Security Incidents API Endpoints.

Provides REST endpoints to query, inspect, and update statuses of Correlated Security Incidents.
"""
from __future__ import annotations

import logging
import uuid
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from api.dependencies import get_db
from db.models import Alert, CorrelatedIncident, FlowRecord, HoneypotEvent, IncidentAlertLink
from analytics.correlation_engine import update_incident_status

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/incidents", tags=["correlated-incidents"])


class StatusUpdateIn(BaseModel):
    status: str = Field(..., description="Target status: NEW, INVESTIGATING, or RESOLVED")


@router.get("", summary="List Correlated Security Incidents")
async def list_incidents(
    status_filter: Optional[str] = Query(None, alias="status", description="Filter by status (NEW, INVESTIGATING, RESOLVED)"),
    source_ip: Optional[str] = Query(None, description="Filter by Source IP"),
    limit: int = Query(default=50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
) -> List[Dict[str, Any]]:
    """Retrieve list of Correlated Security Incidents with optional filtering."""
    stmt = select(CorrelatedIncident).order_by(desc(CorrelatedIncident.last_activity))

    if status_filter:
        stmt = stmt.where(CorrelatedIncident.status == status_filter.upper())
    if source_ip:
        stmt = stmt.where(CorrelatedIncident.source_ip == source_ip)

    stmt = stmt.limit(limit)
    res = await db.execute(stmt)
    incidents = res.scalars().all()

    return [
        {
            "id": str(inc.id),
            "title": inc.title,
            "source_ip": inc.source_ip,
            "destination_ip": inc.destination_ip,
            "start_time": inc.start_time.isoformat(),
            "last_activity": inc.last_activity.isoformat(),
            "alert_count": inc.alert_count,
            "attack_types": inc.attack_types or [],
            "honeypot_interactions": inc.honeypot_interactions,
            "risk_score": inc.risk_score,
            "status": inc.status,
            "created_at": inc.created_at.isoformat() if inc.created_at else None,
        }
        for inc in incidents
    ]


@router.get("/{incident_id}", summary="Get Correlated Incident Details")
async def get_incident_by_id(
    incident_id: str,
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    """Retrieve deep-dive incident detail including linked Alert records and Honeypot events."""
    try:
        inc_uuid = uuid.UUID(incident_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid incident UUID format")

    stmt = select(CorrelatedIncident).where(CorrelatedIncident.id == inc_uuid)
    res = await db.execute(stmt)
    inc = res.scalar_one_or_none()
    if not inc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Incident not found")

    # Fetch Linked Alerts via IncidentAlertLink
    links_stmt = (
        select(Alert, FlowRecord)
        .join(IncidentAlertLink, IncidentAlertLink.alert_id == Alert.id)
        .outerjoin(FlowRecord, Alert.flow_id == FlowRecord.id)
        .where(IncidentAlertLink.incident_id == inc_uuid)
        .order_by(desc(Alert.timestamp))
    )
    links_res = await db.execute(links_stmt)
    linked_alerts = [
        {
            "id": str(alert.id),
            "timestamp": alert.timestamp.isoformat(),
            "stage": alert.stage,
            "attack_type": alert.attack_type,
            "severity": alert.severity,
            "confidence": alert.confidence,
            "src_ip": flow.src_ip if flow else "0.0.0.0",
            "dst_ip": flow.dst_ip if flow else "0.0.0.0",
            "tags": alert.tags or [],
        }
        for alert, flow in links_res.all()
    ]

    # Fetch Honeypot interactions for source_ip
    hp_stmt = (
        select(HoneypotEvent)
        .where(HoneypotEvent.src_ip == inc.source_ip)
        .order_by(desc(HoneypotEvent.timestamp))
        .limit(20)
    )
    hp_res = await db.execute(hp_stmt)
    hp_events = [
        {
            "id": str(h.id),
            "timestamp": h.timestamp.isoformat(),
            "event_type": h.event_type,
            "severity": h.severity,
            "service": h.service,
            "request_type": h.request_type,
        }
        for h in hp_res.scalars().all()
    ]

    return {
        "id": str(inc.id),
        "title": inc.title,
        "source_ip": inc.source_ip,
        "destination_ip": inc.destination_ip,
        "start_time": inc.start_time.isoformat(),
        "last_activity": inc.last_activity.isoformat(),
        "alert_count": inc.alert_count,
        "attack_types": inc.attack_types or [],
        "honeypot_interactions": inc.honeypot_interactions,
        "risk_score": inc.risk_score,
        "status": inc.status,
        "created_at": inc.created_at.isoformat() if inc.created_at else None,
        "linked_alerts": linked_alerts,
        "honeypot_events": hp_events,
    }


@router.patch("/{incident_id}/status", summary="Update Incident Status")
async def update_status(
    incident_id: str,
    payload: StatusUpdateIn,
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    """Update incident status (NEW, INVESTIGATING, RESOLVED)."""
    try:
        updated = await update_incident_status(incident_id, payload.status, db)
        if not updated:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Incident not found")
        return {"id": str(updated.id), "status": updated.status, "message": f"Incident status updated to {updated.status}"}
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
