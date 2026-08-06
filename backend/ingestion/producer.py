"""
ingestion/producer.py — Redis Stream producer stub.

Pushes serialised flow feature dicts onto the Redis Stream `ids:flows` so
the background worker (workers/flow_consumer.py) can consume and process them.

Stream name:  ids:flows
Message body: flat dict of str → str (Redis XADD requires string values)

TODO — Implementation steps:
  1. Serialise float values to strings for the Redis XADD payload.
     Redis Streams store all field values as byte strings; deserialise in
     the consumer with float(value).
  2. Call redis_client.xadd("ids:flows", payload):
         stream_entry_id = await redis_client.xadd("ids:flows", payload)
         return stream_entry_id.decode()
  3. For async consumers using aioredis / redis-py async, ensure the client
     is created with redis.asyncio.Redis.from_url(REDIS_URL).
  4. Optionally cap the stream length with MAXLEN to avoid unbounded growth:
         await redis_client.xadd("ids:flows", payload, maxlen=100_000, approximate=True)
"""
from __future__ import annotations

import logging
from typing import Any

logger = logging.getLogger(__name__)


async def push_flow_to_stream(
    redis_client: Any,
    flow_features: dict[str, Any],
) -> str:
    """
    Push a flow feature dict onto the Redis Stream `ids:flows`.

    Args:
        redis_client:   An async redis.asyncio.Redis client instance.
        flow_features:  Dict mapping feature name → value (str/float/int).

    Returns:
        The Redis Stream entry ID string (e.g. "1700000000000-0").
    """
    payload = {str(k): str(v) for k, v in flow_features.items()}
    stream_id = await redis_client.xadd("ids:flows", payload, maxlen=100000, approximate=True)
    if isinstance(stream_id, bytes):
        stream_id = stream_id.decode("utf-8")
    logger.debug("Pushed flow to stream ids:flows entry %s", stream_id)
    return str(stream_id)
