import asyncio
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from dotenv import load_dotenv
load_dotenv()

print("=== NATIVE LOCAL INFRASTRUCTURE DIAGNOSTIC ===")
print("DATABASE_URL:", os.getenv("DATABASE_URL"))
print("REDIS_URL:", os.getenv("REDIS_URL"))

async def test_postgres():
    print("\n--- Testing PostgreSQL connection ---")
    try:
        from sqlalchemy.ext.asyncio import create_async_engine
        from sqlalchemy import text

        db_url = os.getenv("DATABASE_URL", "postgresql+asyncpg://postgres:Akrithi%401234@localhost:5433/NIDS")
        engine = create_async_engine(db_url)
        async with engine.connect() as conn:
            res = await conn.execute(text("SELECT 1"))
            val = res.scalar()
            print("PostgreSQL connection SUCCESS! SELECT 1 returned:", val)
        await engine.dispose()
    except Exception as e:
        print("PostgreSQL connection FAILED:", e)

async def test_redis():
    print("\n--- Testing Redis connection ---")
    try:
        import redis.asyncio as aioredis
        redis_url = os.getenv("REDIS_URL", "redis://localhost:6379/0")
        client = aioredis.Redis.from_url(redis_url)
        pong = await client.ping()
        print("Redis connection SUCCESS! PING returned:", pong)
        await client.aclose()
    except Exception as e:
        print("Redis connection FAILED:", e)

async def main():
    await test_postgres()
    await test_redis()
    print("\n=== DIAGNOSTIC COMPLETE ===")

if __name__ == "__main__":
    asyncio.run(main())
