"""
api/routers/metrics.py — REST Endpoints for System & Threat Metrics.

GET /metrics/overview — Return high-level alert counters, attack type distribution, and protocol breakdowns.
GET /metrics/timeline — Return time-series alert metrics bucketed using PostgreSQL date_trunc().
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from db.session import get_db

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/metrics", tags=["metrics"])

INTERVAL_TRUNC_MAP = {
    "1m": "minute",
    "5m": "minute",
    "1h": "hour",
    "1d": "day",
}


@router.get(
    "/overview",
    summary="Get aggregated high-level security metrics overview",
)
async def get_metrics_overview(
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """
    Return total alerts today, critical/high/medium/low counts, top attack vectors,
    and protocol distribution (TCP/UDP/ICMP).
    """
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

    # 1. Total & Severity breakdown
    counts_sql = text("""
        SELECT
            COUNT(*) AS total_alerts,
            COUNT(*) FILTER (WHERE timestamp >= :today_start) AS today_alerts,
            COUNT(*) FILTER (WHERE severity = 'critical') AS critical_alerts,
            COUNT(*) FILTER (WHERE severity = 'high') AS high_alerts,
            COUNT(*) FILTER (WHERE severity = 'medium') AS medium_alerts,
            COUNT(*) FILTER (WHERE severity = 'low') AS low_alerts
        FROM alerts
        WHERE deleted = FALSE
    """)
    res_counts = await db.execute(counts_sql, {"today_start": today_start})
    counts_row = res_counts.mappings().one()

    # 2. Top Attack Vectors
    top_attacks_sql = text("""
        SELECT attack_type, COUNT(*) AS count
        FROM alerts
        WHERE deleted = FALSE AND attack_type IS NOT NULL
        GROUP BY attack_type
        ORDER BY count DESC
        LIMIT 5
    """)
    res_attacks = await db.execute(top_attacks_sql)
    top_attacks = [
        {"attack_type": row["attack_type"], "count": row["count"]}
        for row in res_attacks.mappings().all()
    ]

    # 3. Protocol Breakdown
    protocol_sql = text("""
        SELECT f.protocol, COUNT(a.id) AS count
        FROM alerts a
        JOIN flow_records f ON a.flow_id = f.id
        WHERE a.deleted = FALSE
        GROUP BY f.protocol
        ORDER BY count DESC
    """)
    res_proto = await db.execute(protocol_sql)
    protocols = [
        {"protocol": row["protocol"], "count": row["count"]}
        for row in res_proto.mappings().all()
    ]

    if not protocols:
        protocols = [{"protocol": "TCP", "count": 0}, {"protocol": "UDP", "count": 0}]

    benign_count = sum(item["count"] for item in top_attacks if item["attack_type"] == "BENIGN")
    malicious_count = max(0, counts_row["total_alerts"] - benign_count)

    return {
        "today_alerts": counts_row["today_alerts"],
        "critical_alerts": counts_row["critical_alerts"],
        "high_alerts": counts_row["high_alerts"],
        "medium_alerts": counts_row["medium_alerts"],
        "low_alerts": counts_row["low_alerts"],
        "top_attacks": top_attacks,
        "benign_vs_malicious": {
            "benign": benign_count,
            "malicious": malicious_count,
        },
        "protocols": protocols,
        "total_alerts": counts_row["total_alerts"],
    }


@router.get(
    "/timeline",
    summary="Get aggregated alert metrics timeline (PostgreSQL date_trunc)",
)
async def get_metrics_timeline(
    interval: str = Query(
        default="5m",
        regex="^(1m|5m|1h|1d)$",
        description="Bucket aggregation interval: 1m, 5m, 1h, 1d",
    ),
    start_ts: datetime | None = Query(
        default=None,
        description="Filter alerts after timestamp (ISO 8601; default: 24h ago)",
    ),
    end_ts: datetime | None = Query(
        default=None,
        description="Filter alerts before timestamp (ISO 8601; default: now)",
    ),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """
    Return time-series alert metrics bucketed using standard PostgreSQL date_trunc().
    """
    now = datetime.now(timezone.utc)
    if end_ts is None:
        end_ts = now
    if start_ts is None:
        start_ts = now - timedelta(hours=24)

    trunc_unit = INTERVAL_TRUNC_MAP.get(interval, "minute")

    timeline_sql = text(f"""
        SELECT
            date_trunc('{trunc_unit}', timestamp) AS bucket,
            severity,
            COUNT(*) AS count
        FROM alerts
        WHERE deleted = FALSE AND timestamp >= :start_ts AND timestamp <= :end_ts
        GROUP BY bucket, severity
        ORDER BY bucket ASC
    """)

    res = await db.execute(
        timeline_sql,
        {"start_ts": start_ts, "end_ts": end_ts},
    )
    rows = res.mappings().all()

    buckets_dict: dict[str, dict[str, Any]] = {}
    for r in rows:
        b_str = r["bucket"].isoformat() if hasattr(r["bucket"], "isoformat") else str(r["bucket"])
        if b_str not in buckets_dict:
            buckets_dict[b_str] = {
                "bucket": b_str,
                "critical": 0,
                "high": 0,
                "medium": 0,
                "low": 0,
                "total": 0,
            }
        sev = str(r["severity"]).lower()
        cnt = int(r["count"])
        if sev in buckets_dict[b_str]:
            buckets_dict[b_str][sev] += cnt
        buckets_dict[b_str]["total"] += cnt

    return {
        "interval": interval,
        "start_ts": start_ts.isoformat(),
        "end_ts": end_ts.isoformat(),
        "timeline": list(buckets_dict.values()),
    }
