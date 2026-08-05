"""
api/main.py — FastAPI application factory.

Creates and configures the FastAPI app with:
  - Lifespan context: initialises DB schema via db.init_db.init_db, connection pool, Redis pool, and app state on startup.
  - Custom Middlewares: Request ID, Security Headers, CORS.
  - Router registration: mounts health, ingestion, prediction, alerts, metrics, analytics, threat intel, and ws routers.

OpenAPI docs: http://localhost:8000/docs
ReDoc:        http://localhost:8000/redoc
"""
from __future__ import annotations

import logging
import os
import sys
import time

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware

from api.dependencies import get_redis_pool, get_redis_url
from api.middleware import RequestIDMiddleware, SecurityHeadersMiddleware
from api.routers import (
    alerts,
    analytics,
    auth,
    evaluation,
    health,
    incident_response,
    ingestion,
    metrics,
    monitor,
    prediction,
    reports,
    simulation,
    threat_intel,
    ws,
)
from db.session import engine
from db.init_db import init_db
from ingestion.capture import LiveCaptureEngine

# ---------------------------------------------------------------------------
# Structured logging setup
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO").upper(),
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Lifespan — startup and shutdown hooks
# ---------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Initialise shared resources on startup; clean up on shutdown."""
    logger.info("Starting up IDS API...")
    app.state.start_time = time.time()

    # Automatically create database tables and TimescaleDB hypertables
    try:
        await init_db()
    except Exception as e:
        logger.error("Error during startup database initialisation: %s", e, exc_info=True)

    # Eagerly initialise the Redis pool so the first request isn't slow
    redis_pool = get_redis_pool()
    logger.info("Redis pool initialised at %s", get_redis_url())

    yield  # Application runs here

    # Shutdown
    logger.info("Shutting down IDS API...")
    LiveCaptureEngine().stop()
    await redis_pool.aclose()
    await engine.dispose()
    logger.info("Shutdown complete.")


# ---------------------------------------------------------------------------
# Application factory
# ---------------------------------------------------------------------------
def create_app() -> FastAPI:
    app = FastAPI(
        title="Network Intrusion Detection System API",
        description=(
            "Real-time ML-driven IDS with hybrid detection:\n"
            "- **Stage 1**: RandomForest / XGBoost multi-class classifier for known attacks\n"
            "- **Stage 2**: Autoencoder anomaly detector for zero-day/unknown attacks\n"
            "- **Feature Importance** explainability per alert\n\n"
            "Ingestion → Redis Streams → Worker → PostgreSQL+TimescaleDB → WebSocket → Dashboard"
        ),
        version="0.1.0",
        lifespan=lifespan,
        docs_url="/docs",
        redoc_url="/redoc",
    )

    # --- Security & Utility Middlewares --------------------------------------
    app.add_middleware(SecurityHeadersMiddleware)
    app.add_middleware(RequestIDMiddleware)

    # CORS — allow the React dev server and the production frontend container
    cors_origins = [
        o.strip()
        for o in os.getenv("CORS_ORIGINS", "http://localhost:3000,http://localhost:5173,http://127.0.0.1:3000,http://127.0.0.1:5173").split(",")
        if o.strip()
    ]
    app.add_middleware(
        CORSMiddleware,
        allow_origins=cors_origins,
        allow_origin_regex=r"http://(localhost|127\.0\.0\.1)(:\d+)?",
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # --- Global Exception Handlers -------------------------------------------
    @app.exception_handler(Exception)
    async def global_exception_handler(request: Request, exc: Exception) -> JSONResponse:
        logger.error("Unhandled exception processing request %s: %s", request.url.path, exc, exc_info=True)
        return JSONResponse(
            status_code=500,
            content={
                "detail": "Internal Server Error",
                "message": str(exc),
                "path": request.url.path,
            },
        )

    # --- REST routers --------------------------------------------------------
    app.include_router(auth.router)
    app.include_router(health.router)
    app.include_router(ingestion.router)
    app.include_router(prediction.router)
    app.include_router(prediction.router, prefix="/prediction", tags=["prediction"])
    app.include_router(alerts.router)
    app.include_router(metrics.router)
    app.include_router(monitor.router)
    app.include_router(threat_intel.router)
    app.include_router(incident_response.router)
    app.include_router(simulation.router)
    app.include_router(evaluation.router)
    app.include_router(reports.router)
    app.include_router(analytics.router)

    # --- WebSocket routes (NO /api prefix — WS upgrade requires root paths) --
    app.include_router(ws.router)

    return app


# Module-level app instance — referenced by uvicorn
app = create_app()
