import urllib.request
import json

BASE_URL = "http://127.0.0.1:8000"

endpoints = [
    ("/evaluation/metrics", "GET"),
    ("/evaluation/drift", "GET"),
    ("/evaluation/comparison", "GET")
]

print("=== LIVE AUDIT OF EVALUATION ENDPOINTS ===")

for ep, method in endpoints:
    url = f"{BASE_URL}{ep}"
    try:
        req = urllib.request.Request(url, method=method)
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            print(f"\n[{resp.status}] {method} {ep}:")
            print(json.dumps(data, indent=2))
    except urllib.error.HTTPError as e:
        body = e.read().decode('utf-8')
        print(f"\n[{e.code}] {method} {ep} -> HTTP Error: {body}")
    except Exception as e:
        print(f"\n[FAIL] {method} {ep} -> Exception: {e}")
