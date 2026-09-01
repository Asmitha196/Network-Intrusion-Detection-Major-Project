import asyncio
import sys
import os

sys.path.insert(0, os.path.abspath(os.path.dirname(__file__) + "/.."))

from db.session import AsyncSessionLocal
from sqlalchemy import text

async def main():
    async with AsyncSessionLocal() as session:
        flow_count = (await session.execute(text("SELECT COUNT(1) FROM flow_records"))).scalar()
        alert_count = (await session.execute(text("SELECT COUNT(1) FROM alerts"))).scalar()
        print(f"DB flow_records count: {flow_count}")
        print(f"DB alerts count: {alert_count}")

if __name__ == "__main__":
    asyncio.run(main())
