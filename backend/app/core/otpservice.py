from enum import Enum
import hmac
import secrets
import hashlib
from fastapi import Depends
from redis.asyncio import Redis

from ..config import settings
from .redis_service import create_redis


LUA_SCRIPT = """
local stored = redis.call('GET', KEYS[1])
if not stored then return -1 end

local attempts = redis.call('INCR', KEYS[2])
if attempts == 1 then redis.call('EXPIRE', KEYS[2], tonumber(ARGV[3])) end

if attempts > tonumber(ARGV[2]) then
   redis.call('DEL', KEYS[1], KEYS[2])
   return -2
end

if stored == ARGV[1] then
   redis.call('DEL', KEYS[1], KEYS[2])
   return 1
end
return 0
"""


class RateLimitException(Exception):
    def __init__(self, retry_after: int):
        self.retry_after = max(int(retry_after), 1)


def _k(kind: str, email: str) -> str:
    return f"otp:{kind}:{email.lower().strip()}"


class VerifyResult(Enum):
    OK = 1
    WRONG = 0
    EXPIRED = -1
    LOCKED = -2


def generate_otp() -> str:
    return f"{secrets.randbelow(10**6):06d}"


def hash_otp(email: str, otp: str) -> str:
    normalized_email = email.lower().strip()
    normalized_otp = otp.strip()
    return hmac.new(
        settings.otp_secret.encode(),
        f"{normalized_email}:{normalized_otp}".encode(),
        hashlib.sha256,
    ).hexdigest()


class OtpService:
    def __init__(self, redis: Redis):
        self.redis = redis
        self.verify_script = redis.register_script(LUA_SCRIPT)

    async def issue(self, email: str) -> str:
        email = email.lower().strip()
        ok = await self.redis.set(
            _k("cooldown", email), 1, ex=settings.otp_cooldown, nx=True
        )

        if not ok:
            ttl = await self.redis.ttl(_k("cooldown", email))
            raise RateLimitException(ttl)

        sends_key = _k("sends", email)
        sends = await self.redis.incr(sends_key)

        if sends == 1:
            await self.redis.expire(sends_key, 3600)

        if sends > settings.otp_max_sends_per_hour:
            ttl = await self.redis.ttl(sends_key)
            raise RateLimitException(ttl)

        otp = generate_otp()
        pipe = self.redis.pipeline(transaction=True)
        pipe.set(_k("code", email), hash_otp(email, otp), ex=settings.otp_ttl_seconds)
        pipe.delete(_k("attempts", email))
        await pipe.execute()

        return otp

    # Alias for backward compatibility if called as _OtpService__issue
    _OtpService__issue = issue

    async def verify(self, email: str, otp: str) -> VerifyResult:
        email = email.lower().strip()
        res = await self.verify_script(
            keys=[
                _k("code", email),
                _k("attempts", email),
            ],
            args=[
                hash_otp(email, otp),
                settings.otp_max_attempts,
                settings.otp_ttl_seconds,
            ],
        )
        result = VerifyResult(int(res))
        if result == VerifyResult.OK:
            await self.redis.delete(_k("cooldown", email))
        return result


async def get_otp_service(redis: Redis = Depends(create_redis)) -> OtpService:
    return OtpService(redis)
