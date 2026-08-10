"""
analytics/recommendation_engine.py — NIDS Response Recommendation Engine.

Generates contextual, non-automated security recommendations for active threat actors and incidents.
Never executes containment actions automatically — requires analyst approval.
"""
from __future__ import annotations

import logging
from typing import Any, Dict, List

from sqlalchemy.ext.asyncio import AsyncSession

from analytics.attacker_profiler import get_top_attacker_summaries

logger = logging.getLogger(__name__)


async def generate_response_recommendations(
    session: AsyncSession,
    limit: int = 50,
) -> List[Dict[str, Any]]:
    """
    Synthesize contextual response recommendations for active threat IPs and security incidents.
    """
    profiles = await get_top_attacker_summaries(session=session, limit=limit)
    recommendations = []

    for p in profiles:
        ip = p["source_ip"]
        hp_hits = p.get("honeypot_interactions", 0)
        bf_cnt = p.get("brute_force_count", 0)
        ps_cnt = p.get("port_scan_count", 0)
        crit_cnt = p.get("critical_alerts", 0)
        total_alerts = p.get("total_alerts", 0)
        risk_score = p.get("risk_score", 0)
        risk_level = p.get("risk_level", "LOW")
        attack_types = p.get("attack_types", [])

        # Determine Recommendation & Reason
        if hp_hits > 0:
            rec_action = "Investigate the source immediately."
            reason = f"Source IP touched isolated Honeypot decoy server {hp_hits} time(s) (probed sensitive paths)."
            cmd = f'netsh advfirewall firewall add rule name="Block_{ip}" dir=in action=block remoteip={ip}'
        elif bf_cnt >= 1 or any("brute force" in str(at).lower() for at in attack_types):
            rec_action = "Consider temporarily blocking the source after analyst verification."
            reason = f"Repeated authentication failure patterns ({bf_cnt} brute force attempts) detected by Stage 1 ML."
            cmd = f'netsh advfirewall firewall add rule name="Block_{ip}" dir=in action=block remoteip={ip}'
        elif crit_cnt >= 1:
            rec_action = "Review firewall rules and affected hosts."
            reason = f"Multiple critical security alerts ({crit_cnt} critical alerts) triggered within short time window."
            cmd = f'netsh advfirewall firewall add rule name="Block_{ip}" dir=in action=block remoteip={ip}'
        elif ps_cnt > 0:
            rec_action = "Monitor the source IP and investigate repeated scanning."
            reason = f"Reconnaissance network port scanning ({ps_cnt} port scans) detected by Stage 1 ML."
            cmd = f'Audit traffic logs for IP {ip}'
        else:
            rec_action = "Observe traffic patterns and audit host logs."
            reason = f"Anomalous traffic flow detected ({total_alerts} alerts)."
            cmd = f'Audit traffic logs for IP {ip}'

        recommendations.append({
            "id": f"rec-{ip}",
            "source_ip": ip,
            "recommended_action": rec_action,
            "reason": reason,
            "risk_score": risk_score,
            "risk_level": risk_level,
            "related_evidence": {
                "total_alerts": total_alerts,
                "port_scan_count": ps_cnt,
                "brute_force_count": bf_cnt,
                "honeypot_interactions": hp_hits,
                "critical_alerts": crit_cnt,
                "attack_types": attack_types,
            },
            "suggested_command": cmd,
            "requires_analyst_approval": True,
        })

    # Sort recommendations by risk score descending
    recommendations.sort(key=lambda r: (r["risk_score"], r["related_evidence"]["total_alerts"]), reverse=True)
    return recommendations
