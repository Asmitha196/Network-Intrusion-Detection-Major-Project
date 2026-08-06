"""
api/routers/health.py — Comprehensive System Health & Readiness Status Endpoints.

GET  /health       — Full application liveness, DB, Redis, ML models, Worker, WS, and Uptime status.
GET  /health/ready — Kubernetes/Docker readiness probe (returns DB + Redis boolean readiness).
"""

from __future__ import annotations

import logging
import os
import time
import traceback
from typing import Any

import redis.asyncio as aioredis
from fastapi import APIRouter, Request
from sqlalchemy import text

from db.session import AsyncSessionLocal
from api.dependencies import get_redis_pool
from api.routers.ws import alert_manager, traffic_manager

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/health", tags=["health"])

APP_VERSION = "0.1.0"


def _check_ml_models() -> dict[str, bool]:
    """Verify that Stage 1 classifier and Stage 2 autoencoder model artifacts exist."""
    artifacts_dir = os.getenv("MODEL_ARTIFACTS_DIR", "ml/artifacts")

    classifier_loaded = (
        os.path.exists(os.path.join(artifacts_dir, "classifier.joblib"))
        or os.path.exists(os.path.join(artifacts_dir, "classifier.pkl"))
    )

    autoencoder_loaded = (
        os.path.exists(os.path.join(artifacts_dir, "autoencoder.pt"))
        or os.path.exists(os.path.join(artifacts_dir, "autoencoder.keras"))
    )

    return {
        "classifier": classifier_loaded,
        "autoencoder": autoencoder_loaded,
    }


@router.get("", summary="Comprehensive system health & status")
async def health(request: Request) -> dict[str, Any]:
    """
    Returns:
      - API status
      - PostgreSQL status (bool)
      - Redis status (bool)
      - ML model availability
      - Worker heartbeat ("running" | "stopped")
      - Active websocket connections
      - Uptime seconds
    """
    db_ok = False
    redis_ok = False
    worker_running = False

    # 1. PostgreSQL Health Check
    try:
        async with AsyncSessionLocal() as session:
            await session.execute(text("SELECT 1"))
            db_ok = True
    except Exception as e:
        logger.warning("PostgreSQL health check failed: %s", e)
        db_ok = False

    # 2. Redis Health Check
    try:
        redis_client = get_redis_pool()
        await redis_client.ping()
        redis_ok = True

        heartbeat = await redis_client.get("ids:worker:heartbeat")
        if heartbeat:
            try:
                heartbeat_time = float(heartbeat)
                if time.time() - heartbeat_time < 30:
                    worker_running = True
            except Exception:
                worker_running = True
        else:
            try:
                groups = await redis_client.xinfo_groups("ids:flows")
                if groups:
                    worker_running = True
            except Exception:
                pass
    except Exception as e:
        logger.warning("Redis health check failed: %s", e)
        redis_ok = False

    models_status = _check_ml_models()

    active_ws = (
        alert_manager.get_connection_count()
        + traffic_manager.get_connection_count()
    )

    start_time = getattr(request.app.state, "start_time", time.time())
    uptime_seconds = round(time.time() - start_time, 2)

    overall_ok = (
        db_ok
        and redis_ok
        and models_status["classifier"]
        and models_status["autoencoder"]
    )

    return {
        "status": "ok" if overall_ok else "degraded",
        "version": APP_VERSION,
        "postgres": db_ok,
        "redis": redis_ok,
        "ml_models_loaded": models_status,
        "worker_status": "running" if worker_running else "stopped",
        "active_ws_connections": active_ws,
        "uptime_seconds": uptime_seconds,
    }


@router.get("/ready", summary="Readiness probe")
async def ready() -> dict[str, Any]:
    """Readiness probe."""
    db_ok = False
    redis_ok = False

    try:
        async with AsyncSessionLocal() as session:
            await session.execute(text("SELECT 1"))
            db_ok = True
    except Exception:
        db_ok = False

    try:
        redis_client = get_redis_pool()
        await redis_client.ping()
        redis_ok = True
    except Exception:
        redis_ok = False

    return {
        "db": db_ok,
        "redis": redis_ok,
        "ready": db_ok and redis_ok,
    }