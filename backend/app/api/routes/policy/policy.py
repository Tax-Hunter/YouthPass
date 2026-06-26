from datetime import date
from typing import List, Optional, Tuple

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import and_, or_
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.db.models import Policy
from app.schemas.policy import PolicyCard, PolicyDetail, PolicyListResponse

router = APIRouter(prefix="/policy", tags=["policy"])

SIDO_LABELS = {
    "11": "서울", "26": "부산", "27": "대구", "28": "인천", "29": "광주",
    "30": "대전", "31": "울산", "36": "세종", "41": "경기", "43": "충북",
    "44": "충남", "46": "전남", "47": "경북", "48": "경남", "50": "제주",
    "51": "강원", "52": "전북",
}


def _region_label(is_nationwide: bool, region_sido: Optional[List[str]]) -> str:
    if is_nationwide:
        return "전국 공통"
    labels = [SIDO_LABELS.get(c, c) for c in (region_sido or [])]
    if not labels:
        return "-"
    if len(labels) <= 2:
        return ", ".join(labels)
    return f"{labels[0]} 외 {len(labels) - 1}곳"


def _dday(is_always_open: bool, apply_end_date: Optional[date]) -> Tuple[str, Optional[int]]:
    if is_always_open:
        return "상시모집", None
    if apply_end_date is None:
        return "미정", None
    days = (apply_end_date - date.today()).days
    if days < 0:
        return "마감", days
    return f"D-{days}", days


def _to_card(p: Policy) -> PolicyCard:
    label, days = _dday(p.is_always_open, p.apply_end_date)
    return PolicyCard(
        plcy_no=p.plcy_no,
        plcy_nm=p.plcy_nm,
        category=p.category,
        region=_region_label(p.is_nationwide, p.region_sido),
        org=p.sprvsn_inst_cd_nm,
        summary=p.plcy_expln_cn or p.plcy_sprt_cn,
        benefit=p.plcy_sprt_cn or p.plcy_expln_cn,
        dday=label,
        days=days,
        views=0,
        is_always_open=p.is_always_open,
        apply_end_date=p.apply_end_date,
    )


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
    q = db.query(Policy).filter(Policy.is_active.is_(True))

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
        q = q.filter(or_(
            Policy.is_always_open.is_(True),
            Policy.apply_end_date.is_(None),
            Policy.apply_end_date >= date.today(),
        ))

    total = q.count()

    if sort == "popular":
        q = q.order_by(Policy.plcy_no.desc())
    elif sort == "deadline":
        q = q.order_by(Policy.apply_end_date.asc().nullslast(), Policy.plcy_no.desc())
    else:
        q = q.order_by(Policy.first_seen_at.desc().nullslast(), Policy.plcy_no.desc())

    rows = q.offset((page - 1) * size).limit(size).all()
    return PolicyListResponse(
        total=total, page=page, size=size, items=[_to_card(p) for p in rows]
    )


@router.get("/get/policy/{policy_id}", response_model=PolicyDetail)
def get_policy(policy_id: str, db: Session = Depends(get_db)):
    p = db.get(Policy, policy_id)
    if p is None:
        raise HTTPException(status_code=404, detail="policy not found")
    label, days = _dday(p.is_always_open, p.apply_end_date)
    return PolicyDetail(
        plcy_no=p.plcy_no,
        plcy_nm=p.plcy_nm,
        category=p.category,
        lclsf_nm=p.lclsf_nm,
        mclsf_nm=p.mclsf_nm,
        plcy_expln_cn=p.plcy_expln_cn,
        plcy_sprt_cn=p.plcy_sprt_cn,
        region=_region_label(p.is_nationwide, p.region_sido),
        region_sido=p.region_sido or [],
        is_nationwide=p.is_nationwide,
        keywords=p.keywords or [],
        sprt_trgt_min_age=p.sprt_trgt_min_age,
        sprt_trgt_max_age=p.sprt_trgt_max_age,
        earn_cnd_se_cd=p.earn_cnd_se_cd,
        earn_min_amt=p.earn_min_amt,
        earn_max_amt=p.earn_max_amt,
        mrg_stts_cd=p.mrg_stts_cd,
        aply_prd_se_cd=p.aply_prd_se_cd,
        is_always_open=p.is_always_open,
        apply_start_date=p.apply_start_date,
        apply_end_date=p.apply_end_date,
        dday=label,
        days=days,
        sprvsn_inst_cd_nm=p.sprvsn_inst_cd_nm,
        aply_url_addr=p.aply_url_addr,
        views=0,
        frst_reg_dt=p.frst_reg_dt,
        last_mdfcn_dt=p.last_mdfcn_dt,
    )
