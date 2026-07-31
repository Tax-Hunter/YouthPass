"""
model.py — chuncheon_policy ORM (대회 전용, 자기완결).

⚠ app.db.models 에 등록하지 않는다(app/·alembic이 이 모델을 모르게 유지).
   app.db.session.Base를 상속하되, alembic env.py는 app.db.models만 import하므로
   autogenerate에 잡히지 않는다. teardown: chuncheon/ 삭제 + DROP TABLE.
"""
from sqlalchemy import Boolean, Column, Date, DateTime, Integer, SmallInteger, String, Text
from sqlalchemy.dialects.postgresql import ARRAY, JSONB

from app.db.session import Base
from chuncheon import TABLE_NAME


class ChuncheonPolicy(Base):
    __tablename__ = TABLE_NAME
    __table_args__ = {"extend_existing": True}

    # policy 미러 35컬럼
    plcy_no = Column(String(30), primary_key=True)
    plcy_nm = Column(Text, nullable=False)
    plcy_expln_cn = Column(Text)
    plcy_sprt_cn = Column(Text)
    lclsf_nm = Column(Text)
    category = Column(String(20))
    mclsf_nm = Column(Text)
    sprt_trgt_min_age = Column(SmallInteger)
    sprt_trgt_max_age = Column(SmallInteger)
    age_limit_yn = Column(Boolean)
    earn_cnd_se_cd = Column(String(10))
    earn_min_amt = Column(Integer)
    earn_max_amt = Column(Integer)
    mrg_stts_cd = Column(String(10))
    aply_prd_se_cd = Column(String(10))
    is_always_open = Column(Boolean, nullable=False)
    apply_start_date = Column(Date)
    apply_end_date = Column(Date)
    aply_ymd_raw = Column(Text)
    region_sido = Column(ARRAY(Text), nullable=False)
    region_zip = Column(ARRAY(Text), nullable=False)
    is_nationwide = Column(Boolean, nullable=False)
    keywords = Column(ARRAY(Text), nullable=False)
    sprt_arvl_seq_yn = Column(Boolean)
    sprvsn_inst_cd_nm = Column(Text)
    rgtr_inst_cd = Column(String(10))
    aply_url_addr = Column(Text)
    frst_reg_dt = Column(DateTime(timezone=True))
    last_mdfcn_dt = Column(DateTime(timezone=True))
    raw_data = Column(JSONB)
    is_active = Column(Boolean, nullable=False)
    content_hash = Column(String(32))
    first_seen_at = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False)
    updated_at = Column(DateTime(timezone=True), nullable=False)

    # 대회 전용 추가 컬럼
    source = Column(String(20), nullable=False)         # 'chuncheon' | 'youthcenter'
    source_ref = Column(Text)
    region_scope = Column(String(10))                   # 전국 | 강원전역 | 춘천전용 | 춘천
    curated_at = Column(DateTime(timezone=True))
    inq_cnt = Column(Integer, nullable=False)
