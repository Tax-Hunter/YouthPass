from sqlalchemy import Column, Integer, String, Text, Date, DateTime
from sqlalchemy.sql import func

from app.db.session import Base


class Policy(Base):
    __tablename__ = "policies"

    id = Column(Integer, primary_key=True, index=True)
    policy_id = Column(String, unique=True, index=True, nullable=False)
    title = Column(String, nullable=False)
    category = Column(String)
    region = Column(String)
    target_age_min = Column(Integer)
    target_age_max = Column(Integer)
    employment_status = Column(String)
    benefit = Column(Text)
    description = Column(Text)
    apply_start = Column(Date)
    apply_end = Column(Date)
    apply_url = Column(String)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
