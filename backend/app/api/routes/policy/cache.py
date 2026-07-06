"""
정책 응답 캐시 — Redis (fail-open).

정책 데이터는 3일 주기 ingest 배치에서만 변한다. 캐시 초기화 시점(확정 정책):
- ① 매일 KST 00시 — 키에 KST 날짜 포함(자정부터 자연 미스) + TTL을 당일 자정까지로 설정(물리 삭제)
  (응답의 dday/days가 KST 날짜 기준 계산이라 자정 경계에서 반드시 재계산돼야 함)
- ② 3일 주기 수집 실적재 성공 — 버전(pol:ver) bump 1회 → 즉시 전체 무효화
  (SCAN/DEL 불필요, 버려진 구 키는 당일 자정 TTL로 소멸)
- REDIS_URL 미설정·Redis 장애 시 조용히 미적용(fail-open) — 조회는 DB 직행, 서비스 무중단
"""
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

import redis

from app.core.redis import get_redis

logger = logging.getLogger(__name__)

KST = timezone(timedelta(hours=9))  # policy.py와 동일 기준(순환 import 회피 위해 재정의)
VER_KEY = "pol:ver"


def _ttl_to_kst_midnight() -> int:
    # 캐시 물리 수명 = 당일 KST 자정까지 (매일 00시 캐시 초기화 정책)
    now = datetime.now(KST)
    midnight = (now + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
    return max(1, int((midnight - now).total_seconds()))


def _key(kind: str, ver: str, ident: str) -> str:
    return f"pol:{kind}:v{ver}:{datetime.now(KST):%Y%m%d}:{ident}"


def policy_cache_get(kind: str, ident: str) -> Optional[str]:
    """캐시된 응답 JSON 문자열. 미스/비활성/장애 시 None."""
    r = get_redis()
    if r is None:
        return None
    try:
        ver = r.get(VER_KEY) or "0"
        return r.get(_key(kind, ver, ident))
    except redis.RedisError as e:
        logger.warning("정책 캐시 조회 실패(fail-open): %s", e)
        return None


def policy_cache_set(kind: str, ident: str, payload: str) -> None:
    """응답 JSON 문자열 저장. 비활성/장애 시 무동작."""
    r = get_redis()
    if r is None:
        return
    try:
        ver = r.get(VER_KEY) or "0"
        r.set(_key(kind, ver, ident), payload, ex=_ttl_to_kst_midnight())
    except redis.RedisError as e:
        logger.warning("정책 캐시 저장 실패(fail-open): %s", e)


def bump_policy_cache_version() -> bool:
    """정책 캐시 전체 무효화(버전 +1). ingest 실적재 성공 후 호출. 성공 여부 반환."""
    r = get_redis()
    if r is None:
        return False
    try:
        r.incr(VER_KEY)
        return True
    except redis.RedisError as e:
        logger.warning("정책 캐시 버전 bump 실패: %s", e)
        return False
