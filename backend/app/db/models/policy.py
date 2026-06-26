from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    Integer,
    SmallInteger,
    String,
    Text,
    text,
)
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from sqlalchemy.sql import func

from app.db.session import Base


class Policy(Base):
    __tablename__ = "policy"

    plcy_no = Column(String(30), primary_key=True)             # 정책번호(자연키 PK)

    plcy_nm = Column(Text, nullable=False)                     # 정책명
    plcy_expln_cn = Column(Text)                               # 설명
    plcy_sprt_cn = Column(Text)                                # 혜택

    lclsf_nm = Column(Text)                                    # 원본 대분류
    category = Column(String(20))                              # 정규화 5종(필터)
    mclsf_nm = Column(Text)                                    # 중분류

    sprt_trgt_min_age = Column(SmallInteger)                   # 최소연령(0→NULL)
    sprt_trgt_max_age = Column(SmallInteger)                   # 최대연령
    age_limit_yn = Column(Boolean)                             # 연령제한 여부
    earn_cnd_se_cd = Column(String(10))                        # 소득조건(code 참조)
    earn_min_amt = Column(Integer)                             # 만원
    earn_max_amt = Column(Integer)                             # 만원
    mrg_stts_cd = Column(String(10))                           # 혼인상태

    aply_prd_se_cd = Column(String(10))                        # 신청기간구분
    is_always_open = Column(Boolean, nullable=False, server_default=text("false"))
    apply_start_date = Column(Date)                            # 신청 시작
    apply_end_date = Column(Date)                              # 신청 마감(D-day)
    aply_ymd_raw = Column(Text)                                # 신청기간 원문

    region_sido = Column(ARRAY(Text), nullable=False, server_default=text("'{}'"))
    region_zip = Column(ARRAY(Text), nullable=False, server_default=text("'{}'"))
    is_nationwide = Column(Boolean, nullable=False, server_default=text("false"))
    keywords = Column(ARRAY(Text), nullable=False, server_default=text("'{}'"))

    sprt_arvl_seq_yn = Column(Boolean)                         # 선착순
    sprvsn_inst_cd_nm = Column(Text)                           # 주관기관명
    rgtr_inst_cd = Column(String(10))                          # 등록기관코드
    aply_url_addr = Column(Text)                               # 신청 URL

    frst_reg_dt = Column(DateTime(timezone=True))              # 최초등록
    last_mdfcn_dt = Column(DateTime(timezone=True))            # 최종수정

    raw_data = Column(JSONB)                                   # API 원본 전체
    is_active = Column(Boolean, nullable=False, server_default=text("true"))
    content_hash = Column(String(32))                          # 변경감지용 해시
    first_seen_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
