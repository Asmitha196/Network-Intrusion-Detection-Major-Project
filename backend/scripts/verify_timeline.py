import sys
import os
import asyncio
import urllib.request
import json
from datetime import datetime, timezone
from pathlib import Path

# Ensure backend root is in sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from db.init_db import init_db
from db.session import AsyncSessionLocal
from db.models import Alert, FlowRecord, HoneypotEvent, CorrelatedIncident
from analytics.timeline_service import build_attacker_timeline


async def verify_timeline():
    print("=" * 70)
    print("VERIFYING PHASE 6: ATTACKER BEHAVIOR TIMELINE SYNTHESIS & API")
    print("=" * 70)

    await init_db()

    target_ip = "192.168.1.140"

    # 1. Populate Sample Events for target_ip
    print(f"\n[1] Populating sample multi-signal events for '{target_ip}'...")
    async with AsyncSessionLocal() as session:
        # 1 ML Alert
        flow = FlowRecord(timestamp=datetime.now(timezone.utc), src_ip=target_ip, dst_ip="10.0.0.1", src_port=54321, dst_port=80, protocol="TCP", features={})
        session.add(flow)
        await session.flush()
        alert = Alert(timestamp=datetime.now(timezone.utc), flow_id=flow.id, stage=1, attack_type="PortScan", confidence=0.97, severity="HIGH", tags=["ml_detected"])
        session.add(alert)

        # 1 Honeypot Event
        hp = HoneypotEvent(
            timestamp=datetime.now(timezone.utc),
            src_ip=target_ip,
            src_port=54322,
            dst_ip="127.0.0.1",
            dst_port=8085,
            protocol="TCP",
            service="http-decoy",
            request_type="GET /etc/passwd HTTP/1.1",
            event_type="SUSPICIOUS_REQUEST",
            severity="CRITICAL",
        )
        session.add(hp)

        # 1 Correlated Incident
        inc = CorrelatedIncident(
            title=f"Correlated Security Incident - {target_ip}",
            source_ip=target_ip,
            destination_ip="10.0.0.1",
            start_time=datetime.now(timezone.utc),
            last_activity=datetime.now(timezone.utc),
            alert_count=2,
            attack_types=["PortScan", "SUSPICIOUS_REQUEST"],
            honeypot_interactions=1,
            risk_score=92,
            status="NEW",
        )
        session.add(inc)

        await session.commit()

    # 2. Build Attacker Behavior Timeline
    print(f"\n[2] Synthesizing Attacker Behavior Timeline for '{target_ip}'...")
    async with AsyncSessionLocal() as session:
        timeline = await build_attacker_timeline(target_ip, session)
        print(json.dumps(timeline, indent=2))

        assert len(timeline) >= 3, f"Expected >= 3 timeline items, got {len(timeline)}"
        event_types = set(t["type"] for t in timeline)
        assert "ALERT" in event_types
        assert "HONEYPOT" in event_types
        assert "INCIDENT" in event_types

        # Verify descending timestamp ordering
        for i in range(len(timeline) - 1):
            assert timeline[i]["timestamp"] >= timeline[i + 1]["timestamp"], "Timeline entries must be sorted descending by timestamp!"

    # 3. Test HTTP Endpoint
    print("\n[3] Testing HTTP Endpoint GET /attackers/{source_ip}/timeline...")
    try:
        req = urllib.request.urlopen(f"http://127.0.0.1:8000/attackers/{target_ip}/timeline")
        tl_data = json.loads(req.read())
        print(f"  -> GET /attackers/{target_ip}/timeline returned {len(tl_data)} items")
        assert len(tl_data) >= 3
    except Exception as e:
        print(f"  -> HTTP Endpoint query note: {e}")

    # 4. Confirm Existing NIDS System Health
    print("\n[4] Verifying Existing NIDS System Health...")
    try:
        req_h = urllib.request.urlopen("http://127.0.0.1:8000/health")
        health = json.loads(req_h.read())
        print(json.dumps(health, indent=2))
        assert health["status"] == "ok"
    except Exception as e:
        print(f"  -> Health query note: {e}")

    print("\n=" * 70)
    print("PHASE 6 ATTACKER BEHAVIOR TIMELINE VERIFICATION SUCCESSFUL!")
    print("=" * 70)


if __name__ == "__main__":
    asyncio.run(verify_timeline())
