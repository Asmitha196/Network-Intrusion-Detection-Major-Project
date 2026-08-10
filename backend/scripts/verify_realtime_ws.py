import sys
import os
import asyncio
import json
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from db.init_db import init_db
from db.session import AsyncSessionLocal
from db.models import Alert, FlowRecord, HoneypotEvent, CorrelatedIncident
from api.routers.ws import alert_manager


async def verify_realtime_ws():
    print("=" * 70)
    print("VERIFYING PHASE 12: REAL-TIME WEBSOCKET BROADCAST ENGINE")
    print("=" * 70)

    received_messages = []

    # Mock WebSocket client
    class MockWebSocket:
        async def accept(self):
            pass

        async def send_text(self, text_data: str):
            msg = json.loads(text_data)
            received_messages.append(msg)
            print(f"  [WS Mock Received] type={msg.get('type')}")

    mock_ws = MockWebSocket()
    await alert_manager.connect(mock_ws)

    # 1. Test Honeypot Event Broadcast
    print("\n[1] Testing Honeypot Event WS Broadcast...")
    from honeypot.decoy_server import get_decoy_server
    decoy = get_decoy_server()
    await decoy._save_and_broadcast_event(
        src_ip="192.168.1.188",
        src_port=54321,
        dst_ip="127.0.0.1",
        dst_port=8085,
        protocol="TCP",
        service="http-decoy",
        request_type="GET /admin HTTP/1.1",
        event_type="SUSPICIOUS_REQUEST",
        severity="HIGH",
        session_id="test-session-123",
        payload={"raw": "test"},
    )
    await asyncio.sleep(0.5)

    # 2. Test Correlated Incident Broadcast
    print("\n[2] Testing Correlated Incident WS Broadcast...")
    from analytics.correlation_engine import correlate_alert
    async with AsyncSessionLocal() as session:
        flow = FlowRecord(timestamp=datetime.now(timezone.utc), src_ip="192.168.1.188", dst_ip="10.0.0.1", src_port=12345, dst_port=80, protocol="TCP", features={})
        session.add(flow)
        await session.flush()

        alert = Alert(timestamp=datetime.now(timezone.utc), flow_id=flow.id, stage=1, attack_type="PortScan", confidence=0.98, severity="HIGH")
        session.add(alert)
        await session.commit()

        inc = await correlate_alert(alert=alert, src_ip="192.168.1.188", session=session)
        await session.commit()
    await asyncio.sleep(0.5)

    # 3. Test Attacker Risk Score Broadcast
    print("\n[3] Testing Attacker Profiler Risk Score WS Broadcast...")
    from analytics.attacker_profiler import build_attacker_profile
    async with AsyncSessionLocal() as session:
        prof = await build_attacker_profile(source_ip="192.168.1.188", session=session)
    await asyncio.sleep(0.5)

    # Clean up mock ws
    await alert_manager.disconnect(mock_ws)

    # Assertions
    print("\n[4] Verifying Delivered Messages...")
    types_received = [m.get("type") for m in received_messages]
    print("  -> Received Message Types:", types_received)

    assert "honeypot_event" in types_received, "Missing honeypot_event broadcast"
    assert "correlated_incident" in types_received, "Missing correlated_incident broadcast"
    assert "risk_score_update" in types_received, "Missing risk_score_update broadcast"

    print("\n=" * 70)
    print("PHASE 12 REAL-TIME WEBSOCKET VERIFICATION SUCCESSFUL!")
    print("=" * 70)


if __name__ == "__main__":
    asyncio.run(verify_realtime_ws())
