from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.session import Base


class PolicyStats(Base):
    __tablename__ = "policy_stats"

    plcy_no = Column(
        String(30),
        ForeignKey("policy.plcy_no", ondelete="CASCADE"),
        primary_key=True,
    )
    inq_cnt = Column(Integer, nullable=False, server_default=text("0"))
    last_seen_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    synced_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    policy = relationship("Policy", backref="stats")
