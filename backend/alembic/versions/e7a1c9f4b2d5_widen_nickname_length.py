"""widen users.nickname to 12 chars (2~12자 닉네임 정책 통일)

Revision ID: e7a1c9f4b2d5
Revises: b4e8d21a7f3c
Create Date: 2026-07-06 15:00:00.000000
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = 'e7a1c9f4b2d5'
down_revision: Union[str, None] = 'b4e8d21a7f3c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column(
        "users", "nickname",
        existing_type=sa.String(10),
        type_=sa.String(12),
        existing_nullable=True,
    )


def downgrade() -> None:
    op.alter_column(
        "users", "nickname",
        existing_type=sa.String(12),
        type_=sa.String(10),
        existing_nullable=True,
    )
