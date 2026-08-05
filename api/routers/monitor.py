"""
api/routers/monitor.py — REST Endpoints for Live Network Capture & Monitoring.

GET  /interfaces         — Enumerate available system network interfaces.
GET  /monitor/interfaces — Alias for /interfaces.
POST /monitor/start      — Start live network packet capture on selected interface.
POST /monitor/stop       — Stop active live network monitoring session.
GET  /monitor/status     — Get real-time live capture engine status and telemetry.
"""
from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from db.session import get_db
from db.models import Alert
from ingestion.capture import LiveCaptureEngine, enumerate_interfaces

logger = logging.getLogger(__name__)

router = APIRouter(tags=["monitor"])


class StartMonitorRequest(BaseModel):
    interface: str = Field(..., description="Name of the network interface to capture traffic from (e.g. 'Wi-Fi', 'eth0')")


@router.get("/interfaces", summary="Enumerate system network interfaces")
@router.get("/monitor/interfaces", summary="Enumerate system network interfaces (alias)")
async def get_network_interfaces() -> List[Dict[str, Any]]:
    """
    Automatically enumerate all available network interfaces (Wi-Fi, Ethernet, VPN, Loopback, etc.)
    with MAC addresses, IP addresses, up/down status, and speed.
    """
    try:
        return enumerate_interfaces()
    except Exception as e:
        logger.error("Failed to enumerate network interfaces: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to enumerate interfaces: {e}",
        )


@router.post("/monitor/start", summary="Start live network monitoring")
async def start_live_monitoring(body: StartMonitorRequest) -> Dict[str, Any]:
    """
    Start continuous live packet capture on the specified interface.
    Only ONE monitoring session can run at a time.
    """
    engine = LiveCaptureEngine()
    if engine.active:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Monitoring session already active on interface '{engine.interface}'. Stop it first.",
        )

    res = engine.start(interface_name=body.interface)
    if res.get("status") == "error":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=res.get("message", "Failed to start monitoring"),
        )
    return res


@router.post("/monitor/stop", summary="Stop live network monitoring")
async def stop_live_monitoring() -> Dict[str, Any]:
    """
    Stop the currently active live network monitoring session.
    """
    engine = LiveCaptureEngine()
    if not engine.active:
        return {"status": "stopped", "message": "No monitoring session is currently active."}
    return engine.stop()


@router.get("/monitor/status", summary="Get live monitoring telemetry & status")
async def get_monitoring_status(session: AsyncSession = Depends(get_db)) -> Dict[str, Any]:
    """
    Return current live capture status, telemetry rates (packets/s, flows/s, bandwidth),
    and counts of detected Stage 1 (known) and Stage 2 (unknown) attacks.
    """
    engine = LiveCaptureEngine()
    engine_status = engine.get_status()

    known_attacks_count = 0
    unknown_attacks_count = 0
    latest_alerts = []

    try:
        stmt_known = select(func.count(Alert.id)).where(
            Alert.deleted == False,
            Alert.stage == 1,
            Alert.attack_type != None,
            Alert.attack_type != "BENIGN",
        )
        res_known = await session.execute(stmt_known)
        known_attacks_count = res_known.scalar_one() or 0

        stmt_unknown = select(func.count(Alert.id)).where(
            Alert.deleted == False,
            Alert.stage == 2,
        )
        res_unknown = await session.execute(stmt_unknown)
        unknown_attacks_count = res_unknown.scalar_one() or 0

        stmt_alerts = (
            select(Alert)
            .where(Alert.deleted == False, Alert.attack_type != "BENIGN")
            .order_by(Alert.timestamp.desc())
            .limit(5)
        )
        res_alerts = await session.execute(stmt_alerts)
        alerts_rows = res_alerts.scalars().all()

        for a in alerts_rows:
            latest_alerts.append({
                "id": str(a.id),
                "timestamp": a.timestamp.isoformat(),
                "stage": a.stage,
                "attack_type": a.attack_type or "Unknown Anomaly",
                "severity": a.severity,
                "confidence": round(a.confidence, 4),
            })

    except Exception as e:
        logger.warning("Could not fetch DB attack counts for monitor status: %s", e)

    return {
        **engine_status,
        "known_attacks_detected": known_attacks_count,
        "unknown_attacks_detected": unknown_attacks_count,
        "latest_live_alerts": latest_alerts,
    }
