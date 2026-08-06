import asyncio
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from dotenv import load_dotenv
import redis.asyncio as aioredis
from api.schemas.flow import FlowFeatures
from ingestion.producer import push_flow_to_stream

load_dotenv()

async def simulate():
    redis_url = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    print(f"Connecting to Redis at {redis_url}...")
    redis_client = aioredis.Redis.from_url(redis_url)

    # 1. Benign Flow
    print("\nPushing a Benign Flow...")
    benign_flow = FlowFeatures(
        src_ip="192.168.1.15",
        dst_ip="8.8.8.8",
        src_port=52345,
        dst_port=443,
        protocol="TCP",
        flow_duration=5000.0,
        total_fwd_packets=5.0,
        total_bwd_packets=4.0,
    )
    payload_benign = {
        "src_ip": benign_flow.src_ip,
        "dst_ip": benign_flow.dst_ip,
        "src_port": str(benign_flow.src_port),
        "dst_port": str(benign_flow.dst_port),
        "protocol": benign_flow.protocol,
        **{k: str(v) for k, v in benign_flow.to_feature_dict().items()},
    }
    stream_id = await push_flow_to_stream(redis_client, payload_benign)
    print(f"Benign Flow pushed! Stream ID: {stream_id}")

    await asyncio.sleep(2)

    # 2. DoS Hulk Flow (heavy backward packet length)
    print("\nPushing a DoS Hulk Attack Flow...")
    hulk_flow = FlowFeatures(
        src_ip="192.168.10.50",
        dst_ip="172.16.0.5",
        src_port=49152,
        dst_port=80,
        protocol="TCP",
        flow_duration=120000.0,
        total_fwd_packets=100.0,
        total_bwd_packets=80.0,
        bwd_pkt_len_max=1460.0,
        bwd_pkt_len_mean=800.0,
    )
    payload_hulk = {
        "src_ip": hulk_flow.src_ip,
        "dst_ip": hulk_flow.dst_ip,
        "src_port": str(hulk_flow.src_port),
        "dst_port": str(hulk_flow.dst_port),
        "protocol": hulk_flow.protocol,
        **{k: str(v) for k, v in hulk_flow.to_feature_dict().items()},
    }
    stream_id = await push_flow_to_stream(redis_client, payload_hulk)
    print(f"DoS Hulk Attack Flow pushed! Stream ID: {stream_id}")

    await redis_client.aclose()

if __name__ == "__main__":
    asyncio.run(simulate())
