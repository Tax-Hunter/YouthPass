"""add pg_trgm + plcy_nm trigram index (q 텍스트 검색 베이스라인)

Revision ID: b4e8d21a7f3c
Revises: d3f7a2b9c1e4
Create Date: 2026-07-03 15:45:00.000000

/get/policies·/get/search 의 q(정책명 부분일치 검색) 파라미터용.
- pg_trgm 은 PG 13+ trusted extension — 슈퍼유저 없이 설치 가능
- GIN(gin_trgm_ops) 인덱스가 ILIKE '%q%' 를 가속 (PRD 'LIKE 풀스캔 금지' 충족)
- downgrade 는 인덱스만 제거 — extension 은 다른 객체가 쓸 수 있어 보존
"""
from typing import Sequence, Union

from alembic import op

revision: str = 'b4e8d21a7f3c'
down_revision: Union[str, None] = 'd3f7a2b9c1e4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_policy_nm_trgm "
        "ON policy USING gin (plcy_nm gin_trgm_ops)"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS idx_policy_nm_trgm")
