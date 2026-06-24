"""
Code ORM — backend/app/db/schema.sql 의 `code` 테이블(코드정의서)에 매핑.

코드값 → 한글 라벨 마스터. 복합 PK (grp_cd, cd).
(현재는 빈 테이블, API코드정보.xlsx 적재 예정)
"""
from sqlalchemy import Boolean, Column, SmallInteger, String, text

from app.db.session import Base


class Code(Base):
    __tablename__ = "code"

    grp_cd = Column(String(30), primary_key=True)   # 'jobCd' 등(=req_type)
    cd = Column(String(20), primary_key=True)        # 코드값
    cd_nm = Column(String(100), nullable=False)      # 한글 라벨
    sort_no = Column(SmallInteger)
    use_yn = Column(Boolean, nullable=False, server_default=text("true"))
