"""
es_indexer 단위 테스트 — 필드 유도·문서 변환 (DB/ES 불필요).

실행: backend/ 에서  python -m pytest tests/test_es_indexer.py -q
"""
from datetime import date, datetime, timezone

from app.core.es_schema import MAPPINGS
from ingest.es_indexer import _POLICY_FIELDS, _to_doc


def test_policy_fields_derived_from_mappings():
    # 매핑이 단일 진실 원천 — inq_cnt(PolicyStats 출처)만 제외하고 전부 Policy 컬럼
    assert _POLICY_FIELDS == [f for f in MAPPINGS["properties"] if f != "inq_cnt"]
    assert "inq_cnt" not in _POLICY_FIELDS
    assert "plcy_no" in _POLICY_FIELDS


def test_to_doc_maps_all_mapping_fields_exactly():
    # dynamic:strict 매핑과 문서 키가 1:1 — 남거나 빠지면 색인 전체가 실패한다
    row = tuple(f"v_{f}" for f in _POLICY_FIELDS[:-1]) + (None, None)  # 마지막 필드 + inq_cnt
    # apply_end_date/first_seen_at 위치에 실제 날짜형을 배치
    row = list(f"v_{f}" for f in _POLICY_FIELDS) + [7]
    idx_end = _POLICY_FIELDS.index("apply_end_date")
    idx_seen = _POLICY_FIELDS.index("first_seen_at")
    row[idx_end] = date(2026, 12, 31)
    row[idx_seen] = datetime(2026, 6, 26, 3, 48, 35, tzinfo=timezone.utc)
    doc = _to_doc(tuple(row))
    assert set(doc) == set(MAPPINGS["properties"])
    assert doc["inq_cnt"] == 7
    assert doc["apply_end_date"] == "2026-12-31"           # date → ISO 문자열
    assert doc["first_seen_at"].startswith("2026-06-26T")  # datetime → ISO 문자열


def test_to_doc_none_dates_and_missing_inq_cnt():
    row = [None] * len(_POLICY_FIELDS) + [None]  # outer join 미스 → inq_cnt None
    doc = _to_doc(tuple(row))
    assert doc["apply_end_date"] is None
    assert doc["inq_cnt"] == 0  # None → 0 (popular 정렬 missing 처리와 일관)
