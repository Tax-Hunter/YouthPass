"""
validate.py — 적재 직전 검증 게이트 (순수함수, 부작용 없음).

transform 출력 레코드를 무결성·품질 기준으로 검사. **FAIL 총합 0일 때만 적재 허용.**
- DB CHECK 제약(연령/신청기간 역전)을 적재 전에 차단 (과거 11건 사전차단 실적)
- ★ is_always_open == (aply_prd_se_cd=='0057002') 규칙 위반 차단 (마감 888건 오분류 회귀 방지)
- 통제어휘(category 5종 / keyword 17종) 위반 차단
WARN은 차단하지 않는 품질 신호(마감코드인데 마감일 보유, 수집 결손 등).
"""
from collections import Counter
from dataclasses import dataclass, field
from typing import List, Optional

from app.api.routes.policy.constants import (
    APLY_PRD_ALWAYS,
    APLY_PRD_CLOSED,
    SIDO_LABELS,
)
from ingest.errors import IngestError
from ingest.vocab import CATEGORY_VOCAB, KEYWORD_VOCAB

VALID_SIDO = frozenset(SIDO_LABELS.keys())
_CATSET = frozenset(CATEGORY_VOCAB)


class IngestValidationError(IngestError):
    """검증 FAIL — 적재 차단."""


@dataclass
class Issue:
    level: str       # "FAIL" | "WARN"
    check: str
    count: int
    detail: str
    examples: List = field(default_factory=list)


@dataclass
class ValidationReport:
    total: int
    issues: List[Issue] = field(default_factory=list)

    @property
    def fails(self) -> List[Issue]:
        return [i for i in self.issues if i.level == "FAIL"]

    @property
    def warns(self) -> List[Issue]:
        return [i for i in self.issues if i.level == "WARN"]

    @property
    def can_load(self) -> bool:
        return not self.fails

    def summary(self) -> str:
        return (
            f"검증: {self.total}건 / FAIL {len(self.fails)} / WARN {len(self.warns)} "
            f"→ {'적재 가능' if self.can_load else '적재 보류'}"
        )


def _ex(rows, n: int = 5):
    return [r.get("plcy_no") for r in rows[:n]]


def run_validation(records: List[dict], meta: Optional[object] = None) -> ValidationReport:
    rep = ValidationReport(total=len(records))
    if not records:
        rep.issues.append(Issue("FAIL", "empty", 0, "수집/변환 결과 0건 — 적재 시 전체 오만료 위험"))
        return rep

    # 1. plcy_no 빈값/중복
    no_empty = [r for r in records if not r.get("plcy_no")]
    if no_empty:
        rep.issues.append(Issue("FAIL", "plcy_no_empty", len(no_empty), "plcy_no 빈값", _ex(no_empty)))
    dups = [no for no, c in Counter(r.get("plcy_no") for r in records).items() if no and c > 1]
    if dups:
        rep.issues.append(Issue("FAIL", "plcy_no_dup", len(dups), "plcy_no 중복", dups[:5]))

    # 2. plcy_nm 빈값 (NOT NULL)
    nm_empty = [r for r in records if not r.get("plcy_nm")]
    if nm_empty:
        rep.issues.append(Issue("FAIL", "plcy_nm_empty", len(nm_empty), "plcy_nm 빈값", _ex(nm_empty)))

    # 3. category 5종 (None 허용)
    bad = [r for r in records if r.get("category") is not None and r["category"] not in _CATSET]
    if bad:
        rep.issues.append(Issue("FAIL", "category_vocab", len(bad), "category가 5종 외", _ex(bad)))

    # 4. keywords ⊆ 17종
    bad = [r for r in records if not set(r.get("keywords") or ()).issubset(KEYWORD_VOCAB)]
    if bad:
        rep.issues.append(Issue("FAIL", "keyword_vocab", len(bad), "keywords 통제어휘(17) 위반", _ex(bad)))

    # 5. 연령 역전 (ck_policy_age_range)
    bad = [
        r for r in records
        if r.get("sprt_trgt_min_age") is not None and r.get("sprt_trgt_max_age") is not None
        and r["sprt_trgt_min_age"] > r["sprt_trgt_max_age"]
    ]
    if bad:
        rep.issues.append(Issue("FAIL", "age_inverted", len(bad), "연령 min>max (CHECK 제약 위반)", _ex(bad)))

    # 6. 신청기간 역전 (ck_policy_apply_range)
    bad = [
        r for r in records
        if r.get("apply_start_date") and r.get("apply_end_date")
        and r["apply_start_date"] > r["apply_end_date"]
    ]
    if bad:
        rep.issues.append(Issue("FAIL", "date_inverted", len(bad), "신청기간 start>end (CHECK 제약 위반)", _ex(bad)))

    # 7. region_sido 형식 (유효 2자리 시도)
    bad = [r for r in records if any(s not in VALID_SIDO for s in (r.get("region_sido") or ()))]
    if bad:
        rep.issues.append(Issue("FAIL", "region_sido_format", len(bad), "region_sido에 유효하지 않은 시도코드", _ex(bad)))

    # 8. ★ is_always_open == (aply_prd_se_cd=='0057002')
    bad = [r for r in records if bool(r.get("is_always_open")) != (r.get("aply_prd_se_cd") == APLY_PRD_ALWAYS)]
    if bad:
        rep.issues.append(Issue("FAIL", "is_always_open_rule", len(bad),
                                "is_always_open ≠ (aply_prd_se_cd=='0057002')", _ex(bad)))

    # 9. raw_data 보존
    bad = [r for r in records if not isinstance(r.get("raw_data"), dict) or not r["raw_data"]]
    if bad:
        rep.issues.append(Issue("FAIL", "raw_data_missing", len(bad), "raw_data 누락/비dict", _ex(bad)))

    # WARN — 마감(0057003)인데 마감일 보유 (is_always_open 회귀 조기감지 신호)
    closed_with_end = [r for r in records if r.get("aply_prd_se_cd") == APLY_PRD_CLOSED and r.get("apply_end_date")]
    if closed_with_end:
        rep.issues.append(Issue("WARN", "closed_has_enddate", len(closed_with_end),
                                "마감코드인데 마감일 보유(이상 신호)", _ex(closed_with_end)))

    # WARN — 메타 결손/부분수집 (소프트만료 가드 신호)
    if meta is not None and getattr(meta, "tot_count", 0):
        if meta.fetched_count < meta.tot_count:
            rep.issues.append(Issue("WARN", "fetch_shortfall", meta.tot_count - meta.fetched_count,
                                    f"수집 {meta.fetched_count} < totCount {meta.tot_count} (결손)"))
        if getattr(meta, "is_partial", False):
            rep.issues.append(Issue("WARN", "partial_fetch", 0, "부분수집(is_partial) — 소프트만료 스킵 권장"))

    return rep


def assert_loadable(report: ValidationReport) -> None:
    """can_load=False면 적재를 막는다."""
    if not report.can_load:
        names = ", ".join(f"{i.check}({i.count})" for i in report.fails)
        raise IngestValidationError(f"검증 FAIL로 적재 차단: {names}")
