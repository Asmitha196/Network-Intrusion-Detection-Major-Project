import urllib.request
import json

BASE_URL = "http://127.0.0.1:8000"

print("=== AUDITING SIMULATION ENDPOINTS AT http://127.0.0.1:8000 ===")

# 1. Test GET /simulation
try:
    req = urllib.request.Request(f"{BASE_URL}/simulation")
    with urllib.request.urlopen(req, timeout=5) as resp:
        print("\n[200] GET /simulation response:")
        data = json.loads(resp.read().decode('utf-8'))
        print(json.dumps(data, indent=2))
except Exception as e:
    print("\n[FAIL] GET /simulation ->", e)

# 2. Test POST /simulation/run
try:
    payload = json.dumps({
        "attack_type": "SYN Flood",
        "packet_count": 100,
        "target_ip": "172.16.0.5"
    }).encode('utf-8')
    
    req = urllib.request.Request(
        f"{BASE_URL}/simulation/run",
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST"
    )
    with urllib.request.urlopen(req, timeout=5) as resp:
        print("\n[200] POST /simulation/run response:")
        res_data = json.loads(resp.read().decode('utf-8'))
        print(json.dumps(res_data, indent=2))
except Exception as e:
    print("\n[FAIL] POST /simulation/run ->", e)
