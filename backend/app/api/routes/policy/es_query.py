"""
es_query.py — /get/policies q 검색의 ES 쿼리 빌더·실행 (프론트 계약 무변경 전환).

build_search_body는 순수 함수 — ES 없이 단위 검증 가능하며, 필터 의미론은 policy.py의
_apply_base_filters와 1:1 동치여야 한다(ES↔PG 폴백 간 결과 일관성).

정렬 (workflow/18_feat/phase1_ES도입계획.md 결정 5·8절):
- q + recent(기본값): 관련도(_score) 우선으로 재해석 — FastAPI 기본값 때문에 '미지정'과
  'recent 명시'를 구분할 수 없고, 프론트는 q와 sort를 병행 전송하지 않음이 확인됨.
- popular/deadline: 기존 SQL 정렬 의미를 그대로 복제(NULLS LAST + plcy_no DESC tiebreak).
- deadline의 '오늘'은 질의 시점 KST — 색인에 구우면 자정 경계 오차(_apply_sort와 동일 원칙).

페이지네이션: from/size를 정확히 요청 — hydration에서 소프트만료분 탈락 시 짧은 페이지를
허용한다(버퍼로 채우면 페이지 경계에서 카드 중복 → 무한스크롤 key 충돌, 중복보다 짧음이 무해).
total은 track_total_hits로 정확값(2,600건 규모라 비용 없음).
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
        # PG의 `!= CLOSED`는 SQL 3치 논리로 NULL도 제외하지만 ES의 must_not term은
        # missing 문서를 통과시킨다 → exists를 함께 걸어 의미론을 PG와 일치시킨다.
        # (현재 데이터 NULL 0건 — validate에 존재 규칙이 없어 미래 유입 대비 동등성 고정.
        #  '미상=포함'으로 정책을 바꾼다면 ES exists 제거가 아니라 PG를 OR IS NULL로 —
        #  양쪽을 반드시 함께 변경하고 test_es_equivalence로 확인할 것)
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
                # 순수 OR는 다단어 질의 total을 코퍼스 대부분까지 부풀림. 75% 단독은 2단어 질의에서
                # 무력(75%×2=1.5→내림 1 = OR)해 최빈어('지원')만 걸린 노이즈가 대량 유입됨
                # (실측: '월세 지원' 2,425→356건). 3단어도 75%×3=2.25→내림 2라 최빈어 2개
                # ('청년'+'지원')만으로 매칭되는 구멍이 있어(실측: '청년 주거 지원' 1,557건,
                # 3<75% 전환 시 201건·상위 결과 보존·1/2/4단어 무영향 — phase12) 경계를 3으로.
                # → 3단어 이하 전부 필수(AND), 4단어 이상 75%.
                "minimum_should_match": "3<75%",
                # fuzziness는 시험 도입(2026-07-14) 후 롤백(2026-07-20, phase12 실측):
                # 득('월세치원' 5건 흡수) 대비 실('아이폰' 63건 오탐 — 3자 1편집이 '아이'와
                # 매칭)이 크고, nori 2~3자 토큰 구조상 AUTO:4,7 같은 중간값도 무의미.
                # 재도입은 검색 관측 로깅(search_stats)의 실사용 0건 질의 분석 후 판단.
            }}],
            # 정확 문구 일치는 상위 노출 (should = 점수 가산만, 매칭 조건 아님)
            # analyzer 미지정 시 필드 search_analyzer(korean_search=동의어 포함)가 적용돼
            # "정확 문구"가 동의어로 확장·오염된다 → 색인용(동의어 없는) korean_index로 고정.
            "should": [{"match_phrase": {"plcy_nm": {
                "query": q_text, "boost": 5, "analyzer": "korean_index"}}}],
            "filter": filters,
        }},
        "sort": _sort_clause(sort, has_query=True, today_kst=today_kst),
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
