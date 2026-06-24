"""정책 조회 API 응답 스키마 (Pydantic v2)."""
from datetime import date, datetime

from pydantic import BaseModel


class PolicyCard(BaseModel):
    """목록 카드용 요약."""
    id: int
    plcy_no: str
    plcy_nm: str
    category: str | None = None
    region: str                       # 지역 라벨 (전국 공통 / 서울 / 서울 외 N곳)
    org: str | None = None            # 주관기관(sprvsn_inst_cd_nm)
    summary: str | None = None        # 설명(plcy_expln_cn), 없으면 혜택
    benefit: str | None = None        # 혜택(plcy_sprt_cn), 없으면 설명
    dday: str                         # "D-3" / "상시모집" / "마감" / "미정"
    days: int | None = None           # 마감까지 남은 일수(음수=지남)
    views: int                        # inq_cnt
    is_always_open: bool
    apply_end_date: date | None = None


class PolicyListResponse(BaseModel):
    total: int
    page: int
    size: int
    items: list[PolicyCard]


class PolicyDetail(BaseModel):
    """상세용 — 본문 전체(raw_data 제외, 빈 항목은 null)."""
    id: int
    plcy_no: str
    plcy_nm: str
    category: str | None = None
    lclsf_nm: str | None = None
    mclsf_nm: str | None = None
    plcy_expln_cn: str | None = None
    plcy_sprt_cn: str | None = None

    region: str
    region_sido: list[str]
    is_nationwide: bool
    keywords: list[str]

    sprt_trgt_min_age: int | None = None
    sprt_trgt_max_age: int | None = None
    earn_cnd_se_cd: str | None = None
    earn_min_amt: int | None = None
    earn_max_amt: int | None = None
    mrg_stts_cd: str | None = None

    aply_prd_se_cd: str | None = None
    is_always_open: bool
    apply_start_date: date | None = None
    apply_end_date: date | None = None
    dday: str
    days: int | None = None

    sprvsn_inst_cd_nm: str | None = None
    aply_url_addr: str | None = None
    views: int
    frst_reg_dt: datetime | None = None
    last_mdfcn_dt: datetime | None = None
