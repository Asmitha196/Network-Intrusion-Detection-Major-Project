import unittest
import sys
import os
from pathlib import Path

# Add backend root to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from analytics.risk_engine import calculate_risk_score


class TestRiskEngine(unittest.TestCase):
    def test_benign_low_risk(self):
        signals = {
            "stage1_attack_detected": False,
            "stage2_zero_day_anomaly": False,
            "severity": "LOW",
            "repeated_alert_count": 0,
            "distinct_attack_types_count": 0,
            "honeypot_interactions_count": 0,
            "is_known_malicious_ip": False,
        }
        res = calculate_risk_score(signals)
        self.assertEqual(res["score"], 2)
        self.assertEqual(res["level"], "LOW")

    def test_stage1_high_severity(self):
        signals = {
            "stage1_attack_detected": True,
            "stage2_zero_day_anomaly": False,
            "severity": "HIGH",
            "repeated_alert_count": 2,
            "distinct_attack_types_count": 1,
            "honeypot_interactions_count": 0,
            "is_known_malicious_ip": False,
        }
        # 15 (stage1) + 15 (high) + 6 (repeated) + 5 (distinct) = 41
        res = calculate_risk_score(signals)
        self.assertEqual(res["score"], 41)
        self.assertEqual(res["level"], "MEDIUM")

    def test_honeypot_critical_accumulation(self):
        signals = {
            "stage1_attack_detected": True,
            "stage2_zero_day_anomaly": True,
            "severity": "CRITICAL",
            "repeated_alert_count": 5,
            "distinct_attack_types_count": 3,
            "honeypot_interactions_count": 3,
            "is_known_malicious_ip": True,
        }
        # 15 (stage1) + 20 (stage2) + 25 (critical) + 15 (repeated) + 15 (distinct) + 24 (honeypot) + 15 (intel) = 129 -> capped at 100
        res = calculate_risk_score(signals)
        self.assertEqual(res["score"], 100)
        self.assertEqual(res["level"], "CRITICAL")

    def test_score_level_boundaries(self):
        # 0 - 29: LOW
        # 30 - 59: MEDIUM
        # 60 - 79: HIGH
        # 80 - 100: CRITICAL
        res_low = calculate_risk_score({"severity": "LOW"})
        self.assertEqual(res_low["level"], "LOW")

        res_med = calculate_risk_score({"stage1_attack_detected": True, "severity": "HIGH"})
        self.assertEqual(res_med["level"], "MEDIUM")

        res_high = calculate_risk_score({"stage1_attack_detected": True, "stage2_zero_day_anomaly": True, "severity": "HIGH", "honeypot_interactions_count": 2})
        self.assertEqual(res_high["level"], "HIGH")

        res_crit = calculate_risk_score({"stage1_attack_detected": True, "stage2_zero_day_anomaly": True, "severity": "CRITICAL", "honeypot_interactions_count": 4})
        self.assertEqual(res_crit["level"], "CRITICAL")


if __name__ == "__main__":
    unittest.main()
