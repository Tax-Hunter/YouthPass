from datetime import date, datetime
from typing import List, Optional

from pydantic import BaseModel, Field


class PolicyCard(BaseModel):
    plcy_no: str
    plcy_nm: str
    category: Optional[str] = None
    keywords: List[str] = []  # 통제어휘(목록 카드에도 제공)
    region: str
    org: Optional[str] = None
    summary: Optional[str] = None
    benefit: Optional[str] = None
    age_label: str  # 연령 표시(범위/한쪽/무관/확인필요 폴백)
    dday: str
    days: Optional[int] = None
    views: int
    is_always_open: bool
    sprt_arvl_seq_yn: Optional[bool] = None  # 선착순 여부(뱃지)
    apply_end_date: Optional[date] = None
    aply_url_addr: str  # 신청 URL (없으면 온통청년 상세 페이지로 폴백)


class PolicyListResponse(BaseModel):
    total: int
    page: int
    size: int
    items: List[PolicyCard]


class Eligibility(BaseModel):
    # 지원대상 구조화 (각 항목은 의미있을 때만 채워짐 — '제한없음'은 생략)
    age: str                              # 연령 (age_label)
    region: str                           # 거주지역
    income: Optional[str] = None          # 소득 조건
    marriage: Optional[str] = None        # 혼인 (제한없음 생략)
    job: Optional[str] = None             # 취업상태 요건
    education: Optional[str] = None        # 학력 요건
    major: Optional[str] = None            # 전공 요건
    specialization: Optional[str] = None   # 특화분야
    additional: Optional[str] = None       # 추가 자격조건 원문


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
    age_label: str  # 연령 표시 폴백(범위/한쪽/무관/확인필요)
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
    is_active: bool  # 온통청년 현재 목록 여부(FALSE=종료/미제공 — 만료 정책 구분용)
    sprt_arvl_seq_yn: Optional[bool] = None   # 선착순 여부
    sprt_scl_lmt_yn: Optional[bool] = None     # 지원 규모(인원) 제한 여부
    sprt_scl_cnt: Optional[int] = None         # 지원 규모/인원 (0/None=미지정)
    plcy_pvsn_mthd_cd: Optional[str] = None    # 지원 방식 코드
    plcy_pvsn_mthd_nm: Optional[str] = None    # 지원 방식 라벨(프로그램/보조금/바우처 등)

    sprvsn_inst_cd_nm: Optional[str] = None
    aply_url_addr: Optional[str] = None
    views: int
    frst_reg_dt: Optional[datetime] = None
    last_mdfcn_dt: Optional[datetime] = None

    eligibility: Eligibility           # 지원대상 구조화
    target: str                        # 지원대상 조합 문자열(프론트 즉시 호환)

    # 상세 안내 섹션 (raw_data 추출 + placeholder 정제 → 빈값은 None)
    apply_method: Optional[str] = None    # 신청 방법
    documents: Optional[str] = None        # 제출 서류
    screening: Optional[str] = None        # 심사/선정 방법
    etc_notes: Optional[str] = None        # 기타 사항
    oper_inst_nm: Optional[str] = None     # 운영기관명(주관기관과 별개)
    contact: Optional[str] = None          # 문의처/담당 부서
    ref_urls: List[str] = []               # 참고 링크
    biz_period: Optional[str] = None       # 사업 기간(신청기간과 별개)


class ShareCreateRequest(BaseModel):
    plcy_nos: List[str] = Field(min_length=1, max_length=50)  # 공유할 찜 목록(클라이언트 스냅샷)


class ShareCreateResponse(BaseModel):
    share_code: str
    expires_at: datetime
