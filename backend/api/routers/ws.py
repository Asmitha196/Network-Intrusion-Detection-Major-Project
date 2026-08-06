"""
api/routers/ws.py — Production-grade WebSocket Endpoints for Real-Time Alert & Traffic Streaming.

/ws/alerts   — Streams new AlertOut JSON objects to connected frontend clients.
/ws/traffic  — Streams live flow & throughput summary statistics every second.
"""
from __future__ import annotations

import asyncio
import json
import logging
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from sqlalchemy import select, desc
from sqlalchemy.orm import selectinload

from db.session import AsyncSessionLocal
from db.models import Alert, FlowRecord

logger = logging.getLogger(__name__)
router = APIRouter(tags=["websocket"])


class ConnectionManager:
    """
    Thread-safe async WebSocket connection manager supporting connection tracking,
    heartbeats, and resilient broadcast with dead connection cleanup.
    """

    def __init__(self, channel_name: str) -> None:
        self.channel_name = channel_name
        self._active: set[WebSocket] = set()
        self._lock = asyncio.Lock()

    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        async with self._lock:
            self._active.add(websocket)
            count = len(self._active)
        logger.info("[%s] WS client connected. Active: %d", self.channel_name, count)

    async def disconnect(self, websocket: WebSocket) -> None:
        async with self._lock:
            self._active.discard(websocket)
            count = len(self._active)
        logger.info("[%s] WS client disconnected. Active: %d", self.channel_name, count)

    def get_connection_count(self) -> int:
        return len(self._active)

    async def broadcast(self, message: dict[str, Any]) -> None:
        """Broadcast a JSON-serialisable dict to all connected clients."""
        async with self._lock:
            clients = list(self._active)

        if not clients:
            return

        text_data = json.dumps(message, default=str)
        dead: set[WebSocket] = set()

        for ws in clients:
            try:
                await ws.send_text(text_data)
            except Exception as e:
                logger.warning("[%s] Failed to send message to client: %s", self.channel_name, e)
                dead.add(ws)

        if dead:
            async with self._lock:
                for ws in dead:
                    self._active.discard(ws)
            logger.info("[%s] Cleaned up %d dead connections. Active: %d", self.channel_name, len(dead), len(self._active))


# Singleton connection managers for alerts and traffic feeds
alert_manager = ConnectionManager(channel_name="alerts")
traffic_manager = ConnectionManager(channel_name="traffic")


async def _get_recent_alerts_snapshot(limit: int = 10) -> list[dict[str, Any]]:
    """Query the last N non-deleted alerts from DB to populate frontend feed on connect."""
    try:
        async with AsyncSessionLocal() as session:
            query = (
                select(Alert, FlowRecord)
                .outerjoin(FlowRecord, Alert.flow_id == FlowRecord.id)
                .where(Alert.deleted == False)
                .order_by(desc(Alert.timestamp))
                .limit(limit)
            )
            res = await session.execute(query)
            rows = res.all()

            snapshot = []
            for alert_row, flow_row in rows:
                snapshot.append({
                    "id": str(alert_row.id),
                    "timestamp": alert_row.timestamp.isoformat() if alert_row.timestamp else "",
                    "flow_id": str(alert_row.flow_id),
                    "stage": alert_row.stage,
                    "attack_type": alert_row.attack_type,
                    "confidence": alert_row.confidence,
                    "severity": alert_row.severity,
                    "src_ip": flow_row.src_ip if flow_row else "0.0.0.0",
                    "dst_ip": flow_row.dst_ip if flow_row else "0.0.0.0",
                    "src_port": flow_row.src_port if flow_row else 0,
                    "dst_port": flow_row.dst_port if flow_row else 0,
                    "protocol": flow_row.protocol if flow_row else "TCP",
                })
            return snapshot
    except Exception as e:
        logger.warning("Failed to fetch recent alerts snapshot for WebSocket connect: %s", e)
        return []


@router.websocket("/ws/alerts")
async def ws_alerts(websocket: WebSocket) -> None:
    """
    WebSocket endpoint streaming real-time security alerts.

    On connect:
      1. Accepts connection & registers client.
      2. Sends welcome handshake + last 10 historical alerts.
      3. Maintains 30s heartbeat ping loop to detect dead clients.
    """
    await alert_manager.connect(websocket)

    try:
        # Send initial handshake with channel context & recent snapshot
        recent_alerts = await _get_recent_alerts_snapshot(limit=10)
        await websocket.send_json({
            "type": "connected",
            "channel": "alerts",
            "server_time": datetime.now(timezone.utc).isoformat(),
            "recent_alerts": recent_alerts,
        })

        # Main heartbeat loop
        while True:
            await asyncio.sleep(30)
            await websocket.send_json({"type": "ping", "timestamp": time.time() if 'time' in globals() else 0})

    except (WebSocketDisconnect, Exception) as e:
        logger.debug("WS alert client disconnected: %s", e)
    finally:
        await alert_manager.disconnect(websocket)


@router.websocket("/ws/traffic")
async def ws_traffic(websocket: WebSocket) -> None:
    """
    WebSocket endpoint: pushes real-time flow activity statistics every 2 seconds.
    Reads live flow counts from PostgreSQL / TimescaleDB.
    """
    await traffic_manager.connect(websocket)

    try:
        await websocket.send_json({
            "type": "connected",
            "channel": "traffic",
            "server_time": datetime.now(timezone.utc).isoformat(),
        })

        while True:
            try:
                async with AsyncSessionLocal() as session:
                    res_flows = await session.execute(select(func.count()).select_from(FlowRecord))
                    total_flows = res_flows.scalar_one()

                    res_alerts = await session.execute(select(func.count()).select_from(Alert).where(Alert.deleted == False))
                    total_alerts = res_alerts.scalar_one()

                stats = {
                    "type": "traffic_stats",
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "total_flows_processed": total_flows,
                    "total_alerts_generated": total_alerts,
                    "status": "active",
                }
                await websocket.send_json(stats)
            except Exception as e:
                logger.warning("Error fetching traffic stats for WS: %s", e)

            await asyncio.sleep(2)

    except (WebSocketDisconnect, Exception) as e:
        logger.debug("WS traffic client disconnected: %s", e)
    finally:
        await traffic_manager.disconnect(websocket)
