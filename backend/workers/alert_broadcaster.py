"""
workers/alert_broadcaster.py — Pushes new alerts to WebSocket connection managers.

Called by flow_consumer.py after a new Alert is written to the database.
Imports the singleton ConnectionManager instances from api/routers/ws.py and
broadcasts the serialised alert to all connected WebSocket clients.

Multi-replica note:
  In a single-process deployment, this direct import works fine.
  For multi-replica (multiple API containers), replace with a Redis pub/sub
  publish:
      await redis_client.publish("ids:alerts:broadcast", json.dumps(alert_dict))
  Each API replica subscribes to that channel and calls alert_manager.broadcast()
  locally.  See the TODO in api/routers/ws.py for the subscriber side.
"""
from __future__ import annotations

import json
import logging
from typing import Any

logger = logging.getLogger(__name__)


async def broadcast_alert(alert: dict[str, Any]) -> None:
    """
    Broadcast a new alert to all connected WebSocket clients.

    Args:
        alert: Alert dict as returned by ml.pipeline.DetectionPipeline.run()
    """
    try:
        from api.routers.ws import alert_manager
        await alert_manager.broadcast(alert)
        logger.debug("broadcast_alert: successfully broadcast alert id=%s", alert.get("id"))
    except Exception as e:
        logger.error("broadcast_alert failed for alert id=%s: %s", alert.get("id"), e)

