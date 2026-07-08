"""
PG↔ES 동등성 diff 하니스 (통합 테스트 — 실제 DB·ES 필요).

동등성의 정의 (phase5 문서):
- 필터 5종: 텍스트 매칭을 중립화(match_all)했을 때 ES filter절과 PG WHERE절의 plcy_no '집합'이 동일
- 정렬 3종: 동일 필터 집합에 대해 ES sort절과 PG ORDER BY의 '순서열'이 동일 (plcy_no tiebreak 포함)
- q 텍스트 매칭 자체는 비교하지 않는다 — ILIKE와 nori가 다른 것이 도입 목적

검증 충실도: PG 쪽은 테스트용 재구현이 아니라 실제 프로덕션 헬퍼
(_apply_base_filters / _apply_sort)를 그대로 호출한다.

실행 (backend/, ES가 현재 DB로 재색인된 상태에서):
  ELASTICSEARCH_URL=http://127.0.0.1:9200 python -m pytest tests/test_es_equivalence.py -q
ELASTICSEARCH_URL 미설정이면 전체 skip (config default="" 관례).
"""
import pytest

from app.core.config import settings
from app.core.es import get_es
from app.api.routes.policy.es_query import build_search_body
from app.api.routes.policy.policy import _apply_base_filters, _apply_sort, _today_kst
from app.db.models import Policy, PolicyStats
from app.db.session import SessionLocal

pytestmark = pytest.mark.skipif(
    not settings.ELASTICSEARCH_URL,
    reason="ELASTICSEARCH_URL 미설정 — 동등성 하니스는 실제 ES 필요",
)

# 전 행을 한 번에 받기 위한 상한 (현 데이터 ~2.6k, max_result_window 10k 이내)
FETCH_ALL = 5000

# 필터 매트릭스 — 단일 차원 + 교차 조합 (값은 실데이터 어휘: category 5종, sido 2자리, vocab 키워드)
FILTER_CASES = [
    {},
    {"category": ["주거"]},
    {"category": ["주거", "금융"]},
    {"category": ["일자리", "교육", "생활"]},
    {"keywords": ["인턴"]},
    {"keywords": ["장기미취업청년", "교육지원"]},
    {"sido": "11"},
    {"sido": "26"},
    {"sido": "41"},
    {"age": 19},
    {"age": 25},
    {"age": 34},
    {"age": 39},
    {"applicable": True},
    {"category": ["주거"], "sido": "11"},
    {"category": ["주거"], "age": 25, "applicable": True},
    {"sido": "11", "age": 30, "applicable": True},
    {"keywords": ["인턴"], "category": ["일자리"], "applicable": True},
    {"category": ["금융"], "sido": "48", "age": 27},
    {"age": 25, "applicable": True, "sido": "28"},
]

SORT_CASES = [
    (sort, flt)
    for sort in ["recent", "popular", "deadline"]
    for flt in [{}, {"category": ["주거"]}, {"applicable": True, "age": 25}]
]


@pytest.fixture(scope="module")
def db():
    s = SessionLocal()
    yield s
    s.close()


@pytest.fixture(scope="module")
def es():
    return get_es()


def _params(flt):
    return dict(category=flt.get("category"), keywords=flt.get("keywords"),
                sido=flt.get("sido"), age=flt.get("age"),
                applicable=flt.get("applicable", False))


def pg_ids(db, flt, sort=None):
    q = (
        db.query(Policy.plcy_no)
        .outerjoin(PolicyStats, PolicyStats.plcy_no == Policy.plcy_no)
        .filter(Policy.is_active.is_(True))
    )
    q = _apply_base_filters(q, **_params(flt))
    if sort:
        q = _apply_sort(q, sort)
    return [r[0] for r in q.all()]


def es_ids(es, flt, sort=None):
    body = build_search_body(q_text="중립화됨", **_params(flt), sort=sort or "recent",
                             page=1, size=FETCH_ALL, today_kst=_today_kst())
    query = body["query"]
    query["bool"]["must"] = [{"match_all": {}}]  # 텍스트 매칭 중립화 — 필터·정렬만 비교
    query["bool"].pop("should", None)            # phrase 부스트 제거(점수 영향 차단)
    # 집합 비교엔 정렬 불필요, 순서 비교엔 빌더의 sort절 그대로
    # (match_all은 전부 동점이라 recent의 _score 선두는 무해 — 후순위 키가 결정)
    res = es.search(index=settings.ES_INDEX_ALIAS, query=query,
                    sort=body["sort"], size=FETCH_ALL, source=False,
                    track_total_hits=True)
    return [h["_id"] for h in res["hits"]["hits"]]


def test_index_synced_with_db(db, es):
    # 동등성 비교의 전제 — 색인이 현재 DB와 동기 상태인지 canary
    pg_total = db.query(Policy).count()
    es_total = es.count(index=settings.ES_INDEX_ALIAS)["count"]
    assert es_total == pg_total, (
        f"ES({es_total}) != PG({pg_total}) — 먼저 재동기화: python -m ingest.run reindex"
    )


@pytest.mark.parametrize("flt", FILTER_CASES, ids=[repr(c) for c in FILTER_CASES])
def test_filter_set_equivalence(db, es, flt):
    pg = set(pg_ids(db, flt))
    es_ = set(es_ids(es, flt))
    only_pg, only_es = pg - es_, es_ - pg
    assert not only_pg and not only_es, (
        f"필터 {flt} 불일치 — PG에만 {len(only_pg)}건 {sorted(only_pg)[:5]}, "
        f"ES에만 {len(only_es)}건 {sorted(only_es)[:5]}"
    )


@pytest.mark.parametrize("sort,flt", SORT_CASES,
                         ids=[f"{s}|{repr(f)}" for s, f in SORT_CASES])
def test_sort_sequence_equivalence(db, es, sort, flt):
    pg = pg_ids(db, flt, sort=sort)
    es_ = es_ids(es, flt, sort=sort)
    assert pg == es_, (
        f"정렬 {sort} × 필터 {flt} 순서 불일치 — "
        f"첫 차이: {next(((i, a, b) for i, (a, b) in enumerate(zip(pg, es_)) if a != b), '길이차')}"
        f" (PG {len(pg)}건 / ES {len(es_)}건)"
    )
