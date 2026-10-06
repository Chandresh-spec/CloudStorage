from redis.asyncio import Redis
from redis.asyncio.retry import Retry
from redis.backoff import ExponentialBackoff
from redis.exceptions import TimeoutError, ConnectionError

from ..config import settings

_redis_client: Redis | None = None


async def create_redis() -> Redis:
    global _redis_client
    if _redis_client is None:
        _redis_client = Redis.from_url(
            settings.redis_url,
            max_connections=10,
            decode_responses=True,
            socket_connect_timeout=5,
            socket_timeout=5,
            socket_keepalive=True,
            health_check_interval=30,
            retry=Retry(ExponentialBackoff(cap=5, base=0.2), retries=3),
            retry_on_error=[ConnectionError, TimeoutError],
        )
    return _redis_client
