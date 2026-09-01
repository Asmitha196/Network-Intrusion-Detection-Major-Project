import requests
import json

print("=== 1. Health Endpoint ===")
r = requests.get("http://127.0.0.1:8000/health")
print("Status:", r.status_code, "Health:", r.json())

print("\n=== 2. Interfaces Endpoint ===")
r = requests.get("http://127.0.0.1:8000/interfaces")
print("Status:", r.status_code, "Count:", len(r.json()))
for i in r.json():
    print(f"  Interface: {i['name']} | IP: {i['ip_address']} | Status: {i['status']} | Speed: {i['speed']}")

print("\n=== 3. Initial Stopped Monitor Status ===")
r = requests.get("http://127.0.0.1:8000/monitor/status")
print("Status:", r.status_code)
print("Data:", json.dumps(r.json(), indent=2))

print("\n=== 4. Test Start Monitoring on Wi-Fi ===")
r = requests.post("http://127.0.0.1:8000/monitor/start", json={"interface": "Wi-Fi"})
print("Status Code:", r.status_code)
print("Response:", r.json())

print("\n=== 5. Monitor Status After Start Attempt ===")
r = requests.get("http://127.0.0.1:8000/monitor/status")
print("Status:", r.status_code)
print("Data:", json.dumps(r.json(), indent=2))

print("\n=== 6. Test Stop Monitoring ===")
r = requests.post("http://127.0.0.1:8000/monitor/stop")
print("Status Code:", r.status_code)
print("Response:", r.json())

print("\n=== 7. Final Monitor Status ===")
r = requests.get("http://127.0.0.1:8000/monitor/status")
print("Status:", r.status_code)
print("Data:", json.dumps(r.json(), indent=2))
