"""add bookmark_shares table (찜 목록 공유 링크)

Revision ID: f1c3a8d6e9b2
Revises: e7a1c9f4b2d5
Create Date: 2026-07-07 19:00:00.000000

비로그인도 포함해 클라이언트가 들고 있는 plcy_no 목록을 스냅샷으로 저장하고
share_code로 조회하는 공개 공유 기능용 테이블.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = 'f1c3a8d6e9b2'
down_revision: Union[str, None] = 'e7a1c9f4b2d5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'bookmark_shares',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('share_code', sa.String(length=12), nullable=False),
        sa.Column('plcy_nos', postgresql.ARRAY(sa.String()), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(op.f('ix_bookmark_shares_share_code'), 'bookmark_shares', ['share_code'], unique=True)


def downgrade() -> None:
    op.drop_index(op.f('ix_bookmark_shares_share_code'), table_name='bookmark_shares')
    op.drop_table('bookmark_shares')
