"""
bootstrap.py — 대회 전용 테이블 chuncheon_policy 생성/삭제 (alembic 미사용, 독립 실행).

구조: 기존 policy 35컬럼 미러(조회 코드 재사용) + 출처 4컬럼 + 조회수 denormalize 1컬럼.
- policy와 동일 컬럼 → app.schemas.policy.PolicyCard / _to_card 재사용 가능
- 대회 origin 행: 온통청년 전용 코드컬럼(earn/mrg/aply_prd)은 NULL, raw_data엔 문서추출 원문
- inq_cnt: policy_stats를 조인하지 않도록 이 테이블에 비정규화(자기완결)

사용(backend/ 에서):
  python -m chuncheon.bootstrap          # 생성 (IF NOT EXISTS, 멱등)
  python -m chuncheon.bootstrap --drop   # 삭제 (teardown)
"""
import argparse
import sys

from sqlalchemy import text

from app.db.session import engine
from chuncheon import TABLE_NAME

CREATE_SQL = f"""
-- pg_trgm: 정책명 부분일치(정책 검색)용 — 기존 policy가 이미 사용하므로 보통 존재
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS {TABLE_NAME} (
    -- ── policy 35컬럼과 동일 (조회 코드 호환) ──────────────
    plcy_no              VARCHAR(30)  PRIMARY KEY,           -- 온통청년분=원번호 / 대회분=합성키 'CC-2026-NNN'
    plcy_nm              TEXT         NOT NULL,
    plcy_expln_cn        TEXT,
    plcy_sprt_cn         TEXT,
    lclsf_nm             TEXT,
    category             VARCHAR(20),
    mclsf_nm             TEXT,
    sprt_trgt_min_age    SMALLINT,
    sprt_trgt_max_age    SMALLINT,
    age_limit_yn         BOOLEAN,
    earn_cnd_se_cd       VARCHAR(10),                        -- 대회분 NULL
    earn_min_amt         INTEGER,
    earn_max_amt         INTEGER,
    mrg_stts_cd          VARCHAR(10),                        -- 대회분 NULL
    aply_prd_se_cd       VARCHAR(10),                        -- 대회분 NULL
    is_always_open       BOOLEAN      NOT NULL DEFAULT FALSE,
    apply_start_date     DATE,
    apply_end_date       DATE,
    aply_ymd_raw         TEXT,
    region_sido          TEXT[]       NOT NULL DEFAULT '{{}}',
    region_zip           TEXT[]       NOT NULL DEFAULT '{{}}',
    is_nationwide        BOOLEAN      NOT NULL DEFAULT FALSE,
    keywords             TEXT[]       NOT NULL DEFAULT '{{}}',
    sprt_arvl_seq_yn     BOOLEAN,
    sprvsn_inst_cd_nm    TEXT,                               -- 대회분="춘천시 ○○과"
    rgtr_inst_cd         VARCHAR(10),
    aply_url_addr        TEXT,
    frst_reg_dt          TIMESTAMPTZ,
    last_mdfcn_dt        TIMESTAMPTZ,
    raw_data             JSONB,                              -- 대회분=문서추출 원문 JSON / 온통청년분=원 raw_data
    is_active            BOOLEAN      NOT NULL DEFAULT TRUE,
    content_hash         VARCHAR(32),
    first_seen_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
    created_at           TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at           TIMESTAMPTZ  NOT NULL DEFAULT now(),

    -- ── 출처 추적 컬럼 (신규) ──────────────────────────────
    source               VARCHAR(20)  NOT NULL,             -- 'chuncheon' | 'youthcenter'
    source_ref           TEXT,                              -- 대회=원본 파일명 / 온통청년=원 plcy_no
    region_scope         VARCHAR(10),                       -- '춘천' | '강원' | '전국'
    curated_at           TIMESTAMPTZ,                       -- 병합(큐레이션) 시각

    -- ── 조회수 비정규화 (policy_stats 조인 회피, 자기완결) ──
    inq_cnt              INTEGER      NOT NULL DEFAULT 0,

    CONSTRAINT ck_ccpol_age_range CHECK (
        sprt_trgt_min_age IS NULL OR sprt_trgt_max_age IS NULL
        OR sprt_trgt_min_age <= sprt_trgt_max_age),
    CONSTRAINT ck_ccpol_apply_range CHECK (
        apply_start_date IS NULL OR apply_end_date IS NULL
        OR apply_start_date <= apply_end_date),
    CONSTRAINT ck_ccpol_source CHECK (source IN ('chuncheon', 'youthcenter'))
);

-- policy와 동일 인덱스 세트 (조회 패턴 동일)
CREATE INDEX IF NOT EXISTS idx_ccpol_category ON {TABLE_NAME} (category) WHERE is_active;
CREATE INDEX IF NOT EXISTS idx_ccpol_age      ON {TABLE_NAME} (sprt_trgt_min_age, sprt_trgt_max_age) WHERE is_active;
CREATE INDEX IF NOT EXISTS idx_ccpol_end      ON {TABLE_NAME} (apply_end_date) WHERE is_active AND NOT is_always_open;
CREATE INDEX IF NOT EXISTS idx_ccpol_nm_trgm  ON {TABLE_NAME} USING gin (plcy_nm gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_ccpol_sido     ON {TABLE_NAME} USING gin (region_sido);
CREATE INDEX IF NOT EXISTS idx_ccpol_zip      ON {TABLE_NAME} USING gin (region_zip);
CREATE INDEX IF NOT EXISTS idx_ccpol_source   ON {TABLE_NAME} (source, region_scope);
"""

DROP_SQL = f"DROP TABLE IF EXISTS {TABLE_NAME};"


def create() -> None:
    with engine.begin() as conn:
        conn.execute(text(CREATE_SQL))
        cols = conn.execute(text(
            "SELECT count(*) FROM information_schema.columns "
            "WHERE table_schema='public' AND table_name=:t"
        ), {"t": TABLE_NAME}).scalar()
        n = conn.execute(text(f'SELECT count(*) FROM "{TABLE_NAME}"')).scalar()
    print(f"[OK] {TABLE_NAME} 준비 완료 — 컬럼 {cols}개 / 현재 행 {n}건")


def drop() -> None:
    with engine.begin() as conn:
        conn.execute(text(DROP_SQL))
    print(f"[OK] {TABLE_NAME} 삭제 완료")


def main(argv=None) -> int:
    p = argparse.ArgumentParser(prog="chuncheon.bootstrap", description="대회 전용 테이블 생성/삭제")
    p.add_argument("--drop", action="store_true", help="테이블 삭제(teardown)")
    args = p.parse_args(argv)
    drop() if args.drop else create()
    return 0


if __name__ == "__main__":
    sys.exit(main())
