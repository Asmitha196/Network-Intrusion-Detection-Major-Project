import sys
import os
import json
import asyncio

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env"))

import redis

print("=== TESTING REDIS STREAMS AND FLOW CONSUMER WORKER CONNECTIVITY ===")

# 1. Redis Ping & Python Client
r = redis.Redis(host='127.0.0.1', port=6379, socket_timeout=2)
print("1. Redis PING:", r.ping())

# 2. Redis Streams Test (ids:flows)
try:
    # Test pushing a test flow to ids:flows stream
    flow_id = r.xadd("ids:flows", {"test_key": "test_value"})
    print("2. Redis Stream XADD to 'ids:flows' succeeded. ID:", flow_id)
    xlen = r.xlen("ids:flows")
    print("   Stream 'ids:flows' length:", xlen)
except Exception as e:
    print("2. Redis Streams FAIL:", e)

# 3. Check worker import and connection setup
try:
    from workers.flow_consumer import FlowConsumerWorker
    worker = FlowConsumerWorker()
    print("3. FlowConsumerWorker initialized successfully.")
    print("   Worker redis connection target:", worker._redis_url)
except Exception as e:
    print("3. FlowConsumerWorker initialization FAIL:", e)
