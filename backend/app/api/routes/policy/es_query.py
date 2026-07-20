"""
q 검색의 ES 쿼리 빌더·실행 (프론트 계약 무변경).

⚠ 필터·정렬 의미론은 policy.py의 _apply_base_filters/_apply_sort와 **1:1 동치**여야 한다.
  한쪽만 고치면 ES 경로와 PG 폴백이 다른 결과를 낸다 — tests/test_es_equivalence.py가 검사한다.

- recent + q: 관련도(_score) 우선으로 재해석. FastAPI 기본값이라 '미지정'과 'recent 명시'를
  구분할 수 없고, 프론트는 q와 sort를 병행 전송하지 않는다.
- deadline의 '오늘'은 질의 시점 KST — 색인에 구우면 자정 경계에서 어긋난다.
- 페이지네이션은 from/size 그대로. 버퍼로 채우면 페이지 경계에서 카드가 중복돼 무한스크롤
  key가 충돌한다(짧은 페이지가 중복보다 무해).

설계 근거: workflow/18_feat/phase1_ES도입계획.md 5·8절
"""
from datetime import date
from typing import List, Optional, Tuple

from elasticsearch import Elasticsearch

from app.core.config import settings
from app.api.routes.policy.constants import APLY_PRD_CLOSED

# 검색 대상 필드와 부스트 — 제목 > 키워드 > 중분류 > 본문 (phase1 8절)
_SEARCH_FIELDS = [
    "plcy_nm^3",
    "plcy_nm.ngram^0.5",   # nori 오분절('도전'→'도'삭제 등) 대비 리터럴 부분문자열 안전망(낮은 가중)
    "keywords.text^2",
    "mclsf_nm^1.5",
    "plcy_expln_cn",
    "plcy_sprt_cn",
    "sprvsn_inst_cd_nm",
]


def _sort_clause(sort: str, today_kst: date) -> List[dict]:
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
    # recent: 관련도 우선(재해석), 동점 시 최신순 — q 없는 요청은 ES로 오지 않으므로
    # (policy.py _es_search가 q 없으면 즉시 PG 경로) 여기서는 항상 q가 있는 검색이다.
    return [{"_score": {"order": "desc"}},
            {"first_seen_at": {"order": "desc", "missing": "_last"}}, tiebreak]


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
        # PG: aply_prd_se_cd != CLOSED AND (상시 OR 마감일 NULL OR 마감일 >= KST오늘).
        # PG의 `!=`는 3치 논리로 NULL도 제외하지만 ES must_not term은 missing 문서를
        # 통과시킨다 → exists를 함께 걸어야 동치. '미상=포함'으로 바꾸려면 exists 제거가
        # 아니라 PG를 OR IS NULL로 — 양쪽을 반드시 함께 고칠 것.
        filters.append({"exists": {"field": "aply_prd_se_cd"}})
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
                # 3단어 이하는 전부 필수(AND), 4단어 이상만 75%. 75%만 쓰면 내림 때문에
                # 2·3단어에서 최빈어('지원'·'청년')만으로 매칭되는 구멍이 생긴다
                # (실측: '청년 주거 지원' 1,557 → 201, 1/2/4단어 무영향 — phase12).
                # 값 변경 시 정밀도 재실측 필수.
                "minimum_should_match": "3<75%",
                # fuzziness는 phase12에서 롤백 — 오타 흡수보다 무관어 오탐이 컸다('아이폰' 63→0).
                # 재도입은 search_stats의 실사용 0건 질의 분석 후 판단.
            }}],
            # 정확 문구는 점수 가산만(매칭 조건 아님). 전용 서브필드를 쓰는 이유는 korean_index로
            # 매기면 불용품사 제거가 남긴 위치 간격이 '청년 ? ? 계좌' 같은 와일드카드가 되어
            # 무관 제목을 1위로 올리기 때문(실측: q='청년도약계좌' 정답 5위 → phase17).
            "should": [{"match_phrase": {"plcy_nm.phrase": {"query": q_text, "boost": 5}}}],
            "filter": filters,
        }},
        "sort": _sort_clause(sort, today_kst=today_kst),
        "from": (page - 1) * size,
        "size": size,
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
    # ES 8 클라이언트는 명명 인자를 받는다 — 값은 전부 body에서 유도해 단일 원천을 유지한다.
    res = es.search(
        index=settings.ES_INDEX_ALIAS,
        query=body["query"],
        sort=body["sort"],
        from_=body["from"],
        size=body["size"],
        track_total_hits=body["track_total_hits"],
        source=False,
    )
    hits = res["hits"]
    return [h["_id"] for h in hits["hits"]], hits["total"]["value"]
