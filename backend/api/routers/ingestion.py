"""
api/routers/ingestion.py — Flow and PCAP ingestion endpoints with PCAP Job Status Tracking.

POST /ingest/flow       — Accept a single pre-computed FlowFeatures payload and push onto Redis Stream `ids:flows`.
POST /ingest/pcap       — Upload a .pcap / .pcapng file, store temporarily, initialize job status, and queue replay job.
GET  /ingest/pcap/{id}  — Query PCAP replay job status (queued, processing, completed, failed).
"""
from __future__ import annotations

import os
import uuid
import logging
from pathlib import Path
from datetime import datetime, timezone
from typing import Any

import redis.asyncio as aioredis
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from fastapi.responses import FileResponse

from api.dependencies import get_redis
from api.schemas.flow import FlowFeatures
from ingestion.producer import push_flow_to_stream

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/ingest", tags=["ingestion"])

UPLOAD_DIR = Path("data/uploads")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


@router.post("/flow", status_code=status.HTTP_202_ACCEPTED, summary="Ingest a single flow")
async def ingest_flow(
    flow: FlowFeatures,
    redis: aioredis.Redis = Depends(get_redis),
) -> dict:
    """
    Accept a validated FlowFeatures payload and push it into Redis Stream `ids:flows`.
    ML inference is processed asynchronously by workers/flow_consumer.py.
    """
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
        logger.info("Queued flow %s → %s | stream entry %s", flow.src_ip, flow.dst_ip, stream_id)
        return {
            "queued": True,
            "stream_id": stream_id,
            "message": "Flow queued successfully",
        }
    except Exception as e:
        logger.error("Failed to push flow into Redis stream: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to queue flow: {e}",
        )


@router.post("/pcap", status_code=status.HTTP_202_ACCEPTED, summary="Upload a PCAP file for background replay")
async def ingest_pcap(
    file: UploadFile = File(..., description="A .pcap or .pcapng capture file"),
    redis: aioredis.Redis = Depends(get_redis),
) -> dict:
    """
    Accept a .pcap file upload, store it temporarily in `data/uploads/`,
    initialize job status in Redis Hash (`ids:pcap_job:{job_id}`), and push to `ids:pcap_jobs`.
    Returns immediately with processing job_id.
    """
    if not file.filename or not file.filename.lower().endswith((".pcap", ".pcapng")):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="File must be a valid .pcap or .pcapng capture file.",
        )

    job_id = str(uuid.uuid4())
    safe_filename = f"{job_id}_{file.filename}"
    file_path = UPLOAD_DIR / safe_filename
    created_at = datetime.now(timezone.utc).isoformat()

    try:
        content = await file.read()
        with open(file_path, "wb") as f:
            f.write(content)

        # 1. Initialize job status hash in Redis
        job_info = {
            "job_id": job_id,
            "filename": file.filename,
            "file_path": str(file_path),
            "status": "queued",
            "created_at": created_at,
            "total_flows": "0",
            "error": "",
        }
        await redis.hset(f"ids:pcap_job:{job_id}", mapping=job_info)
        await redis.expire(f"ids:pcap_job:{job_id}", 604800)  # TTL 7 days

        # 2. Push job entry onto Redis Stream `ids:pcap_jobs`
        job_stream_payload = {
            "job_id": job_id,
            "filename": file.filename,
            "file_path": str(file_path),
            "created_at": created_at,
        }
        stream_id = await redis.xadd("ids:pcap_jobs", job_stream_payload, maxlen=10000)
        if isinstance(stream_id, bytes):
            stream_id = stream_id.decode("utf-8")

        logger.info("Enqueued PCAP upload job %s (file: %s) -> stream %s", job_id, safe_filename, stream_id)

        return {
            "job_id": job_id,
            "status": "queued",
            "filename": file.filename,
            "stream_id": str(stream_id),
            "created_at": created_at,
            "message": "PCAP file uploaded and queued for background replay processing",
        }
    except Exception as e:
        logger.error("Failed to store and queue PCAP file %s: %s", file.filename, e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to process PCAP upload: {e}",
        )


@router.get("/pcap/{job_id}", summary="Query status of a PCAP replay job")
async def get_pcap_job_status(
    job_id: str,
    redis: aioredis.Redis = Depends(get_redis),
) -> dict[str, Any]:
    """
    Query current status of a PCAP replay job.
    Statuses: queued, processing, completed, failed.
    """
    job_data = await redis.hgetall(f"ids:pcap_job:{job_id}")
    if not job_data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"PCAP job '{job_id}' not found.",
        )

    return {
        "job_id": job_data.get("job_id", job_id),
        "filename": job_data.get("filename", ""),
        "status": job_data.get("status", "unknown"),
        "total_flows": int(job_data.get("total_flows", 0)),
        "error": job_data.get("error", ""),
        "created_at": job_data.get("created_at", ""),
        "started_at": job_data.get("started_at", ""),
        "completed_at": job_data.get("completed_at", ""),
        "failed_at": job_data.get("failed_at", ""),
    }


@router.get("/samples", summary="List downloadable sample PCAP files")
async def list_sample_pcaps() -> dict[str, Any]:
    """Return a list of available downloadable sample PCAP files for testing."""
    data_dir = Path("../data")
    if not data_dir.exists():
        data_dir = Path("data")

    samples = []
    for f in ["sample.pcap", "sample_network_traffic.pcap", "sample_portscan_attack.pcap", "sample_ddos_attack.pcap"]:
        path = data_dir / f
        if path.exists():
            samples.append({
                "name": f,
                "size_bytes": path.stat().st_size,
                "download_url": f"/ingest/download/{f}",
            })

    return {"samples": samples}


@router.get("/download/{filename}", summary="Download a sample PCAP file")
async def download_pcap(filename: str):
    """Download a specified .pcap packet capture file."""
    if ".." in filename or "/" in filename or "\\" in filename:
        raise HTTPException(status_code=400, detail="Invalid filename")

    data_dir = Path("../data")
    file_path = data_dir / filename
    if not file_path.exists():
        file_path = Path("data") / filename

    if not file_path.exists():
        raise HTTPException(status_code=404, detail=f"PCAP file '{filename}' not found.")

    return FileResponse(
        path=file_path,
        filename=filename,
        media_type="application/vnd.tcpdump.pcap",
    )

