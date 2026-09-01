import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import asyncio
import redis
from sqlalchemy import text
from db.session import AsyncSessionLocal

print("=== CHECKING REDIS ===")
try:
    r = redis.Redis(host='localhost', port=6379)
    pong = r.ping()
    print("Redis Ping:", pong)
except Exception as e:
    print("Redis Error:", e)

print("=== CHECKING POSTGRESQL ===")
async def check_db():
    try:
        async with AsyncSessionLocal() as session:
            res = await session.execute(text("SELECT count(*) FROM alerts;"))
            count = res.scalar()
            print("PostgreSQL Alert count:", count)
    except Exception as e:
        print("PostgreSQL Error:", e)

asyncio.run(check_db())
