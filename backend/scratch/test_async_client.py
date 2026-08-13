import sys
import os
import json
import asyncio

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env"))

import httpx
from api.main import app

endpoints = [
    ("/health", "GET"),
    ("/alerts", "GET"),
    ("/metrics/overview", "GET"),
    ("/metrics/timeline", "GET"),
    ("/monitor/status", "GET"),
    ("/honeypot/status", "GET"),
    ("/honeypot/events", "GET"),
    ("/honeypot/stats", "GET"),
    ("/honeypot/correlated-alerts", "GET"),
    ("/attackers", "GET"),
    ("/incidents", "GET"),
    ("/threat-intel/lookup/8.8.8.8", "GET"),
    ("/threat-intel/lookup/192.168.1.1", "GET"),
    ("/incident/recommendations", "GET"),
    ("/incident/audit-logs", "GET"),
    ("/incident/rules", "GET"),
    ("/simulation", "GET"),
    ("/evaluation/metrics", "GET"),
    ("/evaluation/drift", "GET"),
    ("/evaluation/comparison", "GET"),
    ("/analytics", "GET"),
    ("/reports", "GET")
]

async def test_all():
    print("=== TESTING FASTAPI ENDPOINTS WITH HTTPX ASYNC CLIENT ===")
    async with httpx.AsyncClient(app=app, base_url="http://test") as client:
        for ep, method in endpoints:
            try:
                res = await client.get(ep, timeout=5.0)
                status = res.status_code
                if status == 200:
                    data = res.json()
                    detail = list(data.keys()) if isinstance(data, dict) else f"list ({len(data)} items)"
                else:
                    detail = res.text[:120]
                print(f"[{status}] {method} {ep} -> {detail}")
            except Exception as e:
                print(f"[ERR] {method} {ep} -> {e}")

if __name__ == "__main__":
    asyncio.run(test_all())
