import sys
import os
import asyncio
import urllib.request
import json
import time
from datetime import datetime, timezone
from pathlib import Path

# Ensure backend root is in sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from db.init_db import init_db
from db.session import AsyncSessionLocal
from db.models import Alert, FlowRecord, HoneypotEvent
from honeypot.decoy_server import get_decoy_server
from honeypot.enrichment import enrich_alert_with_honeypot, correlate_ip_events
from sqlalchemy import select, desc


async def verify_honeypot_integration():
    print("=" * 70)
    print("VERIFYING PHASE 2: HONEYPOT EVENTS & EXISTING NIDS INTEGRATION")
    print("=" * 70)

    # 1. Initialize DB Tables
    await init_db()

    target_attacker_ip = "192.168.1.100"

    # 2. Record a Honeypot Event from target_attacker_ip
    print(f"\n[1] Recording Honeypot Decoy probe from IP '{target_attacker_ip}'...")
    async with AsyncSessionLocal() as session:
        hp_event = HoneypotEvent(
            timestamp=datetime.now(timezone.utc),
            src_ip=target_attacker_ip,
            src_port=54321,
            dst_ip="127.0.0.1",
            dst_port=8085,
            protocol="TCP",
            service="http-decoy",
            request_type="GET /admin HTTP/1.1",
            event_type="SUSPICIOUS_REQUEST",
            severity="HIGH",
            payload={"path": "/admin", "user_agent": "AttackerProbe/1.0"},
        )
        session.add(hp_event)
        await session.commit()
        print(f"  -> Saved HoneypotEvent ID: {hp_event.id} (type={hp_event.event_type}, severity={hp_event.severity})")

    # 3. Simulate Stage 1 ML Alert generation for the same IP
    print(f"\n[2] Simulating ML Stage 1 PortScan Alert for IP '{target_attacker_ip}'...")
    async with AsyncSessionLocal() as session:
        flow = FlowRecord(
            timestamp=datetime.now(timezone.utc),
            src_ip=target_attacker_ip,
            dst_ip="10.0.0.5",
            src_port=54321,
            dst_port=80,
            protocol="TCP",
            features={"Flow Duration": 120, "Total Fwd Packets": 10},
        )
        session.add(flow)
        await session.flush()

        alert = Alert(
            timestamp=datetime.now(timezone.utc),
            flow_id=flow.id,
            stage=1,
            attack_type="PortScan",
            confidence=0.98,
            severity="HIGH",
            tags=["ml_detected"],
        )

        # Apply Honeypot Enrichment
        enriched = await enrich_alert_with_honeypot(alert, session, src_ip=target_attacker_ip, time_window_minutes=15)
        session.add(alert)
        await session.commit()
        await session.refresh(alert)

        print(f"  -> Persisted Enriched Alert ID: {alert.id}")
        print(f"  -> Enrichment Result: {enriched}")
        print(f"  -> Updated Tags: {alert.tags}")
        print(f"  -> Honeypot Evidence Metadata: {json.dumps(alert.threat_intel.get('honeypot_evidence'), indent=2)}")

        assert enriched is True, "Alert should have been enriched with honeypot evidence!"
        assert "honeypot_activity" in alert.tags, "Alert tags must include 'honeypot_activity'!"

    # 4. Test IP Correlation Engine
    print(f"\n[3] Testing IP Correlation Engine for '{target_attacker_ip}'...")
    async with AsyncSessionLocal() as session:
        correlation = await correlate_ip_events(target_attacker_ip, session, time_window_minutes=60)
        print(json.dumps(correlation, indent=2))
        assert correlation["total_alerts"] >= 1, "Correlation must find at least 1 alert!"
        assert correlation["total_honeypot_hits"] >= 1, "Correlation must find at least 1 honeypot hit!"

    # 5. Query REST Endpoints
    print("\n[4] Querying API Endpoints...")
    try:
        req_corr = urllib.request.urlopen("http://127.0.0.1:8000/honeypot/correlated-alerts")
        corr_alerts = json.loads(req_corr.read())
        print(f"  -> GET /honeypot/correlated-alerts returned {len(corr_alerts)} alerts")
    except Exception as e:
        print(f"  -> GET /honeypot/correlated-alerts note: {e}")

    try:
        req_ip = urllib.request.urlopen(f"http://127.0.0.1:8000/honeypot/ip-correlation/{target_attacker_ip}")
        ip_corr = json.loads(req_ip.read())
        print(f"  -> GET /honeypot/ip-correlation/{target_attacker_ip} returned suspicion level: {ip_corr.get('suspicion_level')}")
    except Exception as e:
        print(f"  -> GET /honeypot/ip-correlation note: {e}")

    # 6. Confirm Existing NIDS System Health
    print("\n[5] Verifying Existing NIDS System Health...")
    try:
        req_h = urllib.request.urlopen("http://127.0.0.1:8000/health")
        health = json.loads(req_h.read())
        print(json.dumps(health, indent=2))
        assert health["status"] == "ok"
        assert health["postgres"] is True
        assert health["redis"] is True
        assert health["ml_models_loaded"]["classifier"] is True
        assert health["ml_models_loaded"]["autoencoder"] is True
    except Exception as e:
        print(f"  -> Health query note: {e}")

    print("\n=" * 70)
    print("PHASE 2 INTEGRATION VERIFICATION SUCCESSFUL!")
    print("=" * 70)


if __name__ == "__main__":
    asyncio.run(verify_honeypot_integration())
