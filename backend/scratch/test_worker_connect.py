import sys
import os
import asyncio

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env"))

import redis.asyncio as aioredis
from workers.flow_consumer import _ensure_consumer_group, STREAM_NAME, GROUP_NAME

async def test_worker_connection():
    print("=== TESTING WORKER CONNECTION WITH 127.0.0.1 ===")
    redis_url = "redis://127.0.0.1:6379/0"
    redis = aioredis.from_url(redis_url, socket_connect_timeout=2)
    pong = await redis.ping()
    print("[PASS] Redis Ping from Worker client (127.0.0.1):", pong)
    
    await _ensure_consumer_group(redis)
    print(f"[PASS] Consumer group '{GROUP_NAME}' on stream '{STREAM_NAME}' created/verified!")
    await redis.aclose()

if __name__ == "__main__":
    asyncio.run(test_worker_connection())
