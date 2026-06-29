from datetime import date, datetime
from typing import List, Optional

from pydantic import BaseModel


class PolicyCard(BaseModel):
    plcy_no: str
    plcy_nm: str
    category: Optional[str] = None
    region: str
    org: Optional[str] = None
    summary: Optional[str] = None
    benefit: Optional[str] = None
    dday: str
    days: Optional[int] = None
    views: int
    is_always_open: bool
    apply_end_date: Optional[date] = None
    aply_url_addr: str  # 신청 URL (없으면 온통청년 상세 페이지로 폴백)


class PolicyListResponse(BaseModel):
    total: int
    page: int
    size: int
    items: List[PolicyCard]


class PolicyDetail(BaseModel):
    plcy_no: str
    plcy_nm: str
    category: Optional[str] = None
    lclsf_nm: Optional[str] = None
    mclsf_nm: Optional[str] = None
    plcy_expln_cn: Optional[str] = None
    plcy_sprt_cn: Optional[str] = None

    region: str
    region_sido: List[str]
    is_nationwide: bool
    keywords: List[str]

    sprt_trgt_min_age: Optional[int] = None
    sprt_trgt_max_age: Optional[int] = None
    earn_cnd_se_cd: Optional[str] = None
    earn_cnd_se_nm: Optional[str] = None  # 코드 라벨(code 테이블)
    earn_min_amt: Optional[int] = None
    earn_max_amt: Optional[int] = None
    mrg_stts_cd: Optional[str] = None
    mrg_stts_nm: Optional[str] = None  # 코드 라벨(code 테이블)

    aply_prd_se_cd: Optional[str] = None
    aply_prd_se_nm: Optional[str] = None  # 코드 라벨(code 테이블)
    is_always_open: bool
    apply_start_date: Optional[date] = None
    apply_end_date: Optional[date] = None
    dday: str
    days: Optional[int] = None

    sprvsn_inst_cd_nm: Optional[str] = None
    aply_url_addr: Optional[str] = None
    views: int
    frst_reg_dt: Optional[datetime] = None
    last_mdfcn_dt: Optional[datetime] = None
