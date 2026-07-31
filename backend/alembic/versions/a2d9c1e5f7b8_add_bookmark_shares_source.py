"""add plcy_sources to bookmark_shares (춘천 등 외부 소스 공유 지원)

Revision ID: a2d9c1e5f7b8
Revises: f1c3a8d6e9b2
Create Date: 2026-08-01 05:00:00.000000

공유 검증이 자체 DB(policy) 테이블만 봐서 춘천처럼 별도 소스인 정책은 공유
목록에서 항상 걸러지던 문제(400) 수정의 일부 — plcy_nos와 나란히 각 항목의
출처(policy/chuncheon)를 저장해 소스별로 검증·조회할 수 있게 한다.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = 'a2d9c1e5f7b8'
down_revision: Union[str, None] = 'f1c3a8d6e9b2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'bookmark_shares',
        sa.Column('plcy_sources', postgresql.ARRAY(sa.String()), nullable=True),
    )
    # 기존 행은 전부 policy(온통청년) 소스만 저장되던 시절 데이터이므로 plcy_nos와
    # 동일한 길이로 'policy'를 채워 백필한다.
    op.execute(
        "UPDATE bookmark_shares "
        "SET plcy_sources = array_fill('policy'::varchar, ARRAY[array_length(plcy_nos, 1)])"
    )
    op.alter_column('bookmark_shares', 'plcy_sources', nullable=False)


def downgrade() -> None:
    op.drop_column('bookmark_shares', 'plcy_sources')
