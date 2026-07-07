"""
Redis 커넥션 싱글턴.

- REDIS_URL 미설정(빈값)이면 None 반환 → 호출측 기능이 조용히 비활성 (로컬/미구성 환경 기본)
- 소켓 타임아웃을 짧게(0.5s) 잡아 Redis 장애가 API 지연으로 전이되지 않게 한다
  (fail-open 처리 자체는 호출측 책임 — app/api/routes/policy/cache.py 참조)
"""
from typing import Optional

import redis

from app.core.config import settings

_client: Optional[redis.Redis] = None


def get_redis() -> Optional[redis.Redis]:
    global _client
    if not settings.REDIS_URL:
        return None
    if _client is None:
        _client = redis.Redis.from_url(
            settings.REDIS_URL,
            decode_responses=True,
            socket_connect_timeout=0.5,
            socket_timeout=0.5,
            health_check_interval=30,
        )
    return _client
