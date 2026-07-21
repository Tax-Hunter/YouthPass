"""
검색 관측 로깅 — Redis (fail-open). feat/#16 phase5 원설계의 재적용(feat/#18 ES 전환으로 유실).

목적: 실사용 검색어 빈도·0건율 수집 → msm·동의어·fuzziness(phase12 롤백분 재도입 여부)
튜닝의 데이터 근거. 응답 경로에는 영향 없음.

키(일자별 KST, 보존 90일):
- stat:search:cnt:{yyyymmdd}   — 일 검색 총횟수 (INT)
- stat:search:q:{yyyymmdd}     — 검색어 → 횟수 (ZSET)
- stat:search:zeroq:{yyyymmdd} — 0건 검색어 → 횟수 (ZSET)

기록 규약(원설계 유지):
- record_search는 **캐시 조회 전** 1회 — 히트/미스와 무관하게 빈도가 정확
- record_search_zero는 **미스 경로의 total 확정 후**만 — 같은 검색어의 0건 여부는
  데이터 세대 내 결정적이라 최초 1회면 충분(캐시 히트 시 재기록 불필요)
- q 없는 요청은 기록하지 않는다
- 파이프라인 1왕복, REDIS_URL 미설정/장애 시 무동작(fail-open)

분석(추후): 0건율 ≈ Σ q-ZSET 점수(zeroq 멤버 한정) / cnt — 두 ZSET 조인으로 산출.
"""
import logging
from datetime import datetime, timedelta, timezone

from app.core.redis import get_redis

logger = logging.getLogger(__name__)

KST = timezone(timedelta(hours=9))
_TTL_SECONDS = 90 * 24 * 3600  # 보존 90일


def _day() -> str:
    return f"{datetime.now(KST):%Y%m%d}"


def _norm(q: str) -> str:
    # 연속 공백만 정규화해 동일 질의를 합산 — 형태 차이('월세지원'/'월세 지원')는
    # 서로 다른 실사용 패턴이므로 보존한다.
    return " ".join(q.split())


def record_search(q: str) -> None:
    """검색 요청 1건 기록(총횟수 + 검색어 빈도). 캐시 조회 전에 호출할 것."""
    if not q or not q.strip():
        return
    day, term = _day(), _norm(q)
    # get_redis()도 try 안에서 — 잘못된 REDIS_URL 형식은 RedisError가 아닌 ValueError를
    # 생성자에서 던진다(_es_search의 get_es 취급과 동일 원칙). 이 함수는 캐시 조회보다
    # 먼저 실행되므로 여기서 새면 검색 전체가 500이 된다.
    try:
        r = get_redis()
        if r is None:
            return
        p = r.pipeline(transaction=False)
        p.incr(f"stat:search:cnt:{day}")
        p.expire(f"stat:search:cnt:{day}", _TTL_SECONDS)
        p.zincrby(f"stat:search:q:{day}", 1, term)
        p.expire(f"stat:search:q:{day}", _TTL_SECONDS)
        p.execute()
    except Exception as e:  # 관측은 어떤 이유로도 응답 경로를 막지 않는다(fail-open)
        logger.warning("검색 관측 기록 실패 — fail-open: %s: %s", type(e).__name__, e)


def record_search_zero(q: str) -> None:
    """0건 검색어 기록. 미스 경로에서 total==0 확정 후 호출할 것.

    호출측 책임: **필터가 걸리지 않은 순수 텍스트 질의에서만** 호출한다. 필터(지역·연령·
    코드 등) 때문에 0건이 된 질의를 여기 넣으면 "텍스트가 안 맞아서 0건"이라는 이 지표의
    의미가 오염되고, 동의어·fuzziness 재도입 판단 근거가 왜곡된다.
    """
    if not q or not q.strip():
        return
    day, term = _day(), _norm(q)
    try:
        r = get_redis()
        if r is None:
            return
        p = r.pipeline(transaction=False)
        p.zincrby(f"stat:search:zeroq:{day}", 1, term)
        p.expire(f"stat:search:zeroq:{day}", _TTL_SECONDS)
        p.execute()
    except Exception as e:  # fail-open (record_search와 동일)
        logger.warning("0건 검색 관측 기록 실패 — fail-open: %s: %s", type(e).__name__, e)
