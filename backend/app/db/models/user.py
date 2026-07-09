import uuid

from sqlalchemy import Boolean, Column, DateTime, SmallInteger, String, Text
from sqlalchemy.dialects.postgresql import ARRAY, UUID
from sqlalchemy.sql import func

from app.db.session import Base


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    google_id = Column(String(255), unique=True, nullable=False, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    nickname = Column(String(12), nullable=True)
    profile_image = Column(Text, nullable=True)

    # 온보딩 설문 응답
    age = Column(SmallInteger, nullable=True)
    region_city = Column(String(20), nullable=True)
    region_district = Column(String(20), nullable=True)
    employment_status = Column(String(20), nullable=True)
    interests = Column(ARRAY(Text), nullable=True)
    income_level = Column(String(30), nullable=True)
    household_type = Column(String(20), nullable=True)
    notification_enabled = Column(Boolean, nullable=False, default=False)
    terms_agreed = Column(Boolean, nullable=False, default=False)
    survey_completed = Column(Boolean, nullable=False, default=False)

    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())
