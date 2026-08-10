"""
analytics/risk_engine.py — NIDS Security Risk Scoring Mechanism.

Provides a transparent, configurable multi-signal Security Risk Score (0 - 100)
distinct from ML model confidence.

Note: This is a project-specific security risk heuristic aggregating multiple security signals.
"""
from __future__ import annotations

import logging
from typing import Any, Dict

logger = logging.getLogger(__name__)


def calculate_risk_score(signals: Dict[str, Any]) -> Dict[str, Any]:
    """
    Calculate a transparent 0-100 Security Risk Score based on security signals.

    Accepted signals dict keys:
      - stage1_attack_detected (bool): Stage 1 ML classifier detected known attack.
      - stage2_zero_day_anomaly (bool): Stage 2 Autoencoder detected zero-day anomaly.
      - severity (str): Alert severity ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW').
      - repeated_alert_count (int): Number of repeated alerts for this source IP.
      - distinct_attack_types_count (int): Number of unique attack categories.
      - honeypot_interactions_count (int): Number of Honeypot decoy interactions.
      - is_known_malicious_ip (bool): Threat intelligence reputation flag.

    Returns:
      dict containing 'score' (0-100), 'level' ('LOW'|'MEDIUM'|'HIGH'|'CRITICAL'),
      and 'breakdown' detailing individual point contributions.
    """
    breakdown = {}
    total_points = 0

    # 1. Stage 1 Known Attack
    if signals.get("stage1_attack_detected", False):
        breakdown["stage1_attack_detected"] = 15
        total_points += 15

    # 2. Stage 2 Zero-Day Anomaly
    if signals.get("stage2_zero_day_anomaly", False):
        breakdown["stage2_zero_day_anomaly"] = 20
        total_points += 20

    # 3. Alert Severity Weight
    severity = str(signals.get("severity", "LOW")).upper()
    sev_points = 25 if severity == "CRITICAL" else 15 if severity == "HIGH" else 8 if severity == "MEDIUM" else 2
    breakdown["severity_weight"] = sev_points
    total_points += sev_points

    # 4. Repeated Alerts
    repeated_cnt = int(signals.get("repeated_alert_count", 0))
    rep_points = min(20, repeated_cnt * 3)
    if rep_points > 0:
        breakdown["repeated_alerts"] = rep_points
        total_points += rep_points

    # 5. Distinct Attack Categories
    attack_cat_cnt = int(signals.get("distinct_attack_types_count", 0))
    cat_points = min(15, attack_cat_cnt * 5)
    if cat_points > 0:
        breakdown["attack_diversity"] = cat_points
        total_points += cat_points

    # 6. Honeypot Decoy Interactions
    hp_cnt = int(signals.get("honeypot_interactions_count", 0))
    hp_points = min(25, hp_cnt * 8)
    if hp_points > 0:
        breakdown["honeypot_interactions"] = hp_points
        total_points += hp_points

    # 7. Threat Intelligence Reputation
    if signals.get("is_known_malicious_ip", False):
        breakdown["threat_intel_flag"] = 15
        total_points += 15

    # Clamp final score between 0 and 100
    score = min(100, max(0, total_points))

    # Map to Risk Levels
    if score >= 80:
        level = "CRITICAL"
    elif score >= 60:
        level = "HIGH"
    elif score >= 30:
        level = "MEDIUM"
    else:
        level = "LOW"

    return {
        "score": score,
        "level": level,
        "description": "NIDS Security Risk Score (0-100) aggregating multi-signal security evidence",
        "breakdown": breakdown,
    }
