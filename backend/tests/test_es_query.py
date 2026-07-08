"""
es_query.build_search_body 단위 테스트 — 순수 함수라 ES 인스턴스 불필요.

각 테스트는 phase1 8절 변환표(파라미터 → ES DSL)의 한 행을 검증한다.
실행: backend/ 에서  python -m pytest tests/test_es_query.py -q
"""
from datetime import date

from app.api.routes.policy.constants import APLY_PRD_CLOSED
from app.api.routes.policy.es_query import HYDRATION_BUFFER, build_search_body

TODAY = date(2026, 7, 7)


def body(**over):
    base = dict(q_text="청년", category=None, keywords=None, sido=None, age=None,
                applicable=False, sort="recent", page=1, size=20, today_kst=TODAY)
    base.update(over)
    return build_search_body(**base)


def filters_of(b):
    return b["query"]["bool"]["filter"]


def test_is_active_filter_always_present():
    assert {"term": {"is_active": True}} in filters_of(body())


def test_multi_match_fields_and_boosts():
    must = body()["query"]["bool"]["must"]
    assert len(must) == 1
    mm = must[0]["multi_match"]
    assert mm["query"] == "청년"
    assert "plcy_nm^3" in mm["fields"] and "keywords.text^2" in mm["fields"]


def test_phrase_boost_is_should_not_must():
    # 정확 문구는 점수 가산만 — 매칭 조건이면 형태소 recall 개선이 무효화된다
    b = body()
    assert b["query"]["bool"]["should"][0]["match_phrase"]["plcy_nm"]["boost"] == 5


def test_category_terms():
    assert {"terms": {"category": ["주거", "금융"]}} in filters_of(body(category=["주거", "금융"]))


def test_keywords_overlap_semantics():
    # PG overlap(ANY-of) == terms
    assert {"terms": {"keywords": ["인턴"]}} in filters_of(body(keywords=["인턴"]))


def test_sido_nationwide_or_included():
    f = [x for x in filters_of(body(sido="11")) if "bool" in x][0]["bool"]
    assert {"term": {"is_nationwide": True}} in f["should"]
    assert {"term": {"region_sido": "11"}} in f["should"]
    assert f["minimum_should_match"] == 1


def test_age_null_means_unlimited_both_bounds():
    fs = filters_of(body(age=25))
    age_filters = [x for x in fs if "bool" in x and any(
        "sprt_trgt" in str(s) for s in x["bool"].get("should", []))]
    assert len(age_filters) == 2  # min 조건 + max 조건 (AND)
    for f in age_filters:
        kinds = [list(s.keys())[0] for s in f["bool"]["should"]]
        assert "bool" in kinds and "range" in kinds  # must_not exists(NULL=무제한) OR range


def test_applicable_excludes_closed_and_allows_open_null_future():
    fs = filters_of(body(applicable=True))
    closed = [x for x in fs if "must_not" in x.get("bool", {})
              and "term" in str(x["bool"]["must_not"])]
    assert closed and APLY_PRD_CLOSED in str(closed[0])
    date_f = [x for x in fs if "apply_end_date" in str(x) and "should" in x.get("bool", {})][0]
    assert TODAY.isoformat() in str(date_f)  # '오늘'은 질의 시점 파라미터
    assert {"term": {"is_always_open": True}} in date_f["bool"]["should"]


def test_no_optional_filters_when_params_absent():
    assert filters_of(body()) == [{"term": {"is_active": True}}]


def test_sort_recent_with_query_is_score_first():
    s = body(sort="recent")["sort"]
    assert list(s[0].keys())[0] == "_score"
    assert list(s[-1].keys())[0] == "plcy_no"  # tiebreak 필수 (무한스크롤 중복 방지)


def test_sort_popular_matches_pg_semantics():
    s = body(sort="popular")["sort"]
    assert s[0] == {"inq_cnt": {"order": "desc", "missing": "_last"}}
    assert s[-1] == {"plcy_no": {"order": "desc"}}


def test_sort_deadline_script_uses_query_time_kst():
    s = body(sort="deadline")["sort"]
    script = s[0]["_script"]["script"]
    assert script["params"]["today"] == TODAY.isoformat()
    assert s[0]["_script"]["order"] == "asc"
    assert s[1] == {"apply_end_date": {"order": "asc", "missing": "_last"}}


def test_pagination_from_and_buffer():
    b = body(page=3, size=20)
    assert b["from"] == 40
    assert b["size"] == 20 + HYDRATION_BUFFER
    assert b["track_total_hits"] is True
