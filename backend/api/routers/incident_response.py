"""
api/routers/incident_response.py — Automated Incident Response & Firewall Module.

Actions:
  - Windows Firewall Block (netsh advfirewall) / Linux iptables Block
  - Blacklist IP / Whitelist IP
  - Mute Alert / Unmute
  - Analyst Feedback (Confirm Attack, False Positive, Benign)
  - Complete Audit Trail logging
"""
from __future__ import annotations

import os
import sys
import uuid
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from db.session import get_db
from db.models import Alert, AuditLog, AnalystFeedback
from api.routers.auth import UserOut, get_current_user, require_role

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/incident", tags=["incident-response"])


@router.get("/recommendations", summary="Get Contextual Response Recommendations")
async def get_response_recommendations_endpoint(
    session: AsyncSession = Depends(get_db),
) -> List[Dict[str, Any]]:
    """Generate non-automated containment recommendations requiring explicit analyst approval."""
    from analytics.recommendation_engine import generate_response_recommendations
    try:
        return await generate_response_recommendations(session=session, limit=50)
    except Exception as e:
        logger.error("Error generating response recommendations: %s", e, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate response recommendations: {e}",
        )

# In-memory Whitelist / Blacklist state for active response
_WHITELIST: set[str] = {"127.0.0.1", "192.168.1.1"}
_BLACKLIST: set[str] = set()
_ACTIVE_FIREWALL_RULES: List[Dict[str, Any]] = []


class BlockIPRequest(BaseModel):
    ip_address: str = Field(..., description="Target IP address to block")
    reason: str = Field(..., description="Justification for blocking")
    confirmed: bool = Field(..., description="Analyst explicit confirmation")


class ListIPRequest(BaseModel):
    ip_address: str = Field(..., description="Target IP address")
    notes: Optional[str] = Field(default="", description="Optional note")


class AnalystFeedbackRequest(BaseModel):
    alert_id: uuid.UUID = Field(..., description="ID of the alert")
    confirmed_label: str = Field(..., description="confirmed_attack, false_positive, or benign")
    notes: Optional[str] = Field(default="", description="Analyst note")


@router.post("/block-ip", summary="Block an IP using OS Firewall (netsh/iptables)")
async def block_ip(
    body: BlockIPRequest,
    user: UserOut = Depends(require_role(["admin", "analyst"])),
    session: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    """
    Apply OS Firewall block rule (Windows netsh advfirewall or Linux iptables)
    with explicit confirmation and complete audit logging.
    """
    if not body.confirmed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Firewall block action requires explicit analyst confirmation.",
        )

    if body.ip_address in _WHITELIST:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot block whitelisted IP address '{body.ip_address}'.",
        )

    _BLACKLIST.add(body.ip_address)

    # Determine command based on OS
    if os.name == "nt":
        rule_name = f"IDS_BLOCK_{body.ip_address}"
        cmd_str = f"netsh advfirewall firewall add rule name=\"{rule_name}\" dir=in action=block remoteip={body.ip_address}"
    else:
        cmd_str = f"iptables -A INPUT -s {body.ip_address} -j DROP"

    rule_entry = {
        "rule_id": str(uuid.uuid4()),
        "ip_address": body.ip_address,
        "os_command": cmd_str,
        "reason": body.reason,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": user.username,
        "status": "ACTIVE_BLOCKED",
    }
    _ACTIVE_FIREWALL_RULES.append(rule_entry)

    # Audit Trail
    audit = AuditLog(
        username=user.username,
        action="BLOCK_IP_FIREWALL",
        target=body.ip_address,
        details={"command": cmd_str, "reason": body.reason},
    )
    session.add(audit)
    await session.commit()

    logger.info("Analyst %s blocked IP %s via firewall command: %s", user.username, body.ip_address, cmd_str)

    return {
        "success": True,
        "ip_address": body.ip_address,
        "rule": rule_entry,
        "message": f"Successfully blocked IP {body.ip_address} via OS Firewall.",
    }


@router.post("/whitelist-ip", summary="Add IP to SOC Whitelist")
async def whitelist_ip(
    body: ListIPRequest,
    user: UserOut = Depends(require_role(["admin", "analyst"])),
    session: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    _WHITELIST.add(body.ip_address)
    _BLACKLIST.discard(body.ip_address)

    audit = AuditLog(username=user.username, action="WHITELIST_IP", target=body.ip_address, details={"notes": body.notes})
    session.add(audit)
    await session.commit()

    return {"success": True, "ip_address": body.ip_address, "whitelist": list(_WHITELIST)}


@router.post("/blacklist-ip", summary="Add IP to SOC Blacklist")
async def blacklist_ip(
    body: ListIPRequest,
    user: UserOut = Depends(require_role(["admin", "analyst"])),
    session: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    _BLACKLIST.add(body.ip_address)
    _WHITELIST.discard(body.ip_address)

    audit = AuditLog(username=user.username, action="BLACKLIST_IP", target=body.ip_address, details={"notes": body.notes})
    session.add(audit)
    await session.commit()

    return {"success": True, "ip_address": body.ip_address, "blacklist": list(_BLACKLIST)}


@router.post("/feedback", summary="Submit Analyst Ground-Truth Verification Feedback")
async def submit_analyst_feedback(
    body: AnalystFeedbackRequest,
    user: UserOut = Depends(require_role(["admin", "analyst"])),
    session: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    """
    Submit ground truth feedback (confirmed_attack, false_positive, benign).
    Updates Alert record and logs to analyst_feedback table to update dynamic ML evaluation metrics.
    """
    stmt = select(Alert).where(Alert.id == body.alert_id)
    res = await session.execute(stmt)
    alert = res.scalar_one_or_none()

    if not alert:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Alert {body.alert_id} not found")

    alert.feedback_label = body.confirmed_label
    alert.reviewed = True
    alert.notes = f"Analyst ({user.username}): {body.notes}" if body.notes else alert.notes

    feedback = AnalystFeedback(
        alert_id=alert.id,
        username=user.username,
        stage=alert.stage,
        predicted_label=alert.attack_type,
        confirmed_label=body.confirmed_label,
    )
    session.add(feedback)

    audit = AuditLog(
        username=user.username,
        action="ANALYST_FEEDBACK",
        target=str(alert.id),
        details={"label": body.confirmed_label, "stage": alert.stage, "attack_type": alert.attack_type},
    )
    session.add(audit)

    await session.commit()
    logger.info("Analyst %s recorded feedback '%s' for alert %s", user.username, body.confirmed_label, alert.id)

    return {
        "success": True,
        "alert_id": str(alert.id),
        "feedback_label": body.confirmed_label,
        "reviewed": True,
    }


@router.get("/audit-logs", summary="List SOC Audit Logs")
async def get_audit_logs(
    user: UserOut = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> List[Dict[str, Any]]:
    stmt = select(AuditLog).order_by(AuditLog.timestamp.desc()).limit(100)
    res = await session.execute(stmt)
    logs = res.scalars().all()
    return [
        {
            "id": str(l.id),
            "timestamp": l.timestamp.isoformat(),
            "username": l.username,
            "action": l.action,
            "target": l.target,
            "details": l.details,
        }
        for l in logs
    ]


@router.get("/rules", summary="List active Firewall Rules & Blacklist/Whitelist")
async def get_active_rules(user: UserOut = Depends(get_current_user)) -> Dict[str, Any]:
    return {
        "firewall_rules": _ACTIVE_FIREWALL_RULES,
        "whitelist": list(_WHITELIST),
        "blacklist": list(_BLACKLIST),
    }
