import urllib.request
import json

BASE_URL = "http://localhost:8000"

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

print("=== TESTING LIVE BACKEND ENDPOINTS AT http://localhost:8000 ===")

results = {}

for ep, method in endpoints:
    url = f"{BASE_URL}{ep}"
    try:
        req = urllib.request.Request(url, method=method)
        with urllib.request.urlopen(req, timeout=3) as resp:
            status = resp.status
            data = json.loads(resp.read().decode('utf-8'))
            results[ep] = {"status": status, "keys": list(data.keys()) if isinstance(data, dict) else f"list of {len(data)} items"}
            print(f"[PASS {status}] {method} {ep} -> {results[ep]['keys']}")
    except urllib.error.HTTPError as e:
        results[ep] = {"status": e.code, "error": str(e)}
        print(f"[HTTP ERR {e.code}] {method} {ep}")
    except Exception as e:
        results[ep] = {"status": "ERR", "error": str(e)}
        print(f"[FAIL] {method} {ep} -> {e}")

print("\nEndpoint Audit Summary:")
print(json.dumps(results, indent=2))
