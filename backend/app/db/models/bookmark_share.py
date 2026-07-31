import uuid

from sqlalchemy import Column, DateTime, String
from sqlalchemy.dialects.postgresql import ARRAY, UUID
from sqlalchemy.sql import func

from app.db.session import Base


class BookmarkShare(Base):
    __tablename__ = "bookmark_shares"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    share_code = Column(String(12), unique=True, nullable=False, index=True)
    plcy_nos = Column(ARRAY(String), nullable=False)  # 공유 시점 찜 목록 스냅샷(순서 보존)
    plcy_sources = Column(ARRAY(String), nullable=False)  # plcy_nos와 나란히 대응하는 출처(policy/chuncheon)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    expires_at = Column(DateTime(timezone=True), nullable=True)
