"""
db/models.py — SQLAlchemy ORM models for Enterprise SOC IDS Platform.

Tables:
-------
  flow_records       — Bidirectional network flow records
  alerts             — ML security alerts
  users              — Enterprise RBAC user accounts (admin, analyst, viewer)
  audit_logs         — SOC audit log for incident response & firewall actions
  threat_intel_cache — Cached IP reputation & GeoIP metadata
  analyst_feedback   — Ground-truth analyst verification feedback
  reports            — Executive SOC reports
"""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional, List, Dict, Any

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Boolean, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class FlowRecord(Base):
    """
    Represents a single bidirectional network flow extracted from raw packets.
    Partitioned as a TimescaleDB hypertable on `timestamp`.
    """

    __tablename__ = "flow_records"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        primary_key=True,
        nullable=False,
        server_default=func.now(),
        index=True,
    )
    src_ip: Mapped[str] = mapped_column(String(45), nullable=False)   # IPv4 or IPv6
    dst_ip: Mapped[str] = mapped_column(String(45), nullable=False)
    src_port: Mapped[int] = mapped_column(Integer, nullable=False)
    dst_port: Mapped[int] = mapped_column(Integer, nullable=False)
    protocol: Mapped[str] = mapped_column(String(10), nullable=False)  # TCP/UDP/ICMP

    features: Mapped[Dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)

    alerts: Mapped[List["Alert"]] = relationship(
    "Alert",
    back_populates="flow",
    cascade="all, delete-orphan",
    primaryjoin="FlowRecord.id == foreign(Alert.flow_id)",
)

    def __repr__(self) -> str:
        return (
            f"<FlowRecord id={self.id} "
            f"{self.src_ip}:{self.src_port} → {self.dst_ip}:{self.dst_port} "
            f"@ {self.timestamp}>"
        )


class Alert(Base):
    """
    Represents a security alert produced by the ML detection pipeline.
    Partitioned as a TimescaleDB hypertable on `timestamp`.
    """

    __tablename__ = "alerts"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        primary_key=True,
        nullable=False,
        server_default=func.now(),
        index=True,
    )
    flow_id: Mapped[uuid.UUID] = mapped_column(
    UUID(as_uuid=True),
    ForeignKey("flow_records.id"),
    nullable=False,
    index=True,
)

    stage: Mapped[int] = mapped_column(Integer, nullable=False)
    attack_type: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    confidence: Mapped[float] = mapped_column(Float, nullable=False)
    severity: Mapped[str] = mapped_column(String(16), nullable=False, index=True)
    reconstruction_error: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    shap_values: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSONB, nullable=True)
    raw_features: Mapped[Dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)

    deleted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    deleted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # Phase 8 SOC Extensions
    assigned_to: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    tags: Mapped[Optional[List[str]]] = mapped_column(JSONB, nullable=True, default=list)
    reviewed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    feedback_label: Mapped[Optional[str]] = mapped_column(String(32), nullable=True) # confirmed_attack, false_positive, benign
    threat_intel: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSONB, nullable=True)

    flow: Mapped["FlowRecord"] = relationship(
    "FlowRecord",
    back_populates="alerts",
)

    def __repr__(self) -> str:
        return (
            f"<Alert id={self.id} stage={self.stage} "
            f"type={self.attack_type!r} severity={self.severity} "
            f"@ {self.timestamp}>"
        )


class User(Base):
    """Enterprise RBAC User account."""

    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    username: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    email: Mapped[str] = mapped_column(String(128), unique=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(256), nullable=False)
    role: Mapped[str] = mapped_column(String(16), nullable=False, default="analyst") # admin, analyst, viewer
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class AuditLog(Base):
    """Audit Trail for Incident Response and administrative actions."""

    __tablename__ = "audit_logs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)
    username: Mapped[str] = mapped_column(String(64), nullable=False)
    action: Mapped[str] = mapped_column(String(64), nullable=False) # block_ip, whitelist_ip, mute_alert, etc.
    target: Mapped[str] = mapped_column(String(128), nullable=False)
    details: Mapped[Dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)


class ThreatIntelCache(Base):
    """Cached GeoIP & Threat Reputation lookup entries."""

    __tablename__ = "threat_intel_cache"

    ip_address: Mapped[str] = mapped_column(String(45), primary_key=True)
    data: Mapped[Dict[str, Any]] = mapped_column(JSONB, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class AnalystFeedback(Base):
    """Analyst verification ground truth feedback for ML model metrics."""

    __tablename__ = "analyst_feedback"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    alert_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    username: Mapped[str] = mapped_column(String(64), nullable=False)
    stage: Mapped[int] = mapped_column(Integer, nullable=False)
    predicted_label: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    confirmed_label: Mapped[str] = mapped_column(String(32), nullable=False) # confirmed_attack, false_positive, benign
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Report(Base):
    """Generated Executive SOC Reports."""

    __tablename__ = "reports"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    report_type: Mapped[str] = mapped_column(String(32), nullable=False) # daily, weekly, monthly, custom
    title: Mapped[str] = mapped_column(String(128), nullable=False)
    summary: Mapped[Dict[str, Any]] = mapped_column(JSONB, nullable=False)
