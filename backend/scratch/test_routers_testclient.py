import sys
import os
import json

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env"))

from fastapi.testclient import TestClient
from api.main import app

client = TestClient(app)

print("=== TESTING FASTAPI ROUTERS WITH TESTCLIENT ===")

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

for ep, method in endpoints:
    try:
        if method == "GET":
            res = client.get(ep, timeout=2.0)
            print(f"[{res.status_code}] {method} {ep} -> {res.json() if res.status_code == 200 else res.text[:100]}")
    except Exception as e:
        print(f"[EXC] {method} {ep} -> {e}")
