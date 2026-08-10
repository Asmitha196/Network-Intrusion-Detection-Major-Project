"""
api/routers/honeypot.py — Honeypot & Decoy Server API Endpoints.

Provides endpoints to query honeypot interaction events, retrieve statistics,
manually ingest decoy events, and start/stop the local decoy HTTP server safely.
"""
from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Query, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession

from api.dependencies import get_db
from db.models import HoneypotEvent
from honeypot.decoy_server import get_decoy_server

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/honeypot", tags=["honeypot"])


# Pydantic Schemas
class HoneypotEventIn(BaseModel):
    src_ip: str = Field(..., description="Source IP address")
    src_port: int = Field(..., ge=1, le=65535, description="Source port")
    dst_ip: str = Field(default="127.0.0.1", description="Destination IP address")
    dst_port: int = Field(default=8080, description="Destination port")
    protocol: str = Field(default="TCP", description="Network protocol")
    service: str = Field(default="http-decoy", description="Decoy service name")
    request_type: str = Field(..., description="Request payload or HTTP line")
    event_type: str = Field(
        default="SUSPICIOUS_REQUEST",
        description="Event classification: CONNECTION_ATTEMPT, HTTP_PROBE, SUSPICIOUS_REQUEST, REPEATED_REQUEST",
    )
    severity: str = Field(default="MEDIUM", description="Severity: LOW, MEDIUM, HIGH, CRITICAL")
    session_id: Optional[str] = Field(default=None)
    payload: Optional[Dict[str, Any]] = Field(default=None)


class HoneypotEventOut(BaseModel):
    id: str
    timestamp: datetime
    src_ip: str
    src_port: int
    dst_ip: str
    dst_port: int
    protocol: str
    service: str
    request_type: str
    event_type: str
    severity: str
    session_id: Optional[str] = None
    payload: Optional[Dict[str, Any]] = None

    class Config:
        from_attributes = True


@router.get("/status", summary="Get Honeypot / Decoy Server Status")
async def get_honeypot_status(db: AsyncSession = Depends(get_db)) -> Dict[str, Any]:
    """Return status of the local HTTP decoy server and total event count."""
    decoy = get_decoy_server()
    res = await db.execute(select(func.count(HoneypotEvent.id)))
    total_db_events = res.scalar() or 0

    return {
        "status": "running" if decoy.is_running() else "stopped",
        "host": decoy.host,
        "port": decoy.port,
        "service": decoy.service_name,
        "total_interactions_session": decoy.total_interactions,
        "total_events_database": total_db_events,
        "uptime_seconds": round(time_since(decoy.start_time), 2) if decoy.start_time else 0,
    }


def time_since(start: Optional[float]) -> float:
    import time
    return max(0.0, time.time() - start) if start else 0.0


@router.get("/events", response_model=List[HoneypotEventOut], summary="Query Honeypot Events")
async def get_honeypot_events(
    limit: int = Query(default=50, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    event_type: Optional[str] = Query(default=None),
    severity: Optional[str] = Query(default=None),
    src_ip: Optional[str] = Query(default=None),
    db: AsyncSession = Depends(get_db),
) -> List[HoneypotEventOut]:
    """Query recorded honeypot events with optional filtering."""
    stmt = select(HoneypotEvent).order_by(desc(HoneypotEvent.timestamp))

    if event_type:
        stmt = stmt.where(HoneypotEvent.event_type == event_type)
    if severity:
        stmt = stmt.where(HoneypotEvent.severity == severity)
    if src_ip:
        stmt = stmt.where(HoneypotEvent.src_ip == src_ip)

    stmt = stmt.offset(offset).limit(limit)
    res = await db.execute(stmt)
    events = res.scalars().all()

    return [
        HoneypotEventOut(
            id=str(ev.id),
            timestamp=ev.timestamp,
            src_ip=ev.src_ip,
            src_port=ev.src_port,
            dst_ip=ev.dst_ip,
            dst_port=ev.dst_port,
            protocol=ev.protocol,
            service=ev.service,
            request_type=ev.request_type,
            event_type=ev.event_type,
            severity=ev.severity,
            session_id=ev.session_id,
            payload=ev.payload,
        )
        for ev in events
    ]


@router.get("/stats", summary="Get Honeypot Statistics & Aggregations")
async def get_honeypot_stats(db: AsyncSession = Depends(get_db)) -> Dict[str, Any]:
    """Return aggregations by event_type, severity, and top attacking IPs."""
    # Count by event_type
    type_res = await db.execute(
        select(HoneypotEvent.event_type, func.count(HoneypotEvent.id)).group_by(HoneypotEvent.event_type)
    )
    by_event_type = dict(type_res.all())

    # Count by severity
    sev_res = await db.execute(
        select(HoneypotEvent.severity, func.count(HoneypotEvent.id)).group_by(HoneypotEvent.severity)
    )
    by_severity = dict(sev_res.all())

    # Top attacking IPs
    ip_res = await db.execute(
        select(HoneypotEvent.src_ip, func.count(HoneypotEvent.id))
        .group_by(HoneypotEvent.src_ip)
        .order_by(desc(func.count(HoneypotEvent.id)))
        .limit(10)
    )
    top_attackers = [{"ip": ip, "count": cnt} for ip, cnt in ip_res.all()]

    return {
        "by_event_type": by_event_type,
        "by_severity": by_severity,
        "top_attackers": top_attackers,
    }


@router.post("/events", status_code=status.HTTP_201_CREATED, summary="Ingest Honeypot Event")
async def ingest_honeypot_event(
    event_in: HoneypotEventIn, db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """Manually ingest or receive a honeypot interaction event."""
    event = HoneypotEvent(
        timestamp=datetime.now(timezone.utc),
        src_ip=event_in.src_ip,
        src_port=event_in.src_port,
        dst_ip=event_in.dst_ip,
        dst_port=event_in.dst_port,
        protocol=event_in.protocol,
        service=event_in.service,
        request_type=event_in.request_type,
        event_type=event_in.event_type,
        severity=event_in.severity,
        session_id=event_in.session_id,
        payload=event_in.payload,
    )
    db.add(event)
    await db.commit()
    await db.refresh(event)

    try:
        from api.routers.ws import alert_manager
        await alert_manager.broadcast({
            "type": "honeypot_event",
            "event": {
                "id": str(event.id),
                "timestamp": event.timestamp.isoformat(),
                "src_ip": event.src_ip,
                "src_port": event.src_port,
                "dst_ip": event.dst_ip,
                "dst_port": event.dst_port,
                "protocol": event.protocol,
                "service": event.service,
                "request_type": event.request_type,
                "event_type": event.event_type,
                "severity": event.severity,
            },
        })
    except Exception as wse:
        logger.debug("WS alert_manager broadcast skipped for ingested honeypot event: %s", wse)

    return {"id": str(event.id), "status": "recorded", "message": "Honeypot event ingested successfully"}


@router.post("/start", summary="Start Local Decoy Server")
async def start_decoy_server() -> Dict[str, Any]:
    """Safely start the local HTTP decoy server listener."""
    decoy = get_decoy_server()
    success = await decoy.start()
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to start Decoy HTTP server listener.",
        )
    return {"status": "started", "host": decoy.host, "port": decoy.port}


@router.post("/stop", summary="Stop Local Decoy Server")
async def stop_decoy_server() -> Dict[str, Any]:
    """Safely stop the local HTTP decoy server listener."""
    decoy = get_decoy_server()
    await decoy.stop()
    return {"status": "stopped"}


@router.get("/correlated-alerts", summary="List Alerts Enriched with Honeypot Evidence")
async def get_honeypot_correlated_alerts(
    limit: int = Query(default=50, ge=1, le=500),
    db: AsyncSession = Depends(get_db)
) -> List[Dict[str, Any]]:
    """Fetch NIDS security alerts that possess matching honeypot evidence tags."""
    from db.models import Alert, FlowRecord

    stmt = (
        select(Alert, FlowRecord)
        .outerjoin(FlowRecord, Alert.flow_id == FlowRecord.id)
        .where(Alert.deleted == False)
        .order_by(desc(Alert.timestamp))
        .limit(limit * 2)
    )
    res = await db.execute(stmt)
    rows = res.all()

    correlated = []
    for alert_row, flow_row in rows:
        tags = alert_row.tags or []
        if "honeypot_activity" in tags or (alert_row.threat_intel and "honeypot_evidence" in alert_row.threat_intel):
            correlated.append({
                "id": str(alert_row.id),
                "timestamp": alert_row.timestamp.isoformat(),
                "src_ip": flow_row.src_ip if flow_row else "0.0.0.0",
                "dst_ip": flow_row.dst_ip if flow_row else "0.0.0.0",
                "attack_type": alert_row.attack_type,
                "stage": alert_row.stage,
                "severity": alert_row.severity,
                "confidence": alert_row.confidence,
                "tags": alert_row.tags,
                "honeypot_evidence": alert_row.threat_intel.get("honeypot_evidence") if alert_row.threat_intel else None,
            })
            if len(correlated) >= limit:
                break

    return correlated


@router.get("/ip-correlation/{ip}", summary="Get Joint Alert & Honeypot Timeline for IP")
async def get_ip_correlation(
    ip: str,
    time_window_minutes: int = Query(default=60, ge=5, le=1440),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """Retrieve joint NIDS alerts and Honeypot interactions for a specific source IP."""
    from honeypot.enrichment import correlate_ip_events
    return await correlate_ip_events(ip_address=ip, session=db, time_window_minutes=time_window_minutes)

