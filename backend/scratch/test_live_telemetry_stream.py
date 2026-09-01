import time
import requests
import asyncio
import websockets
import json

async def test_live_stream():
    print("1. Starting monitoring on Wi-Fi...")
    r = requests.post("http://127.0.0.1:8000/monitor/start", json={"interface": "Wi-Fi"})
    print("Start response:", r.status_code, r.json())

    print("\n2. Connecting to WebSocket /ws/traffic...")
    async with websockets.connect("ws://127.0.0.1:8000/ws/traffic") as ws:
        # Handshake
        msg1 = await ws.recv()
        print("WS Handshake:", json.loads(msg1)["type"])

        # Collect 3 telemetry ticks
        for i in range(3):
            # Generate small burst of traffic
            try:
                requests.get("https://httpbin.org/ip", timeout=1)
            except Exception:
                pass

            msg = await ws.recv()
            data = json.loads(msg)
            print(f"WS Telemetry Tick {i+1}:")
            print(f"  - Active: {data.get('active')}")
            print(f"  - Interface: {data.get('interface')}")
            print(f"  - Packets/sec: {data.get('packets_per_sec')}")
            print(f"  - Total Packets: {data.get('total_packets_captured')}")
            print(f"  - Bandwidth (bps): {data.get('bandwidth_bps')}")
            print(f"  - Active Flows: {data.get('active_flows')}")

    print("\n3. Stopping monitoring...")
    r_stop = requests.post("http://127.0.0.1:8000/monitor/stop")
    print("Stop response:", r_stop.status_code, r_stop.json())

    print("\n4. Final Status verification:")
    r_status = requests.get("http://127.0.0.1:8000/monitor/status")
    print("Status:", r_status.json()["active"], "Packets/sec:", r_status.json()["packets_per_sec"])

if __name__ == "__main__":
    asyncio.run(test_live_stream())
