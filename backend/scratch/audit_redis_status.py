import sys
import os
import json
import asyncio

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env"))

raw_url = os.getenv("REDIS_URL", "redis://localhost:6379/0")
print("=== REDIS AND SYSTEM SERVICE AUDIT ===")
print("Testing URL:", raw_url)

async def audit_redis():
    results = {}
    try:
        import redis.asyncio as aioredis
        r = aioredis.from_url(raw_url, socket_connect_timeout=2)
        pong = await r.ping()
        results["ping"] = "PASS" if pong else "FAIL"
        results["client"] = "PASS"
        
        try:
            stream_exists = await r.exists("ids:flows")
            results["streams"] = "PASS"
            print(f"[REDIS AUDIT] Stream 'ids:flows' exists: {bool(stream_exists)}")
        except Exception as se:
            results["streams"] = f"FAIL ({se})"
            
        await r.aclose()
    except Exception as e:
        results["ping"] = f"FAIL ({e})"
        results["client"] = f"FAIL ({e})"
        results["streams"] = f"FAIL ({e})"
    return results

async def audit_postgres():
    try:
        from db.session import AsyncSessionLocal
        from sqlalchemy import text
        async with AsyncSessionLocal() as session:
            res = await session.execute(text("SELECT 1"))
            return "PASS" if res.scalar() == 1 else "FAIL"
    except Exception as e:
        return f"FAIL ({e})"

async def audit_fastapi():
    results = {}
    try:
        import httpx
        from api.main import app
        async with httpx.AsyncClient(app=app, base_url="http://test") as client:
            res = await client.get("/health", timeout=3.0)
            results["health"] = "PASS" if res.status_code == 200 else f"FAIL (HTTP {res.status_code})"
    except Exception as e:
        results["health"] = f"FAIL ({e})"
    return results

async def main():
    redis_res = await audit_redis()
    pg_res = await audit_postgres()
    fastapi_res = await audit_fastapi()
    
    print("\n[SUMMARY RESULTS]:")
    print("Redis Ping/Client/Streams:", redis_res)
    print("PostgreSQL:", pg_res)
    print("FastAPI Health:", fastapi_res)

if __name__ == "__main__":
    asyncio.run(main())
