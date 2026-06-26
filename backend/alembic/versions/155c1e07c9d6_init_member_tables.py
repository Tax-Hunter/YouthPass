"""init full schema (plcy_no PK)

Revision ID: d3f7a2b9c1e4
Revises:
Create Date: 2026-06-26 10:00:00.000000

청년정책 서비스 최종 스키마 단일 생성 마이그레이션.
- policy: plcy_no(자연키) 단일 PK. keywords CHECK 없음. content_hash/first_seen_at 포함.
          변동값(inq_cnt/last_seen_at/synced_at)은 policy_stats로 분리.
- policy_stats: plcy_no PK이자 FK(→policy) 1:1.
- code: cd 단일 PK + grp_cd 비정규화 컬럼. 데이터는 별도 적재(시드 하드코딩 안 함).
- users / bookmarks(plcy_no FK) / refresh_tokens.

code의 earn_cnd_se_cd / mrg_stts_cd / aply_prd_se_cd 는 code.cd를 '논리적으로' 참조하지만
FK 제약은 걸지 않는다(미지 코드 유입 시 LEFT JOIN NULL 폴백).
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = 'd3f7a2b9c1e4'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── policy (plcy_no PK, 내용 + 변경감지) ──
    op.create_table(
        'policy',
        sa.Column('plcy_no', sa.String(length=30), nullable=False),
        sa.Column('plcy_nm', sa.Text(), nullable=False),
        sa.Column('plcy_expln_cn', sa.Text(), nullable=True),
        sa.Column('plcy_sprt_cn', sa.Text(), nullable=True),
        sa.Column('lclsf_nm', sa.Text(), nullable=True),
        sa.Column('category', sa.String(length=20), nullable=True),
        sa.Column('mclsf_nm', sa.Text(), nullable=True),
        sa.Column('sprt_trgt_min_age', sa.SmallInteger(), nullable=True),
        sa.Column('sprt_trgt_max_age', sa.SmallInteger(), nullable=True),
        sa.Column('age_limit_yn', sa.Boolean(), nullable=True),
        sa.Column('earn_cnd_se_cd', sa.String(length=10), nullable=True),
        sa.Column('earn_min_amt', sa.Integer(), nullable=True),
        sa.Column('earn_max_amt', sa.Integer(), nullable=True),
        sa.Column('mrg_stts_cd', sa.String(length=10), nullable=True),
        sa.Column('aply_prd_se_cd', sa.String(length=10), nullable=True),
        sa.Column('is_always_open', sa.Boolean(), server_default=sa.text('false'), nullable=False),
        sa.Column('apply_start_date', sa.Date(), nullable=True),
        sa.Column('apply_end_date', sa.Date(), nullable=True),
        sa.Column('aply_ymd_raw', sa.Text(), nullable=True),
        sa.Column('region_sido', postgresql.ARRAY(sa.Text()), server_default=sa.text("'{}'::text[]"), nullable=False),
        sa.Column('region_zip', postgresql.ARRAY(sa.Text()), server_default=sa.text("'{}'::text[]"), nullable=False),
        sa.Column('is_nationwide', sa.Boolean(), server_default=sa.text('false'), nullable=False),
        sa.Column('keywords', postgresql.ARRAY(sa.Text()), server_default=sa.text("'{}'::text[]"), nullable=False),
        sa.Column('sprt_arvl_seq_yn', sa.Boolean(), nullable=True),
        sa.Column('sprvsn_inst_cd_nm', sa.Text(), nullable=True),
        sa.Column('rgtr_inst_cd', sa.String(length=10), nullable=True),
        sa.Column('aply_url_addr', sa.Text(), nullable=True),
        sa.Column('frst_reg_dt', sa.DateTime(timezone=True), nullable=True),
        sa.Column('last_mdfcn_dt', sa.DateTime(timezone=True), nullable=True),
        sa.Column('raw_data', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default=sa.text('true'), nullable=False),
        # content_hash: nullable → 동기화 UPSERT 시 build_doc()로 채움(변경감지, 변동값 제외)
        sa.Column('content_hash', sa.String(length=32), nullable=True),
        sa.Column('first_seen_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.CheckConstraint(
            'apply_start_date IS NULL OR apply_end_date IS NULL OR apply_start_date <= apply_end_date',
            name='ck_policy_apply_range'),
        sa.CheckConstraint(
            'sprt_trgt_min_age IS NULL OR sprt_trgt_max_age IS NULL OR sprt_trgt_min_age <= sprt_trgt_max_age',
            name='ck_policy_age_range'),
        sa.PrimaryKeyConstraint('plcy_no', name='policy_pkey'),
    )
    op.create_index('idx_policy_zip', 'policy', ['region_zip'], unique=False, postgresql_using='gin')
    op.create_index('idx_policy_sido', 'policy', ['region_sido'], unique=False, postgresql_using='gin')
    op.create_index('idx_policy_keywords', 'policy', ['keywords'], unique=False, postgresql_using='gin')
    op.create_index('idx_policy_end', 'policy', ['apply_end_date'], unique=False, postgresql_where=sa.text('is_active AND (NOT is_always_open)'))
    op.create_index('idx_policy_category', 'policy', ['category'], unique=False, postgresql_where=sa.text('is_active'))
    op.create_index('idx_policy_age', 'policy', ['sprt_trgt_min_age', 'sprt_trgt_max_age'], unique=False, postgresql_where=sa.text('is_active'))

    # ── policy_stats (변동값 1:1 분리, plcy_no PK+FK) ──
    op.create_table(
        'policy_stats',
        sa.Column('plcy_no', sa.String(length=30), nullable=False),
        sa.Column('inq_cnt', sa.Integer(), server_default=sa.text('0'), nullable=False),
        sa.Column('last_seen_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('synced_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['plcy_no'], ['policy.plcy_no'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('plcy_no', name='policy_stats_pkey'),
    )
    op.create_index('idx_policy_stats_inq', 'policy_stats', [sa.text('inq_cnt DESC')], unique=False)

    # ── code (cd 단일 PK + grp_cd 비정규화, 데이터는 별도 적재) ──
    op.create_table(
        'code',
        sa.Column('cd', sa.String(length=7), nullable=False),
        sa.Column('grp_cd', sa.String(length=20), nullable=False),
        sa.Column('cd_nm', sa.String(length=100), nullable=False),
        sa.PrimaryKeyConstraint('cd', name='code_pkey'),
    )
    op.create_index('ix_code_grp', 'code', ['grp_cd'], unique=False)

    # ── users ──
    op.create_table(
        'users',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('google_id', sa.String(length=255), nullable=False),
        sa.Column('email', sa.String(length=255), nullable=False),
        sa.Column('nickname', sa.String(length=10), nullable=True),
        sa.Column('profile_image', sa.Text(), nullable=True),
        sa.Column('age', sa.SmallInteger(), nullable=True),
        sa.Column('region_city', sa.String(length=20), nullable=True),
        sa.Column('region_district', sa.String(length=20), nullable=True),
        sa.Column('employment_status', sa.String(length=20), nullable=True),
        sa.Column('interests', postgresql.ARRAY(sa.Text()), nullable=True),
        sa.Column('income_level', sa.String(length=30), nullable=True),
        sa.Column('household_type', sa.String(length=20), nullable=True),
        sa.Column('notification_enabled', sa.Boolean(), nullable=False),
        sa.Column('terms_agreed', sa.Boolean(), nullable=False),
        sa.Column('survey_completed', sa.Boolean(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_users_email'), 'users', ['email'], unique=True)
    op.create_index(op.f('ix_users_google_id'), 'users', ['google_id'], unique=True)

    # ── bookmarks (plcy_no FK → policy) ──
    op.create_table(
        'bookmarks',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('plcy_no', sa.String(length=30), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['plcy_no'], ['policy.plcy_no'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'plcy_no', name='uq_bookmarks_user_policy'),
    )
    op.create_index(op.f('ix_bookmarks_user_id'), 'bookmarks', ['user_id'], unique=False)

    # ── refresh_tokens ──
    op.create_table(
        'refresh_tokens',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('token_hash', sa.String(length=255), nullable=False),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_refresh_tokens_token_hash'), 'refresh_tokens', ['token_hash'], unique=True)
    op.create_index(op.f('ix_refresh_tokens_user_id'), 'refresh_tokens', ['user_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_refresh_tokens_user_id'), table_name='refresh_tokens')
    op.drop_index(op.f('ix_refresh_tokens_token_hash'), table_name='refresh_tokens')
    op.drop_table('refresh_tokens')
    op.drop_index(op.f('ix_bookmarks_user_id'), table_name='bookmarks')
    op.drop_table('bookmarks')
    op.drop_index(op.f('ix_users_google_id'), table_name='users')
    op.drop_index(op.f('ix_users_email'), table_name='users')
    op.drop_table('users')
    op.drop_index('ix_code_grp', table_name='code')
    op.drop_table('code')
    op.drop_index('idx_policy_stats_inq', table_name='policy_stats')
    op.drop_table('policy_stats')
    op.drop_index('idx_policy_age', table_name='policy')
    op.drop_index('idx_policy_category', table_name='policy')
    op.drop_index('idx_policy_end', table_name='policy')
    op.drop_index('idx_policy_keywords', table_name='policy')
    op.drop_index('idx_policy_sido', table_name='policy')
    op.drop_index('idx_policy_zip', table_name='policy')
    op.drop_table('policy')