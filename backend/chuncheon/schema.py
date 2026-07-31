"""schema.py — 대회 조회 API 응답 스키마 (자기완결, app.schemas 미의존)."""
from datetime import date
from typing import List, Optional

from pydantic import BaseModel


class ChuncheonCard(BaseModel):
    plcy_no: str
    plcy_nm: str
    category: Optional[str] = None
    region_scope: Optional[str] = None          # 전국 | 강원전역 | 춘천전용 | 춘천
    source: str                                  # chuncheon | youthcenter
    org: Optional[str] = None                    # 주관기관(sprvsn_inst_cd_nm)
    summary: Optional[str] = None                # 설명
    benefit: Optional[str] = None                # 혜택
    age_label: str                               # 연령 표시
    status: str                                  # 마감 | 상시모집 | D-N | 신청기간 미상 | 미정
    days: Optional[int] = None                   # 마감까지 남은 일수(음수=경과)
    apply_start_date: Optional[date] = None
    apply_end_date: Optional[date] = None
    is_always_open: bool
    views: int
    note: Optional[str] = None                   # 신청기간 미상분 근거(raw_data.note)
    supersedes: Optional[str] = None             # 대체한 youthcenter plcy_no
    aply_url_addr: Optional[str] = None


class ChuncheonListResponse(BaseModel):
    total: int
    page: int
    size: int
    items: List[ChuncheonCard]
