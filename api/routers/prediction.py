"""
api/routers/prediction.py — Prediction Routing Endpoints (Strict Asynchronous Stream Enqueueing).

Strict Architecture Enforced:
  Client -> POST /predict -> Redis Stream (ids:flows) -> Flow Consumer Worker
  -> DetectionPipeline -> PostgreSQL + TimescaleDB -> WebSocket Broadcast

This router enqueues incoming flows on Redis Stream `ids:flows` without running inline ML inference.
"""
from __future__ import annotations

import logging
from typing import Any

import redis.asyncio as aioredis
from fastapi import APIRouter, Depends, HTTPException, status

from api.dependencies import get_redis
from api.schemas.flow import FlowFeatures
from ingestion.producer import push_flow_to_stream

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/predict", tags=["prediction"])


@router.get("", summary="Prediction Engine Status")
async def prediction_status() -> dict[str, Any]:
    return {
        "status": "online",
        "pipeline": "Stage 1 RandomForest (Known) + Stage 2 Autoencoder (Zero-Day)",
        "queue": "ids:flows",
    }


async def _enqueue_flow(flow: FlowFeatures, redis: aioredis.Redis) -> dict[str, Any]:
    """Enqueue a single FlowFeatures payload onto Redis Stream `ids:flows` for worker inference."""
    payload = {
        "src_ip": flow.src_ip,
        "dst_ip": flow.dst_ip,
        "src_port": str(flow.src_port),
        "dst_port": str(flow.dst_port),
        "protocol": flow.protocol,
        **{k: str(v) for k, v in flow.to_feature_dict().items()},
    }
    try:
        stream_id = await push_flow_to_stream(redis, payload)
        return {
            "queued": True,
            "stream_id": stream_id,
            "message": "Flow enqueued successfully for worker ML inference",
        }
    except Exception as e:
        logger.error("Failed to enqueue flow on Redis Stream: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to queue prediction flow: {e}",
        )


@router.post(
    "",
    status_code=status.HTTP_202_ACCEPTED,
    summary="Enqueue flow for ML inference (asynchronous stream)",
)
async def predict(
    flow: FlowFeatures,
    redis: aioredis.Redis = Depends(get_redis),
) -> dict:
    """
    Enqueues the flow payload onto Redis Stream `ids:flows`.
    ML inference is processed asynchronously by workers/flow_consumer.py.
    """
    return await _enqueue_flow(flow, redis)


@router.post(
    "/batch",
    status_code=status.HTTP_202_ACCEPTED,
    summary="Enqueue a batch of flows for ML inference",
)
async def predict_batch(
    flows: list[FlowFeatures],
    redis: aioredis.Redis = Depends(get_redis),
) -> list[dict]:
    """
    Enqueues a list of flows onto Redis Stream `ids:flows`.
    """
    results = []
    for flow in flows:
        res = await _enqueue_flow(flow, redis)
        results.append(res)
    return results
