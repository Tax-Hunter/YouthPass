"""
Elasticsearch 커넥션 싱글턴.

- ELASTICSEARCH_URL 미설정(빈값)이면 None 반환 → 검색이 PostgreSQL 경로로 동작 (로컬/미구성 환경 기본)
- 타임아웃(ES_TIMEOUT_S, 기본 2s)을 짧게 잡아 ES 장애가 API 지연으로 전이되지 않게 한다
  (fail-open 폴백 자체는 호출측 책임 — app/api/routes/policy/policy.py의 ES 분기 참조)
- 단일 노드 구성이므로 클라이언트 재시도는 끄고(max_retries=0) 실패 즉시 폴백에 맡긴다
"""
from typing import Optional

from elasticsearch import Elasticsearch

from app.core.config import settings

_client: Optional[Elasticsearch] = None


def get_es() -> Optional[Elasticsearch]:
    global _client
    if not settings.ELASTICSEARCH_URL:
        return None
    if _client is None:
        _client = Elasticsearch(
            settings.ELASTICSEARCH_URL,
            request_timeout=settings.ES_TIMEOUT_S,
            max_retries=0,
            retry_on_timeout=False,
        )
    return _client
