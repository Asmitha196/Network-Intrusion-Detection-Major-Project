import sys
import os
import json
import asyncio

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env"))

async def test_alerts_columns():
    try:
        from db.session import AsyncSessionLocal
        from sqlalchemy import text
        async with AsyncSessionLocal() as session:
            res = await session.execute(text("SELECT column_name, data_type FROM information_schema.columns WHERE table_name='alerts'"))
            cols = res.fetchall()
            print("[ALERTS COLS]:", cols)
            
            # Fetch 1 row from alerts
            row = await session.execute(text("SELECT * FROM alerts LIMIT 1"))
            print("[ALERT ROW SAMPLE]:", row.fetchone())
    except Exception as e:
        print("[ALERTS COLS FAIL]:", e)

if __name__ == "__main__":
    asyncio.run(test_alerts_columns())
