"""
Code ORM — backend/app/db/schema.sql 의 `code` 테이블(코드정의서)에 매핑.

코드값 → 한글 라벨 마스터. 단일 PK (cd).
(현재는 빈 테이블, API코드정보.xlsx 적재 예정)
"""
from sqlalchemy import Column, String

from app.db.session import Base


class Code(Base):
    __tablename__ = "code"

    cd = Column(String(7), primary_key=True)                 # 코드값 (예: 0054001)
    grp_cd = Column(String(20), nullable=False, index=True)  # API 필드명(earnCndSeCd 등) 비정규화
    cd_nm = Column(String(100), nullable=False)              # 한글 라벨
