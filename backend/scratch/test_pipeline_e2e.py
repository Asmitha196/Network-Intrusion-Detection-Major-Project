import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import time
import urllib.request
import asyncio
import redis.asyncio as aioredis
from ingestion.capture import LiveCaptureEngine
from ml.pipeline import DetectionPipeline
from workers.flow_consumer import _process_message, _ensure_consumer_group, STREAM_NAME, GROUP_NAME
import workers.flow_consumer as fc

async def main():
    print("=== TESTING E2E LIVE CAPTURE & PIPELINE ===")
    engine = LiveCaptureEngine()
    
    # 1. Check initial status
    status_before = engine.get_status()
    print("Initial status:", status_before)
    
    # 2. Start monitoring on Wi-Fi
    start_res = engine.start("Wi-Fi")
    print("Start result:", start_res)
    if start_res.get("status") != "success":
        print("Failed to start engine:", start_res)
        return

    # 3. Generate some real web traffic
    print("Generating web traffic...")
    for url in ["https://www.google.com", "https://httpbin.org/get", "https://github.com"]:
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
            urllib.request.urlopen(req, timeout=3)
            print(f"Fetched {url} OK")
        except Exception as e:
            print(f"Fetch {url} note: {e}")
        time.sleep(0.5)

    # 4. Wait a few seconds for rate calculation and harvest loop
    time.sleep(4)
    status_active = engine.get_status()
    print("\nActive Telemetry Status:")
    print(f" - Active: {status_active['active']}")
    print(f" - Interface: {status_active['interface']}")
    print(f" - Packets/sec: {status_active['packets_per_sec']}")
    print(f" - Flows/sec: {status_active['flows_per_sec']}")
    print(f" - Active Flows: {status_active['active_flows']}")
    print(f" - Bandwidth (bps): {status_active['bandwidth_bps']}")
    print(f" - Total Packets: {status_active['total_packets_captured']}")
    print(f" - Total Flows Flushed: {status_active['total_flows_processed']}")

    # 5. Initialize pipeline and process messages from Redis stream
    print("\nProcessing flushed flows through ML pipeline...")
    fc._pipeline = DetectionPipeline()
    r = aioredis.Redis.from_url("redis://localhost:6379/0", encoding="utf-8", decode_responses=True)
    await _ensure_consumer_group(r)
    
    # Read from stream
    response = await r.xreadgroup(
        groupname=GROUP_NAME,
        consumername="test-worker-e2e",
        streams={STREAM_NAME: ">"},
        count=10,
        block=2000,
    )
    
    processed_count = 0
    if response:
        for _stream_name, messages in response:
            for message_id, fields in messages:
                await _process_message(r, message_id, fields)
                processed_count += 1
    print(f"E2E Test: ML pipeline processed and persisted {processed_count} real network flows.")

    await r.aclose()

    # 6. Stop monitoring
    stop_res = engine.stop()
    print("\nStop result:", stop_res)

    status_stopped = engine.get_status()
    print("\nFinal Stopped Status:")
    print(f" - Active: {status_stopped['active']}")
    print(f" - Packets/sec: {status_stopped['packets_per_sec']}")
    print(f" - Bandwidth: {status_stopped['bandwidth_bps']}")

if __name__ == "__main__":
    asyncio.run(main())
