"""add policy_summary table (정책 AI 요약)

Revision ID: a7d2e5f8c3b1
Revises: f1c3a8d6e9b2
Create Date: 2026-07-30 11:30:00.000000

Claude가 배치 생성한 정책 요약(ingest.summarizer)을 저장하는 1:1 수직분할 테이블.
policy 컬럼 확장 대신 별도 테이블: loader._upsert_policy의 전컬럼 SET 특성상 policy에
컬럼을 추가하면 매 동기화 때 덮어써질 위험이 있고, 모델/프롬프트 교체 시 이 테이블만
재생성하도록 격리한다. source_hash != policy.content_hash면 재요약 대상.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = 'a7d2e5f8c3b1'
down_revision: Union[str, None] = 'f1c3a8d6e9b2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'policy_summary',
        sa.Column('plcy_no', sa.String(length=30), nullable=False),
        sa.Column('one_liner', sa.String(length=80), nullable=False),
        sa.Column('benefit', sa.Text(), nullable=True),
        sa.Column('target', sa.Text(), nullable=True),
        sa.Column('how_to_apply', sa.Text(), nullable=True),
        sa.Column('source_hash', sa.String(length=32), nullable=False),
        sa.Column('model', sa.String(length=40), nullable=False),
        sa.Column('generated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('plcy_no'),
        sa.ForeignKeyConstraint(['plcy_no'], ['policy.plcy_no'], ondelete='CASCADE'),
    )


def downgrade() -> None:
    op.drop_table('policy_summary')
