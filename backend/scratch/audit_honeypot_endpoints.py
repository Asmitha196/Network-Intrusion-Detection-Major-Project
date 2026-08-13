import urllib.request
import json

BASE_URL = "http://127.0.0.1:8000"

endpoints = [
    ("/honeypot/status", "GET"),
    ("/honeypot/events?limit=5", "GET"),
    ("/honeypot/stats", "GET"),
    ("/honeypot/correlated-alerts", "GET"),
    ("/honeypot/ip-correlation/192.168.1.105", "GET"),
]

print("=== AUDITING LIVE HONEYPOT ENDPOINTS AT http://127.0.0.1:8000 ===")

for ep, method in endpoints:
    url = f"{BASE_URL}{ep}"
    try:
        req = urllib.request.Request(url, method=method)
        with urllib.request.urlopen(req, timeout=5) as resp:
            status = resp.status
            data = json.loads(resp.read().decode('utf-8'))
            print(f"\n[{status}] {method} {ep}:")
            print(json.dumps(data if not isinstance(data, list) else data[:2], indent=2))
    except Exception as e:
        print(f"\n[FAIL] {method} {ep} -> {e}")
