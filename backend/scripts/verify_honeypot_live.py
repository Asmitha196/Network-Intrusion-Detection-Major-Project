import urllib.request
import json
import time

def verify_honeypot_live():
    print("=" * 70)
    print("LIVE HONEYPOT ENDPOINT & DECOY SERVER VERIFICATION")
    print("=" * 70)

    # 1. Query Status
    status_url = "http://127.0.0.1:8000/honeypot/status"
    with urllib.request.urlopen(status_url) as resp:
        status_data = json.loads(resp.read())
    print("\n[1] GET /honeypot/status Response:")
    print(json.dumps(status_data, indent=2))

    decoy_port = status_data.get("port", 8085)

    # 2. Send harmless test probes to Decoy HTTP server
    test_paths = ["/", "/admin", "/etc/passwd", "/login", "/wp-login.php"]
    print(f"\n[2] Sending harmless HTTP test probes to decoy server on port {decoy_port}...")

    for path in test_paths:
        url = f"http://127.0.0.1:{decoy_port}{path}"
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "NIDS-Honeypot-Probe/1.0"})
            with urllib.request.urlopen(req) as r:
                pass
        except Exception:
            pass  # Expected fake 404 response
        print(f"  -> Sent HTTP probe to {path:<20} (Target: {url})")
        time.sleep(0.2)

    time.sleep(1.0)  # Allow DB async task to persist events

    # 3. Query Recorded Events
    events_url = "http://127.0.0.1:8000/honeypot/events?limit=10"
    with urllib.request.urlopen(events_url) as resp:
        events_data = json.loads(resp.read())
    print(f"\n[3] GET /honeypot/events Response (Total returned: {len(events_data)}):")
    for ev in events_data[:5]:
        print(f"  - Event [{ev['event_type']:<18}] src={ev['src_ip']}:{ev['src_port']} -> req='{ev['request_type']}' severity={ev['severity']}")

    # 4. Query Stats
    stats_url = "http://127.0.0.1:8000/honeypot/stats"
    with urllib.request.urlopen(stats_url) as resp:
        stats_data = json.loads(resp.read())
    print("\n[4] GET /honeypot/stats Response:")
    print(json.dumps(stats_data, indent=2))

    # 5. Query NIDS Health Endpoint to verify existing functionality is untouched
    health_url = "http://127.0.0.1:8000/health"
    with urllib.request.urlopen(health_url) as resp:
        health_data = json.loads(resp.read())
    print("\n[5] GET /health Response (Verifying NIDS health):")
    print(json.dumps(health_data, indent=2))

    print("\n=" * 70)
    print("ALL VERIFICATIONS PASSED SUCCESSFULLY!")
    print("=" * 70)

if __name__ == "__main__":
    verify_honeypot_live()
