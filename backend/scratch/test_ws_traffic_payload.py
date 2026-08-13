import asyncio
import websockets

async def test_traffic_ws():
    async with websockets.connect("ws://127.0.0.1:8000/ws/traffic") as ws:
        msg1 = await ws.recv()
        print("Connected msg:", msg1)
        msg2 = await ws.recv()
        print("Traffic stats msg:", msg2)

if __name__ == "__main__":
    asyncio.run(test_traffic_ws())
