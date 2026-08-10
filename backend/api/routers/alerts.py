"""
api/routers/alerts.py — Alert Query, Detail, and Soft-Delete API Endpoints.

GET    /alerts      — Paginated, multi-filtered list of historical alerts with flow metadata
GET    /alerts/{id} — Single alert with full SHAP detail, raw features, and flow metadata
DELETE /alerts/{id} — Soft-delete an alert (sets deleted=True in DB)
"""
from __future__ import annotations

import math
import uuid
import logging
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, func, desc, asc
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from api.dependencies import get_db
from api.schemas.alert import AlertListResponse, AlertOut, SeverityEnum, ShapExplanation
from db.models import Alert, FlowRecord

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/alerts", tags=["alerts"])


def _format_alert_out(alert: Alert, flow: Optional[FlowRecord] = None) -> AlertOut:
    """Format ORM Alert + optional FlowRecord into AlertOut schema."""
    shap_exp = None
    if alert.shap_values and isinstance(alert.shap_values, dict):
        shap_exp = ShapExplanation(
            feature_names=alert.shap_values.get("feature_names", []),
            shap_values=alert.shap_values.get("shap_values", []),
            base_value=float(alert.shap_values.get("base_value", 0.0)),
            explanation_type=alert.shap_values.get("explanation_type", "global_feature_importance"),
            is_global_fallback=bool(alert.shap_values.get("is_global_fallback", True)),
            note=alert.shap_values.get("note"),
        )

    # Extract flow metadata from joined flow or alert raw_features fallback
    src_ip = flow.src_ip if flow else "0.0.0.0"
    dst_ip = flow.dst_ip if flow else "0.0.0.0"
    src_port = flow.src_port if flow else 0
    dst_port = flow.dst_port if flow else 0
    protocol = flow.protocol if flow else "TCP"

    return AlertOut(
        id=alert.id,
        timestamp=alert.timestamp,
        flow_id=alert.flow_id,
        stage=alert.stage,
        attack_type=alert.attack_type,
        confidence=alert.confidence,
        severity=SeverityEnum(alert.severity.lower()) if alert.severity else SeverityEnum.low,
        reconstruction_error=alert.reconstruction_error,
        shap_explanation=shap_exp,
        src_ip=src_ip,
        dst_ip=dst_ip,
        src_port=src_port,
        dst_port=dst_port,
        protocol=protocol,
        raw_features=alert.raw_features,
    )


@router.get(
    "",
    response_model=AlertListResponse,
    summary="List historical alerts with filtering and pagination",
)
async def list_alerts(
    page: int = Query(default=1, ge=1, description="Page number (1-indexed)"),
    page_size: int = Query(default=50, ge=1, le=500, description="Max results per page"),
    severity: Optional[SeverityEnum] = Query(default=None, description="Filter by severity level"),
    attack_type: Optional[str] = Query(default=None, description="Filter by attack label"),
    min_confidence: Optional[float] = Query(default=None, ge=0.0, le=1.0, description="Minimum confidence threshold"),
    start_ts: Optional[datetime] = Query(default=None, description="Filter alerts after timestamp (ISO 8601)"),
    end_ts: Optional[datetime] = Query(default=None, description="Filter alerts before timestamp (ISO 8601)"),
    sort_by: str = Query(default="timestamp", pattern="^(timestamp|confidence|severity)$", description="Field to sort by"),
    order: str = Query(default="desc", pattern="^(asc|desc)$", description="Sort order (asc/desc)"),
    db: AsyncSession = Depends(get_db),
) -> AlertListResponse:
    """
    Return a paginated list of security alerts matching the filters.
    Excludes soft-deleted records (`deleted == False`).
    """
    offset = (page - 1) * page_size

    # Base query filter
    filters = [Alert.deleted == False, Alert.deleted_at.is_(None)]

    if severity is not None:
        filters.append(Alert.severity == severity.value)
    if attack_type is not None:
        filters.append(Alert.attack_type.ilike(f"%{attack_type}%"))
    if min_confidence is not None:
        filters.append(Alert.confidence >= min_confidence)
    if start_ts is not None:
        filters.append(Alert.timestamp >= start_ts)
    if end_ts is not None:
        filters.append(Alert.timestamp <= end_ts)

    # 1. Count query
    count_query = select(func.count()).select_from(Alert).where(*filters)
    total_res = await db.execute(count_query)
    total = total_res.scalar_one()

    total_pages = math.ceil(total / page_size) if total > 0 else 1

    # 2. Sorting clause
    sort_col = getattr(Alert, sort_by, Alert.timestamp)
    sort_clause = desc(sort_col) if order.lower() == "desc" else asc(sort_col)

    # 3. Main paginated query joining FlowRecord metadata
    items_query = (
        select(Alert, FlowRecord)
        .outerjoin(FlowRecord, Alert.flow_id == FlowRecord.id)
        .where(*filters)
        .order_by(sort_clause)
        .offset(offset)
        .limit(page_size)
    )

    res = await db.execute(items_query)
    rows = res.all()

    items = [_format_alert_out(alert_row, flow_row) for alert_row, flow_row in rows]

    return AlertListResponse(
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
        items=items,
    )


@router.get(
    "/{alert_id}",
    response_model=AlertOut,
    summary="Retrieve single alert details",
)
async def get_alert(
    alert_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> AlertOut:
    """
    Return full details of a single alert by ID, including feature importances
    and flow metadata.
    """
    query = (
        select(Alert, FlowRecord)
        .outerjoin(FlowRecord, Alert.flow_id == FlowRecord.id)
        .where(Alert.id == alert_id, Alert.deleted == False, Alert.deleted_at.is_(None))
    )
    res = await db.execute(query)
    row = res.first()

    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Alert {alert_id} not found.",
        )

    alert_row, flow_row = row
    return _format_alert_out(alert_row, flow_row)


@router.delete(
    "/{alert_id}",
    summary="Soft-delete an alert",
    status_code=status.HTTP_200_OK,
)
async def delete_alert(
    alert_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """
    Soft-delete an alert by setting deleted=True.
    The record is retained in the database for auditing but excluded from list queries.
    """
    now_utc = datetime.now(timezone.utc)

    query = select(Alert).where(Alert.id == alert_id, Alert.deleted == False, Alert.deleted_at.is_(None))
    res = await db.execute(query)
    alert_row = res.scalar_one_or_none()

    if not alert_row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Alert {alert_id} not found or already deleted.",
        )

    alert_row.deleted = True
    alert_row.deleted_at = now_utc
    await db.commit()

    logger.info("Soft-deleted alert %s at %s", alert_id, now_utc)
    return {
        "deleted": True,
        "id": str(alert_id),
        "deleted_at": now_utc.isoformat(),
        "message": "Alert soft-deleted successfully",
    }
