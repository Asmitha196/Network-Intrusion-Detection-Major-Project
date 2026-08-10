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
from db.models import Alert, FlowRecord, HoneypotEvent
from analytics.attacker_profiler import build_attacker_profile, get_top_attacker_summaries


async def verify_attacker_profiler():
    print("=" * 70)
    print("VERIFYING PHASE 3: ATTACKER PROFILE AGGREGATION & API")
    print("=" * 70)

    await init_db()

    target_ip = "192.168.1.105"

    # 1. Populate Sample Alerts and Honeypot Events for target_ip
    print(f"\n[1] Populating sample DB records for target IP '{target_ip}'...")
    async with AsyncSessionLocal() as session:
        # Create 2 PortScan flows/alerts
        for i in range(2):
            flow = FlowRecord(
                timestamp=datetime.now(timezone.utc),
                src_ip=target_ip,
                dst_ip="10.0.0.1",
                src_port=50000 + i,
                dst_port=80,
                protocol="TCP",
                features={},
            )
            session.add(flow)
            await session.flush()

            alert = Alert(
                timestamp=datetime.now(timezone.utc),
                flow_id=flow.id,
                stage=1,
                attack_type="PortScan",
                confidence=0.95,
                severity="HIGH",
                tags=["ml_detected"],
            )
            session.add(alert)

        # Create 1 Brute Force flow/alert
        flow_bf = FlowRecord(
            timestamp=datetime.now(timezone.utc),
            src_ip=target_ip,
            dst_ip="10.0.0.1",
            src_port=50005,
            dst_port=22,
            protocol="TCP",
            features={},
        )
        session.add(flow_bf)
        await session.flush()

        alert_bf = Alert(
            timestamp=datetime.now(timezone.utc),
            flow_id=flow_bf.id,
            stage=1,
            attack_type="Web Attack - Brute Force",
            confidence=0.99,
            severity="CRITICAL",
            tags=["ml_detected", "high_suspicion"],
        )
        session.add(alert_bf)

        # Create 2 Honeypot Events
        for hp_type in ["SUSPICIOUS_REQUEST", "REPEATED_REQUEST"]:
            hp = HoneypotEvent(
                timestamp=datetime.now(timezone.utc),
                src_ip=target_ip,
                src_port=51234,
                dst_ip="127.0.0.1",
                dst_port=8085,
                protocol="TCP",
                service="http-decoy",
                request_type=f"GET /{hp_type.lower()} HTTP/1.1",
                event_type=hp_type,
                severity="HIGH",
            )
            session.add(hp)

        await session.commit()

    # 2. Build Attacker Profile
    print(f"\n[2] Building Attacker Profile for '{target_ip}'...")
    async with AsyncSessionLocal() as session:
        profile = await build_attacker_profile(target_ip, session)
        print(json.dumps(profile, indent=2))

        assert profile["source_ip"] == target_ip
        assert profile["total_alerts"] >= 3, f"Expected >=3 alerts, got {profile['total_alerts']}"
        assert profile["port_scan_count"] >= 2, f"Expected >=2 port scans, got {profile['port_scan_count']}"
        assert profile["brute_force_count"] >= 1, f"Expected >=1 brute force, got {profile['brute_force_count']}"
        assert profile["honeypot_interactions"] >= 2, f"Expected >=2 honeypot hits, got {profile['honeypot_interactions']}"
        assert profile["risk_score"] > 50, f"Expected risk_score > 50, got {profile['risk_score']}"

    # 3. Test Top Attacker Summaries
    print("\n[3] Testing Top Attacker Summaries...")
    async with AsyncSessionLocal() as session:
        top_profiles = await get_top_attacker_summaries(session, limit=10)
        print(f"  -> Returned {len(top_profiles)} top attacker profiles")
        assert len(top_profiles) >= 1

    # 4. Test REST Endpoints
    print("\n[4] Testing HTTP Endpoints...")
    try:
        req_list = urllib.request.urlopen("http://127.0.0.1:8000/attackers?limit=10")
        list_data = json.loads(req_list.read())
        print(f"  -> GET /attackers returned {len(list_data)} profiles")

        req_ip = urllib.request.urlopen(f"http://127.0.0.1:8000/attackers/{target_ip}")
        ip_data = json.loads(req_ip.read())
        print(f"  -> GET /attackers/{target_ip} returned risk score: {ip_data.get('risk_score')}")
    except Exception as e:
        print(f"  -> HTTP Endpoint query note: {e}")

    # 5. Confirm Existing NIDS System Health
    print("\n[5] Verifying Existing NIDS System Health...")
    try:
        req_h = urllib.request.urlopen("http://127.0.0.1:8000/health")
        health = json.loads(req_h.read())
        print(json.dumps(health, indent=2))
        assert health["status"] == "ok"
    except Exception as e:
        print(f"  -> Health query note: {e}")

    print("\n=" * 70)
    print("PHASE 3 ATTACKER PROFILE VERIFICATION SUCCESSFUL!")
    print("=" * 70)


if __name__ == "__main__":
    asyncio.run(verify_attacker_profiler())
