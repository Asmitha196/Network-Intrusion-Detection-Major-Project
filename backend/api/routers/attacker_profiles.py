"""
api/routers/attacker_profiles.py — Attacker Profile API Endpoints.

Provides REST endpoints to query top threat actor profiles and retrieve deep-dive
profiling metadata for any suspicious source IP address.
"""
from __future__ import annotations

import logging
from typing import Any, Dict, List

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from api.dependencies import get_db
from analytics.attacker_profiler import build_attacker_profile, get_top_attacker_summaries

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/attackers", tags=["attacker-profiles"])


@router.get("", summary="List Top Attacker Profiles")
async def list_attacker_profiles(
    limit: int = Query(default=50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
) -> List[Dict[str, Any]]:
    """Retrieve top suspicious source IPs aggregated into threat actor profiles."""
    try:
        profiles = await get_top_attacker_summaries(session=db, limit=limit)
        return profiles
    except Exception as e:
        logger.error("Error generating attacker profiles: %s", e, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate attacker profiles: {e}",
        )


@router.get("/{source_ip}", summary="Get Detailed Attacker Profile for Source IP")
async def get_attacker_profile_by_ip(
    source_ip: str,
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    """Retrieve detailed threat profile, attack metrics, and activity timeline for a target source IP."""
    try:
        profile = await build_attacker_profile(source_ip=source_ip, session=db)
        if not profile or profile.get("total_alerts", 0) == 0 and profile.get("honeypot_interactions", 0) == 0:
            # Still return profile structure even if clean
            pass
        return profile
    except Exception as e:
        logger.error("Error generating profile for IP %s: %s", source_ip, e, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to build profile for IP {source_ip}: {e}",
        )


@router.get("/{source_ip}/timeline", summary="Get Unified Attacker Behavior Timeline")
async def get_attacker_timeline_endpoint(
    source_ip: str,
    limit: int = Query(default=100, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
) -> List[Dict[str, Any]]:
    """Retrieve chronological behavior timeline synthesizing ML alerts, Honeypot hits, and Correlated Incidents."""
    from analytics.timeline_service import build_attacker_timeline
    try:
        return await build_attacker_timeline(source_ip=source_ip, session=db, limit=limit)
    except Exception as e:
        logger.error("Error building timeline for IP %s: %s", source_ip, e, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to build timeline for IP {source_ip}: {e}",
        )

