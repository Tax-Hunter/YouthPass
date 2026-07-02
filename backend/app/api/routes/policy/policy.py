from datetime import date
from typing import List, Optional, Tuple

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import and_, func, or_
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import get_db
from app.db.models import Policy, PolicyStats, Code
from app.schemas.policy import Eligibility, PolicyCard, PolicyDetail, PolicyListResponse
from app.api.routes.policy.constants import (
    APLY_PRD_CLOSED,
    CATEGORY_FALLBACK,
    CODE_FILTERS,
    RAW_PLACEHOLDERS,
    REQ_NOLIMIT,
    SIDO_LABELS,
)

router = APIRouter(prefix="/policy", tags=["policy"])


    # raw_data 원문에서 빈값/placeholder는 None으로
def _clean(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    v = value.strip()
    return v if v and v.lower() not in RAW_PLACEHOLDERS else None

   # 참고 URL에 스킴 없으면 https:// 보정
def _norm_url(value: Optional[str]) -> Optional[str]:
    u = _clean(value)
    if not u:
        return None
    return u if u.lower().startswith("http") else f"https://{u}"


def _fmt_ymd(value: Optional[str]) -> Optional[str]:
    # "20260918" → "2026.09.18"
    s = _clean(value)
    if not s or len(s) != 8 or not s.isdigit():
        return None
    return f"{s[:4]}.{s[4:6]}.{s[6:]}"


def _biz_period(bgn: Optional[str], end: Optional[str]) -> Optional[str]:
    b = _fmt_ymd(bgn)
    e = "별도 공고" if _clean(end) == "29991231" else _fmt_ymd(end)
    if b and e:
        return f"{b} ~ {e}"
    if b:
        return f"{b} ~"
    if e:
        return f"~ {e}"
    return None


def _apply_url(aply_url_addr: Optional[str], plcy_no: str) -> str:
    # DB에 신청 URL이 있으면 그대로, 없으면 온통청년 정책 상세 페이지로 폴백
    if aply_url_addr and aply_url_addr.strip():
        return aply_url_addr
    return f"{settings.YTH_DETAIL_URL_BASE}/{plcy_no}"


def _code_labels(db: Session, *codes: Optional[str]) -> dict:
    # 주어진 코드값들의 한글 라벨을 code 테이블에서 조회 (미정의/미적재 시 키 없음)
    wanted = {c for c in codes if c}
    if not wanted:
        return {}
    rows = db.query(Code.cd, Code.cd_nm).filter(Code.cd.in_(wanted)).all()
    return {cd: nm for cd, nm in rows}


def _region_label(is_nationwide: bool, region_sido: Optional[List[str]]) -> str:
    if is_nationwide:
        return "전국 공통"
    labels = [SIDO_LABELS.get(c, c) for c in (region_sido or [])]
    if not labels:
        return "-"
    if len(labels) <= 2:
        return ", ".join(labels)
    return f"{labels[0]} 외 {len(labels) - 1}곳"


def _dday(
    aply_prd_se_cd: Optional[str],
    is_always_open: bool,
    apply_end_date: Optional[date],
) -> Tuple[str, Optional[int]]:
    # 마감코드(0057003)를 최우선 판정 — is_always_open 재오염(마감인데 TRUE)에도 방어
    if aply_prd_se_cd == APLY_PRD_CLOSED:
        return "마감", None
    if is_always_open:
        return "상시모집", None
    if apply_end_date is None:
        return "미정", None
    days = (apply_end_date - date.today()).days
    if days < 0:
        return "마감", days
    if days == 0:
        return "D-DAY", days
    return f"D-{days}", days


def _age_label(
    min_age: Optional[int],
    max_age: Optional[int],
    age_limit_yn: Optional[bool],
) -> str:
    # 연령 표시 폴백 4분기: 범위 / 한쪽 경계 / 무관 / 확인필요
    if min_age is not None and max_age is not None:
        return f"만 {min_age}~{max_age}세"
    if min_age is not None:
        return f"만 {min_age}세 이상"
    if max_age is not None:
        return f"만 {max_age}세 이하"
    # 연령값 양쪽 없음 — 제한여부로 분기
    if age_limit_yn:
        return "연령 조건 상세 확인"  # 제한 있다 표기됐으나 값 없음(모순) → 무관 단정 금지
    return "연령 무관"


def _income_label(
    cd: Optional[str], min_amt: Optional[int], max_amt: Optional[int], earn_etc: Optional[str]
) -> Optional[str]:
    if cd is None:
        return None
    if cd == "0043001":  # 소득 무관
        return "소득 무관"
    etc = _clean(earn_etc)
    if cd == "0043002":  # 연소득
        if max_amt:
            if min_amt:
                return f"연소득 {min_amt:,}~{max_amt:,}만원"
            return f"연소득 {max_amt:,}만원 이하"
        return etc or "연소득 조건 있음"
    # 0043003 기타
    return etc or "기타 소득조건"


def _req_label(code_map: dict, raw_value: Optional[str], nolimit_cd: str) -> Optional[str]:
    # 콤마 다중 코드 → 라벨. 제한없음 단독/미매핑이면 None
    if not raw_value or not str(raw_value).strip():
        return None
    cds = [c.strip() for c in str(raw_value).split(",") if c.strip() and c.strip() != nolimit_cd]
    labels = [code_map[c] for c in cds if c in code_map]
    return ", ".join(labels) if labels else None


def _compose_target(e: Eligibility) -> str:
    # None 아닌 항목만 "• 라벨: 값" 줄로 조합
    rows = [
        ("연령", e.age), ("거주지역", e.region), ("소득", e.income), ("혼인", e.marriage),
        ("취업상태", e.job), ("학력", e.education), ("전공", e.major),
        ("특화분야", e.specialization), ("추가 자격", e.additional),
    ]
    return "\n".join(f"• {k}: {v}" for k, v in rows if v)


def _to_card(p: Policy, inq_cnt: Optional[int] = None) -> PolicyCard:
    label, days = _dday(p.aply_prd_se_cd, p.is_always_open, p.apply_end_date)
    return PolicyCard(
        plcy_no=p.plcy_no,
        plcy_nm=p.plcy_nm,
        category=p.category or CATEGORY_FALLBACK,
        keywords=p.keywords or [],
        region=_region_label(p.is_nationwide, p.region_sido),
        org=p.sprvsn_inst_cd_nm,
        summary=p.plcy_expln_cn or p.plcy_sprt_cn,
        benefit=p.plcy_sprt_cn or p.plcy_expln_cn,
        age_label=_age_label(p.sprt_trgt_min_age, p.sprt_trgt_max_age, p.age_limit_yn),
        dday=label,
        days=days,
        views=inq_cnt or 0,
        is_always_open=p.is_always_open,
        sprt_arvl_seq_yn=p.sprt_arvl_seq_yn,
        apply_end_date=p.apply_end_date,
        aply_url_addr=_apply_url(p.aply_url_addr, p.plcy_no),
    )


# ── /get/policies(목록)·/get/search(코드검색) 공용 필터·정렬 헬퍼 ──
def _norm_codes(values: Optional[List[str]], grp: str) -> List[str]:
    # 반복(?job=A&job=B)·콤마(?job=A,B) 혼용을 콤마로 합쳐 한 번에 평탄화
    # → 형식검증(7자리·그룹접두어) + 순서보존 중복제거.
    # FastAPI가 '?job='를 ['']로 넘겨도 strip 후 걸러져 빈 리스트가 됨(LIKE '%%' 전건매칭 방지).
    if not values:
        return []
    out: List[str] = []
    seen = set()
    for c in ",".join(str(v) for v in values).split(","):
        c = c.strip()
        if len(c) == 7 and c.isdigit() and c.startswith(grp) and c not in seen:
            seen.add(c)
            out.append(c)
    return out


def _apply_base_filters(q, *, category, keywords, sido, age, applicable):
    # 목록/검색이 공유하는 기본 필터(분류·키워드·지역·연령·신청가능)
    if category:
        q = q.filter(Policy.category.in_(category))
    if keywords:
        q = q.filter(Policy.keywords.overlap(keywords))
    if sido:
        q = q.filter(or_(Policy.is_nationwide.is_(True),
                         Policy.region_sido.contains([sido])))
    if age is not None:
        q = q.filter(and_(
            or_(Policy.sprt_trgt_min_age.is_(None), Policy.sprt_trgt_min_age <= age),
            or_(Policy.sprt_trgt_max_age.is_(None), Policy.sprt_trgt_max_age >= age),
        ))
    if applicable:
        # 마감(0057003) 제외 후, 상시 OR 마감일 미상 OR 마감 전
        q = q.filter(
            Policy.aply_prd_se_cd != APLY_PRD_CLOSED,
            or_(
                Policy.is_always_open.is_(True),
                Policy.apply_end_date.is_(None),
                Policy.apply_end_date >= date.today(),
            ),
        )
    return q


    # 코드 8종 필터. 정규화 결과가 빈 것은 무제약. 차원 내 OR, 차원 간 AND.
def _apply_code_filters(q, code_params: dict):
    for key, spec in CODE_FILTERS.items():
        codes = code_params.get(key) or []
        if not codes:
            continue
        raw_key, nolimit, source = spec["raw_key"], spec["nolimit"], spec["source"]
        eff = codes + ([nolimit] if nolimit else [])  # 제한없음/무관 자동 포함
        if source == "raw_multi":
            # raw_data 콤마 문자열 → 경계보호(',값,')로 정확 토큰 매칭(부분매칭 오탐 방지)
            hay = func.concat(",", func.coalesce(Policy.raw_data[raw_key].astext, ""), ",")
            q = q.filter(or_(*[hay.like(f"%,{c},%") for c in eff]))
        elif source == "raw_single":
            q = q.filter(Policy.raw_data[raw_key].astext.in_(codes))
        else:  # column
            q = q.filter(getattr(Policy, raw_key).in_(eff))
    return q


    # 정렬: popular=조회수순 / deadline=마감임박순 / recent=최신 인지순. 동점은 plcy_no로 안정정렬.
def _apply_sort(q, sort: str):
    if sort == "popular":
        return q.order_by(PolicyStats.inq_cnt.desc().nullslast(), Policy.plcy_no.desc())
    if sort == "deadline":
        return q.order_by(Policy.apply_end_date.asc().nullslast(), Policy.plcy_no.desc())
    return q.order_by(Policy.first_seen_at.desc().nullslast(), Policy.plcy_no.desc())


@router.get("/get/policies", response_model=PolicyListResponse)
def list_policies(
    db: Session = Depends(get_db),
    category: Optional[List[str]] = Query(default=None, description="카테고리(다중)"),
    keywords: Optional[List[str]] = Query(default=None, description="키워드(다중, 하나라도 포함)"),
    sido: Optional[str] = Query(default=None, description="시도코드(전국 OR 해당 시도)"),
    age: Optional[int] = Query(default=None, ge=0, description="나이(경계 포함 비교)"),
    applicable: bool = Query(default=False, description="신청 가능한 것만"),
    sort: str = Query(default="recent", pattern="^(popular|deadline|recent)$"),
    page: int = Query(default=1, ge=1),
    size: int = Query(default=20, ge=1, le=100),
):
    q = (
        db.query(Policy, PolicyStats.inq_cnt)
        .outerjoin(PolicyStats, PolicyStats.plcy_no == Policy.plcy_no)
        .filter(Policy.is_active.is_(True))
    )
    q = _apply_base_filters(q, category=category, keywords=keywords,
                            sido=sido, age=age, applicable=applicable)

    total = q.count()
    q = _apply_sort(q, sort)
    rows = q.offset((page - 1) * size).limit(size).all()
    return PolicyListResponse(
        total=total, page=page, size=size,
        items=[_to_card(p, inq_cnt) for p, inq_cnt in rows],
    )


@router.get("/get/search", response_model=PolicyListResponse)
def search_policies(
    db: Session = Depends(get_db),
    # ── 코드 필터(신규, 콤마/반복 다중 = 차원 내 OR) ──
    pvsn_method: Optional[List[str]] = Query(default=None, description="지원방식 코드(0042, 다중)"),
    job: Optional[List[str]] = Query(default=None, description="취업상태 코드(0013, 다중)"),
    school: Optional[List[str]] = Query(default=None, description="학력 코드(0049, 다중)"),
    major: Optional[List[str]] = Query(default=None, description="전공 코드(0011, 다중)"),
    sbiz: Optional[List[str]] = Query(default=None, description="특화분야 코드(0014, 다중)"),
    inst_group: Optional[List[str]] = Query(default=None, description="제공기관 코드(0054 중앙/지자체, 다중)"),
    income: Optional[List[str]] = Query(default=None, description="소득조건 코드(0043, 다중)"),
    marriage: Optional[List[str]] = Query(default=None, description="혼인 코드(0055, 다중)"),
    # ── 기존 필터 계승 ──
    category: Optional[List[str]] = Query(default=None, description="카테고리(다중)"),
    keywords: Optional[List[str]] = Query(default=None, description="키워드(다중, 하나라도 포함)"),
    sido: Optional[str] = Query(default=None, description="시도코드(전국 OR 해당 시도)"),
    age: Optional[int] = Query(default=None, ge=0, description="나이(경계 포함 비교)"),
    applicable: bool = Query(default=False, description="신청 가능한 것만"),
    sort: str = Query(default="recent", pattern="^(popular|deadline|recent)$"),
    page: int = Query(default=1, ge=1),
    size: int = Query(default=20, ge=1, le=100),
):
    """코드 기반 정책 검색 — 온통청년 코드 8종 필터 + 기존 필터(연령·지역·분류·키워드·신청가능).
    차원 내 OR·차원 간 AND, 제한없음/무관 자동 포함. 응답은 목록과 동일한 PolicyCard.
    """
    # 코드 필터 정규화(빈/무효 → 차원 드롭). 필터 0개면 활성 전체 반환(= /get/policies 무필터와 동일).
    code_params = {
        k: _norm_codes(v, CODE_FILTERS[k]["grp"])
        for k, v in {
            "pvsn_method": pvsn_method, "job": job, "school": school, "major": major,
            "sbiz": sbiz, "inst_group": inst_group, "income": income, "marriage": marriage,
        }.items()
    }

    q = (
        db.query(Policy, PolicyStats.inq_cnt)
        .outerjoin(PolicyStats, PolicyStats.plcy_no == Policy.plcy_no)
        .filter(Policy.is_active.is_(True))
    )
    q = _apply_base_filters(q, category=category, keywords=keywords,
                            sido=sido, age=age, applicable=applicable)
    q = _apply_code_filters(q, code_params)

    total = q.count()
    q = _apply_sort(q, sort)
    rows = q.offset((page - 1) * size).limit(size).all()
    return PolicyListResponse(
        total=total, page=page, size=size,
        items=[_to_card(p, inq_cnt) for p, inq_cnt in rows],
    )


@router.get("/get/policy/{policy_id}", response_model=PolicyDetail)
def get_policy(policy_id: str, db: Session = Depends(get_db)):
    row = (
        db.query(Policy, PolicyStats.inq_cnt)
        .outerjoin(PolicyStats, PolicyStats.plcy_no == Policy.plcy_no)
        .filter(Policy.plcy_no == policy_id)
        .first()
    )
    if row is None:
        raise HTTPException(status_code=404, detail="policy not found")
    p, inq_cnt = row
    label, days = _dday(p.aply_prd_se_cd, p.is_always_open, p.apply_end_date)
    age_label = _age_label(p.sprt_trgt_min_age, p.sprt_trgt_max_age, p.age_limit_yn)
    region_label = _region_label(p.is_nationwide, p.region_sido)

    # 자격요건 코드(raw_data 보존분) + 단일값 코드 라벨을 1쿼리로 조회
    raw = p.raw_data or {}
    req_raw = {k: raw.get(k) for k in REQ_NOLIMIT}
    req_cds = [
        c.strip()
        for v in req_raw.values() if v
        for c in str(v).split(",") if c.strip()
    ]
    pvsn_cd = _clean(raw.get("plcyPvsnMthdCd"))            # 지원 방식 코드
    scl_cnt_raw = str(raw.get("sprtSclCnt") or "").strip()  # 지원 규모/인원
    labels = _code_labels(db, p.earn_cnd_se_cd, p.mrg_stts_cd, p.aply_prd_se_cd, pvsn_cd, *req_cds)

    eligibility = Eligibility(
        age=age_label,
        region=region_label,
        income=_income_label(p.earn_cnd_se_cd, p.earn_min_amt, p.earn_max_amt, raw.get("earnEtcCn")),
        marriage=(labels.get(p.mrg_stts_cd) if p.mrg_stts_cd and p.mrg_stts_cd != "0055003" else None),
        job=_req_label(labels, req_raw["jobCd"], REQ_NOLIMIT["jobCd"]),
        education=_req_label(labels, req_raw["schoolCd"], REQ_NOLIMIT["schoolCd"]),
        major=_req_label(labels, req_raw["plcyMajorCd"], REQ_NOLIMIT["plcyMajorCd"]),
        specialization=_req_label(labels, req_raw["sbizCd"], REQ_NOLIMIT["sbizCd"]),
        additional=_clean(raw.get("addAplyQlfcCndCn")),
    )
    target = _compose_target(eligibility)

    ref_urls = [u for u in (_norm_url(raw.get("refUrlAddr1")), _norm_url(raw.get("refUrlAddr2"))) if u]
    contact = _clean(raw.get("sprvsnInstPicNm")) or _clean(raw.get("operInstPicNm"))

    return PolicyDetail(
        plcy_no=p.plcy_no,
        plcy_nm=p.plcy_nm,
        category=p.category or CATEGORY_FALLBACK,
        lclsf_nm=p.lclsf_nm,
        mclsf_nm=p.mclsf_nm,
        plcy_expln_cn=p.plcy_expln_cn,
        plcy_sprt_cn=p.plcy_sprt_cn,
        region=region_label,
        region_sido=p.region_sido or [],
        is_nationwide=p.is_nationwide,
        keywords=p.keywords or [],
        sprt_trgt_min_age=p.sprt_trgt_min_age,
        sprt_trgt_max_age=p.sprt_trgt_max_age,
        age_label=age_label,
        earn_cnd_se_cd=p.earn_cnd_se_cd,
        earn_cnd_se_nm=labels.get(p.earn_cnd_se_cd),
        earn_min_amt=p.earn_min_amt,
        earn_max_amt=p.earn_max_amt,
        mrg_stts_cd=p.mrg_stts_cd,
        mrg_stts_nm=labels.get(p.mrg_stts_cd),
        aply_prd_se_cd=p.aply_prd_se_cd,
        aply_prd_se_nm=labels.get(p.aply_prd_se_cd),
        is_always_open=p.is_always_open,
        apply_start_date=p.apply_start_date,
        apply_end_date=p.apply_end_date,
        dday=label,
        days=days,
        is_active=p.is_active,
        sprt_arvl_seq_yn=p.sprt_arvl_seq_yn,
        sprt_scl_lmt_yn={"Y": True, "N": False}.get(raw.get("sprtSclLmtYn")),
        sprt_scl_cnt=int(scl_cnt_raw) if scl_cnt_raw.lstrip("-").isdigit() else None,
        plcy_pvsn_mthd_cd=pvsn_cd,
        plcy_pvsn_mthd_nm=labels.get(pvsn_cd),
        sprvsn_inst_cd_nm=p.sprvsn_inst_cd_nm,
        aply_url_addr=_apply_url(p.aply_url_addr, p.plcy_no),
        views=inq_cnt or 0,
        frst_reg_dt=p.frst_reg_dt,
        last_mdfcn_dt=p.last_mdfcn_dt,
        eligibility=eligibility,
        target=target,
        apply_method=_clean(raw.get("plcyAplyMthdCn")),
        documents=_clean(raw.get("sbmsnDcmntCn")),
        screening=_clean(raw.get("srngMthdCn")),
        etc_notes=_clean(raw.get("etcMttrCn")),
        oper_inst_nm=_clean(raw.get("operInstCdNm")),
        contact=contact,
        ref_urls=ref_urls,
        biz_period=_biz_period(raw.get("bizPrdBgngYmd"), raw.get("bizPrdEndYmd")),
    )
