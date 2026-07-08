"""
es_query.py — /get/policies q 검색의 ES 쿼리 빌더·실행 (프론트 계약 무변경 전환).

build_search_body는 순수 함수 — ES 없이 단위 검증 가능하며, 필터 의미론은 policy.py의
_apply_base_filters와 1:1 동치여야 한다(ES↔PG 폴백 간 결과 일관성).

정렬 (workflow/18_feat/phase1_ES도입계획.md 결정 5·8절):
- q + recent(기본값): 관련도(_score) 우선으로 재해석 — FastAPI 기본값 때문에 '미지정'과
  'recent 명시'를 구분할 수 없고, 프론트는 q와 sort를 병행 전송하지 않음이 확인됨.
- popular/deadline: 기존 SQL 정렬 의미를 그대로 복제(NULLS LAST + plcy_no DESC tiebreak).
- deadline의 '오늘'은 질의 시점 KST — 색인에 구우면 자정 경계 오차(_apply_sort와 동일 원칙).

페이지네이션: from/size + 여유분(HYDRATION_BUFFER) — hydration에서 is_active 탈락분 보충.
total은 track_total_hits로 정확값(2,600건 규모라 비용 없음).
"""
from datetime import date
from typing import List, Optional, Tuple

from elasticsearch import Elasticsearch

from app.core.config import settings
from app.api.routes.policy.constants import APLY_PRD_CLOSED

# ES 색인~PG 재조회 사이에 소프트만료된 문서의 탈락 보충용 여유분 (3일 재색인 창에서 ±수건)
HYDRATION_BUFFER = 5

# 검색 대상 필드와 부스트 — 제목 > 키워드 > 중분류 > 본문 (phase1 8절)
_SEARCH_FIELDS = [
    "plcy_nm^3",
    "keywords.text^2",
    "mclsf_nm^1.5",
    "plcy_expln_cn",
    "plcy_sprt_cn",
    "sprvsn_inst_cd_nm",
]


def _sort_clause(sort: str, has_query: bool, today_kst: date) -> List[dict]:
    tiebreak = {"plcy_no": {"order": "desc"}}
    if sort == "popular":
        # PG: PolicyStats.inq_cnt DESC NULLS LAST → plcy_no DESC (policy.py:_apply_sort)
        return [{"inq_cnt": {"order": "desc", "missing": "_last"}}, tiebreak]
    if sort == "deadline":
        # PG: CASE(과거마감=2, NULL=1, 미래=0) ASC → apply_end_date ASC → plcy_no DESC.
        # rank는 질의 시점 KST 날짜로 runtime 계산 (색인 시점 값 사용 금지).
        rank_script = {
            "_script": {
                "type": "number",
                "order": "asc",
                "script": {
                    "source": (
                        "if (doc['apply_end_date'].size() == 0) return 1;"
                        "return doc['apply_end_date'].value.toLocalDate()"
                        ".isBefore(LocalDate.parse(params.today)) ? 2 : 0;"
                    ),
                    "params": {"today": today_kst.isoformat()},
                },
            }
        }
        return [rank_script, {"apply_end_date": {"order": "asc", "missing": "_last"}}, tiebreak]
    # recent: q가 있으면 관련도 우선(재해석), 동점 시 최신순 — q 없는 요청은 ES로 오지 않는다.
    if has_query:
        return [{"_score": {"order": "desc"}},
                {"first_seen_at": {"order": "desc", "missing": "_last"}}, tiebreak]
    return [{"first_seen_at": {"order": "desc", "missing": "_last"}}, tiebreak]


def build_search_body(
    *,
    q_text: str,
    category: Optional[List[str]],
    keywords: Optional[List[str]],
    sido: Optional[str],
    age: Optional[int],
    applicable: bool,
    sort: str,
    page: int,
    size: int,
    today_kst: date,
) -> dict:
    """파라미터 → ES 검색 요청 dict. 필터 의미론은 _apply_base_filters와 1:1 (phase1 8절 변환표)."""
    filters: List[dict] = [{"term": {"is_active": True}}]
    if category:
        filters.append({"terms": {"category": category}})
    if keywords:
        # PG: Policy.keywords.overlap(...) — 배열 교집합 비공(ANY-of) = terms
        filters.append({"terms": {"keywords": keywords}})
    if sido:
        # PG: is_nationwide=TRUE OR region_sido @> [sido] — 전국 정책 항상 포함
        filters.append({"bool": {
            "should": [
                {"term": {"is_nationwide": True}},
                {"term": {"region_sido": sido}},
            ],
            "minimum_should_match": 1,
        }})
    if age is not None:
        # PG: (min IS NULL OR min<=age) AND (max IS NULL OR max>=age) — NULL=무제한, 경계 포함
        filters.append({"bool": {
            "should": [
                {"bool": {"must_not": {"exists": {"field": "sprt_trgt_min_age"}}}},
                {"range": {"sprt_trgt_min_age": {"lte": age}}},
            ],
            "minimum_should_match": 1,
        }})
        filters.append({"bool": {
            "should": [
                {"bool": {"must_not": {"exists": {"field": "sprt_trgt_max_age"}}}},
                {"range": {"sprt_trgt_max_age": {"gte": age}}},
            ],
            "minimum_should_match": 1,
        }})
    if applicable:
        # PG: 마감코드 제외 AND (상시 OR 마감일 NULL OR 마감일 >= KST오늘)
        filters.append({"bool": {"must_not": {"term": {"aply_prd_se_cd": APLY_PRD_CLOSED}}}})
        filters.append({"bool": {
            "should": [
                {"term": {"is_always_open": True}},
                {"bool": {"must_not": {"exists": {"field": "apply_end_date"}}}},
                {"range": {"apply_end_date": {"gte": today_kst.isoformat()}}},
            ],
            "minimum_should_match": 1,
        }})

    return {
        "query": {"bool": {
            "must": [{"multi_match": {
                "query": q_text,
                "type": "best_fields",
                "fields": _SEARCH_FIELDS,
            }}],
            # 정확 문구 일치는 상위 노출 (should = 점수 가산만, 매칭 조건 아님)
            "should": [{"match_phrase": {"plcy_nm": {"query": q_text, "boost": 5}}}],
            "filter": filters,
        }},
        "sort": _sort_clause(sort, has_query=True, today_kst=today_kst),
        "from": (page - 1) * size,
        "size": size + HYDRATION_BUFFER,
        "track_total_hits": True,
    }


def search_policy_ids(
    es: Elasticsearch,
    *,
    q_text: str,
    category: Optional[List[str]],
    keywords: Optional[List[str]],
    sido: Optional[str],
    age: Optional[int],
    applicable: bool,
    sort: str,
    page: int,
    size: int,
    today_kst: date,
) -> Tuple[List[str], int]:
    """ES 검색 실행 → (plcy_no 순서열, 정확한 total). 문서 _id가 plcy_no라 _source 불필요."""
    body = build_search_body(
        q_text=q_text, category=category, keywords=keywords, sido=sido, age=age,
        applicable=applicable, sort=sort, page=page, size=size, today_kst=today_kst,
    )
    res = es.search(
        index=settings.ES_INDEX_ALIAS,
        query=body["query"],
        sort=body["sort"],
        from_=body["from"],
        size=body["size"],
        track_total_hits=True,
        source=False,
    )
    hits = res["hits"]
    return [h["_id"] for h in hits["hits"]], hits["total"]["value"]
