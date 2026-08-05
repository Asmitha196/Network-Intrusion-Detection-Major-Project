"""
api/schemas/alert.py — Pydantic v2 output schemas for alerts.
"""
from __future__ import annotations

import uuid
from datetime import datetime
from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, Field


class SeverityEnum(str, Enum):
    low = "low"
    medium = "medium"
    high = "high"
    critical = "critical"


class ShapExplanation(BaseModel):
    """SHAP or global feature importance explanation attached to alerts."""

    model_config = ConfigDict(frozen=True)

    feature_names: list[str] = Field(
        description="Ordered list of the 76 CICFlowMeter feature names."
    )
    shap_values: list[float] = Field(
        description="SHAP / importance value for each feature."
    )
    base_value: float = Field(
        default=0.0,
        description="Base value / expected model output."
    )
    explanation_type: Optional[str] = Field(
        default="global_feature_importance",
        description="Explanation model type (shap / global_feature_importance)."
    )
    is_global_fallback: Optional[bool] = Field(
        default=True,
        description="True if global feature importances are used as fallback."
    )
    note: Optional[str] = None


class AlertOut(BaseModel):
    """Single alert — returned by /predict, /alerts, /alerts/{id}, and streamed over WS."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    timestamp: datetime
    flow_id: uuid.UUID

    # 1 = Stage 1 (RandomForest / XGBoost known-attack classifier)
    # 2 = Stage 2 (Autoencoder zero-day anomaly detector)
    stage: int = Field(ge=1, le=2)

    # None when stage == 2 (anomaly — class unknown by definition)
    attack_type: Optional[str] = Field(
        default=None,
        description="Attack class label, e.g. 'DoS Hulk'. Null for stage 2.",
    )
    confidence: float = Field(ge=0.0, le=1.0)
    severity: SeverityEnum

    # Only present for stage 2 alerts
    reconstruction_error: Optional[float] = None

    # SHAP / Global Feature Importance explanation
    shap_explanation: Optional[ShapExplanation] = None

    # Flow Metadata
    src_ip: Optional[str] = Field(default="0.0.0.0", description="Source IP address")
    dst_ip: Optional[str] = Field(default="0.0.0.0", description="Destination IP address")
    src_port: Optional[int] = Field(default=0, description="Source port")
    dst_port: Optional[int] = Field(default=0, description="Destination port")
    protocol: Optional[str] = Field(default="TCP", description="Transport protocol")

    # Raw feature snapshot — present on detailed GET /alerts/{id} response
    raw_features: Optional[dict[str, Any]] = None


class AlertListResponse(BaseModel):
    """Paginated list of alerts returned by GET /alerts."""

    model_config = ConfigDict(frozen=True)

    total: int = Field(description="Total number of matching alerts in the DB.")
    page: int = Field(default=1, description="Current page number (1-indexed).")
    page_size: int = Field(default=50, description="Page size.")
    total_pages: int = Field(default=1, description="Total number of pages.")
    items: list[AlertOut]
