"""
api.py — 대회 전용(춘천) 정책 조회 API (기존 app과 분리된 독립 FastAPI 앱).

⚠ 대회/데모 전용. app/·ingest/를 변경하지 않는다. 별도 프로세스로 실행:
     uvicorn chuncheon.api:app --host 0.0.0.0 --port 8001
   재사용: app.db.session(DB)·app.core.config(CORS)만 참조. 스키마·모델·조립은 chuncheon 자체.
   teardown: chuncheon/ 삭제 + DROP TABLE chuncheon_policy.

표시 규칙:
- dedup=True(기본): 대회 2026판(source='chuncheon')이 대체하는 youthcenter 2025판(supersedes)은 숨김.
- applicable=True(기본): 마감 제외 — 진행중(상시·기간 내)·미래공고만 노출. 전체 조회는 applicable=false.
- 신청기간 미상(end NULL·비상시)은 마감 처리: status='마감', 기본 노출에서 제외.
- region_scope/source/category/q 필터, recent/deadline 정렬, 페이지네이션.
"""
from datetime import date, datetime, timedelta, timezone
from typing import List, Optional, Tuple

from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import case, or_
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import get_db
from chuncheon.model import ChuncheonPolicy as CP
from chuncheon.schema import ChuncheonCard, ChuncheonListResponse

KST = timezone(timedelta(hours=9))
CLOSED_CD = "0057003"
LONG_TERM_DAYS = 365  # 마감일이 이 이상 남으면 사업기간 혼입 가능성 → '상시모집' 표기 (phase9)

app = FastAPI(title="Chuncheon Policy API (대회 전용)", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _today() -> date:
    return datetime.now(KST).date()


def _status(p: CP, today: date) -> Tuple[str, Optional[int]]:
    # 마감코드 최우선 → 상시 → 마감일 유무. 미상(end NULL·비상시)은 마감 처리(phase9 결정).
    if p.aply_prd_se_cd == CLOSED_CD:
        return "마감", None
    if p.is_always_open:
        return "상시모집", None
    if p.apply_end_date is None:
        return "마감", None
    days = (p.apply_end_date - today).days
    if days < 0:
        return "마감", days
    if days >= LONG_TERM_DAYS:
        return "상시모집", None  # 비정상 D-day(D-578 등) 노출 방지
    if days == 0:
        return "D-DAY", 0
    return f"D-{days}", days


def _age_label(mn: Optional[int], mx: Optional[int]) -> str:
    if mn is not None and mx is not None:
        return f"만 {mn}~{mx}세"
    if mn is not None:
        return f"만 {mn}세 이상"
    if mx is not None:
        return f"만 {mx}세 이하"
    return "연령 무관"


def _to_card(p: CP, today: date) -> ChuncheonCard:
    status, days = _status(p, today)
    raw = p.raw_data or {}
    return ChuncheonCard(
        plcy_no=p.plcy_no, plcy_nm=p.plcy_nm, category=p.category,
        region_scope=p.region_scope, source=p.source,
        org=p.sprvsn_inst_cd_nm,
        summary=p.plcy_expln_cn or p.plcy_sprt_cn,
        benefit=p.plcy_sprt_cn or p.plcy_expln_cn,
        age_label=_age_label(p.sprt_trgt_min_age, p.sprt_trgt_max_age),
        status=status, days=days,
        apply_start_date=p.apply_start_date, apply_end_date=p.apply_end_date,
        is_always_open=p.is_always_open, views=p.inq_cnt,
        note=raw.get("note"), supersedes=raw.get("supersedes"),
        aply_url_addr=p.aply_url_addr,
    )


def _superseded_nos(db: Session) -> set:
    # 대회 행이 대체(supersedes)하는 youthcenter plcy_no 집합 (dedup 시 숨김 대상)
    rows = db.query(CP.raw_data["supersedes"].astext).filter(
        CP.source == "chuncheon", CP.raw_data.has_key("supersedes")  # noqa: W601
    ).all()
    return {r[0] for r in rows if r[0]}


@app.get("/api/chuncheon/get/health")
def health():
    return {"status": "ok"}


@app.get("/api/chuncheon/get/policies", response_model=ChuncheonListResponse)
def list_policies(
    db: Session = Depends(get_db),
    q_text: Optional[str] = Query(default=None, alias="q", min_length=1, max_length=100),
    category: Optional[List[str]] = Query(default=None),
    region_scope: Optional[List[str]] = Query(default=None, description="전국|강원전역|춘천전용|춘천"),
    source: Optional[str] = Query(default=None, description="chuncheon|youthcenter"),
    applicable: bool = Query(default=True, description="마감 제외(상시·미래 포함, 미상은 마감 처리). 전체 조회는 false"),
    dedup: bool = Query(default=True, description="대체된 youthcenter 2025판 숨김"),
    sort: str = Query(default="recent", pattern="^(recent|deadline|popular)$"),
    page: int = Query(default=1, ge=1),
    size: int = Query(default=20, ge=1, le=100),
):
    today = _today()
    qy = db.query(CP).filter(CP.is_active.is_(True))
    if q_text:
        esc = q_text.strip().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        qy = qy.filter(CP.plcy_nm.ilike(f"%{esc}%", escape="\\"))
    if category:
        qy = qy.filter(CP.category.in_(category))
    if region_scope:
        qy = qy.filter(CP.region_scope.in_(region_scope))
    if source:
        qy = qy.filter(CP.source == source)
    if dedup:
        superseded = _superseded_nos(db)
        if superseded:
            qy = qy.filter(~CP.plcy_no.in_(superseded))
    if applicable:
        qy = qy.filter(
            CP.aply_prd_se_cd.is_distinct_from(CLOSED_CD),
            or_(CP.is_always_open.is_(True),
                CP.apply_end_date >= today),
        )

    total = qy.count()
    if sort == "popular":
        qy = qy.order_by(CP.inq_cnt.desc(), CP.plcy_no.desc())
    elif sort == "deadline":
        # 미래 마감 임박 → 상시/미정(NULL) → 과거 마감
        rank = case((CP.apply_end_date < today, 2), (CP.apply_end_date.is_(None), 1), else_=0)
        qy = qy.order_by(rank.asc(), CP.apply_end_date.asc().nullslast(), CP.plcy_no.desc())
    else:
        # 대회 우선 노출 후 최신
        qy = qy.order_by((CP.source == "chuncheon").desc(), CP.curated_at.desc().nullslast(), CP.plcy_no.desc())

    rows = qy.offset((page - 1) * size).limit(size).all()
    return ChuncheonListResponse(
        total=total, page=page, size=size,
        items=[_to_card(p, today) for p in rows],
    )


@app.get("/api/chuncheon/get/policy/{plcy_no}", response_model=ChuncheonCard)
def get_policy(plcy_no: str, db: Session = Depends(get_db)):
    p = db.query(CP).filter(CP.plcy_no == plcy_no).first()
    if p is None:
        raise HTTPException(status_code=404, detail="policy not found")
    return _to_card(p, _today())
