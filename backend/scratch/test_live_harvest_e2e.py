import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import time
import urllib.request
from ingestion.capture import LiveCaptureEngine

def test_live_engine():
    print("=== LIVE CAPTURE ENGINE CONCURRENCY VERIFICATION ===")
    engine = LiveCaptureEngine()
    
    # Clean restart
    if engine.active:
        engine.stop()

    start_res = engine.start("Wi-Fi")
    print("Engine start result:", start_res)
    assert start_res.get("status") == "success", f"Start failed: {start_res}"

    print("Generating real network requests on Wi-Fi...")
    urls = [
        "https://www.google.com",
        "https://httpbin.org/get",
        "https://github.com",
        "https://api.github.com",
        "https://www.cloudflare.com",
    ]

    for i in range(10):
        url = urls[i % len(urls)]
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
            urllib.request.urlopen(req, timeout=3)
            print(f"[{i+1}/10] Request to {url} completed.")
        except Exception as e:
            print(f"[{i+1}/10] Request note: {e}")
        time.sleep(0.8)

    status = engine.get_status()
    print("\n--- LIVE STATUS TELEMETRY ---")
    print(f"Active: {status['active']}")
    print(f"Interface: {status['interface']}")
    print(f"Packets/sec: {status['packets_per_sec']}")
    print(f"Flows/sec: {status['flows_per_sec']}")
    print(f"Active Flows: {status['active_flows']}")
    print(f"Bandwidth (bps): {status['bandwidth_bps']}")
    print(f"Total Packets: {status['total_packets_captured']}")
    print(f"Total Flows Processed: {status['total_flows_processed']}")
    print(f"Error Message: {status['error_message']}")

    # Assertions
    assert status['error_message'] is None, f"Unexpected error in capture engine: {status['error_message']}"
    assert status['total_packets_captured'] > 0, "No packets were captured!"
    print("\nVERIFICATION PASSED: No harvest loop errors occurred!")

    stop_res = engine.stop()
    print("Engine stop result:", stop_res)

if __name__ == "__main__":
    test_live_engine()
