import sys
import os
import json
import asyncio

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env"))

# 1. Database Test
async def test_db():
    print("\n--- 1. DATABASE TEST ---")
    try:
        from db.session import AsyncSessionLocal
        from sqlalchemy import text
        async with AsyncSessionLocal() as session:
            res = await session.execute(text("SELECT 1"))
            print("[DB PASS] PostgreSQL Async Query result:", res.scalar())
            
            tables_res = await session.execute(text("SELECT table_name FROM information_schema.tables WHERE table_schema='public'"))
            tables = [t[0] for t in tables_res.fetchall()]
            print("[DB PASS] Existing tables:", tables)
            
            alerts_res = await session.execute(text("SELECT COUNT(*) FROM alerts"))
            print("[DB PASS] Alerts count in DB:", alerts_res.scalar())
            
            inc_res = await session.execute(text("SELECT COUNT(*) FROM correlated_incidents"))
            print("[DB PASS] Correlated incidents count in DB:", inc_res.scalar())
            
            hp_res = await session.execute(text("SELECT COUNT(*) FROM honeypot_events"))
            print("[DB PASS] Honeypot events count in DB:", hp_res.scalar())
            
            # Fetch 1 alert from DB to inspect SHAP data
            sample_alert = await session.execute(text("SELECT id, attack_type, severity, confidence, shap_explanation FROM alerts LIMIT 1"))
            alert_row = sample_alert.fetchone()
            if alert_row:
                print(f"[DB PASS] Sample Alert from DB -> ID: {alert_row[0]}, Type: {alert_row[1]}, Severity: {alert_row[2]}, Confidence: {alert_row[3]}")
                print(f"          SHAP explanation in DB type: {type(alert_row[4])}, Sample keys: {list(alert_row[4].keys()) if isinstance(alert_row[4], dict) else alert_row[4]}")
    except Exception as e:
        print("[DB FAIL] PostgreSQL error:", e)

# 2. Redis Test
async def test_redis():
    print("\n--- 2. REDIS TEST ---")
    try:
        import redis.asyncio as aioredis
        redis_url = os.getenv("REDIS_URL", "redis://localhost:6379/0")
        r = aioredis.from_url(redis_url, socket_connect_timeout=2)
        pong = await r.ping()
        print("[REDIS PASS] Redis Ping:", pong)
    except Exception as e:
        print("[REDIS FAIL] Redis error:", e)

# 3. ML Pipeline & SHAP Test
def test_ml():
    print("\n--- 3. ML PIPELINE & SHAP TEST ---")
    try:
        from ml.pipeline import DetectionPipeline
        pipeline = DetectionPipeline()
        print("[ML PASS] DetectionPipeline initialized successfully.")
        print("  Classifier model loaded:", pipeline._classifier._is_loaded)
        print("  Autoencoder model loaded:", pipeline._detector._is_loaded)
        print("  SHAP explainer ready:", pipeline._explainer is not None and pipeline._explainer._explainer is not None)
        
        import numpy as np
        dummy_features = np.zeros((1, 76), dtype=np.float32)
        res = pipeline.run(dummy_features)
        print("[ML PASS] Pipeline BENIGN sample run succeeded -> Stage:", res.get("stage"), "Attack:", res.get("attack_type"))
        
        # Test SHAP explainer directly
        if pipeline._explainer:
            shap_output = pipeline._explainer.explain(dummy_features)
            print("[SHAP PASS] Direct SHAP explainer generated values count:", len(shap_output) if shap_output else 0)
            if shap_output:
                print("  Sample SHAP entry:", shap_output[0] if isinstance(shap_output, list) else shap_output)
    except Exception as e:
        import traceback
        print("[ML FAIL] ML Pipeline error:", e)
        traceback.print_exc()

async def main():
    await test_db()
    await test_redis()
    test_ml()

if __name__ == "__main__":
    asyncio.run(main())
