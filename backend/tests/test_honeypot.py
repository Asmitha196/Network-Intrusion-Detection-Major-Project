import sys
import os
import asyncio
import time
import urllib.request
from pathlib import Path

# Ensure backend root is in sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from honeypot.decoy_server import get_decoy_server
from db.session import AsyncSessionLocal
from db.models import HoneypotEvent
from sqlalchemy import select, func




from db.init_db import init_db


def test_honeypot_pipeline():
    asyncio.run(_async_test_honeypot_pipeline())


async def _async_test_honeypot_pipeline():
    print("=" * 70)
    print("Testing Phase 1: Safe Local Decoy HTTP Server & Honeypot Event Pipeline")
    print("=" * 70)

    # Ensure tables exist
    await init_db()

    decoy = get_decoy_server()
    started = await decoy.start()
    assert started, "Decoy server failed to start!"
    print("[1] Decoy HTTP Server started successfully on port 8080.")

    time.sleep(0.5)

    # Generate harmless test requests
    test_urls = [
        ("http://127.0.0.1:8080/", "GET probe"),
        ("http://127.0.0.1:8080/admin", "Suspicious /admin path"),
        ("http://127.0.0.1:8080/etc/passwd", "Critical file traversal probe"),
    ]

    print("\n[2] Sending harmless test HTTP probes to decoy server...")
    for url, desc in test_urls:
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "NIDS-Honeypot-Test/1.0"})
            with urllib.request.urlopen(req) as resp:
                pass
        except Exception:
            pass  # Decoy responds 404, which raises HTTPError in urllib, expected behavior
        print(f"  -> Sent request: {url:<32} ({desc})")

    # Give async db saving task 1s to write to PostgreSQL
    await asyncio.sleep(1.5)

    print("\n[3] Verifying Honeypot Events stored in PostgreSQL 'honeypot_events' table...")
    async with AsyncSessionLocal() as session:
        res = await session.execute(select(HoneypotEvent).order_by(HoneypotEvent.timestamp.desc()).limit(10))
        events = res.scalars().all()

        assert len(events) > 0, "No HoneypotEvent records found in database!"
        print(f"  Total events found in database query: {len(events)}")
        for ev in events[:5]:
            print(f"    - Event [{ev.event_type:<18}] src={ev.src_ip}:{ev.src_port} -> req='{ev.request_type}' severity={ev.severity}")

    await decoy.stop()
    print("\n[4] Decoy HTTP Server stopped cleanly.")
    print("=" * 70)
    print("HONEYPOT VERIFICATION SUCCESSFUL!")
    print("=" * 70)


if __name__ == "__main__":
    asyncio.run(test_honeypot_pipeline())
