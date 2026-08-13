import urllib.request
import json

url = "http://127.0.0.1:8000/attackers"
req = urllib.request.Request(url)

try:
    with urllib.request.urlopen(req, timeout=5) as resp:
        data = json.loads(resp.read().decode('utf-8'))
        
        target_ips = ["192.168.1.105", "192.168.1.130", "192.168.1.160"]
        print("=== VERIFYING LIVE RECORDS FROM GET /attackers ===")
        
        for ip in target_ips:
            match = next((item for item in data if item.get("source_ip") == ip or item.get("ip") == ip), None)
            if match:
                print(f"\nIP: {ip}")
                print(f"  total_alerts: {match.get('total_alerts')}")
                print(f"  honeypot_interactions: {match.get('honeypot_interactions')}")
                print(f"  risk_score: {match.get('risk_score')}")
                print(f"  risk_level: {match.get('risk_level')}")
                print(f"  attack_types: {match.get('attack_types')}")
                print(f"  first_seen: {match.get('first_seen')}")
                print(f"  last_seen: {match.get('last_seen')}")
                print(f"  threat_intelligence country: {match.get('threat_intelligence', {}).get('country')}")
            else:
                print(f"\nIP: {ip} not found in top profiles list")
except Exception as e:
    print("Error querying GET /attackers:", e)
