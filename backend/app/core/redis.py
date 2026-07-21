"""
Redis 커넥션 싱글턴.

- REDIS_URL 미설정(빈값)이면 None 반환 → 호출측 기능이 조용히 비활성 (로컬/미구성 환경 기본)
- 소켓 타임아웃을 짧게(0.5s) 잡아 Redis 장애가 API 지연으로 전이되지 않게 한다
  (연결·명령 단계의 fail-open 처리는 호출측 책임 — app/api/routes/policy/cache.py 참조)
- URL 형식 오류는 여기서 흡수한다: from_url은 RedisError가 아닌 ValueError를 던지므로
  호출측의 `except RedisError`를 그대로 통과해 500이 된다(실측). 모든 호출자(캐시·검색
  관측)가 fail-open을 원하므로 생성 실패는 None으로 강등하고, 매 요청 재시도를 막기 위해
  실패 상태를 기억한다. 설정 오류가 조용히 묻히지 않도록 최초 1회 error 로그를 남긴다.
"""
import logging
from typing import Optional

import redis

from app.core.config import settings

logger = logging.getLogger(__name__)

_client: Optional[redis.Redis] = None
_init_failed = False


def get_redis() -> Optional[redis.Redis]:
    global _client, _init_failed
    if not settings.REDIS_URL or _init_failed:
        return None
    if _client is None:
        try:
            _client = redis.Redis.from_url(
                settings.REDIS_URL,
                decode_responses=True,
                socket_connect_timeout=0.5,
                socket_timeout=0.5,
                health_check_interval=30,
            )
        except Exception as e:
            _init_failed = True
            logger.error(
                "REDIS_URL 형식 오류 — 캐시·검색 관측 비활성(fail-open): %s: %s",
                type(e).__name__, e)
            return None
    return _client
