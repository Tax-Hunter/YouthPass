-- ============================================================
-- 청년정책 추천 플랫폼 — 확정 스키마
-- ------------------------------------------------------------
-- 마이그레이션(alembic/versions/155c1e07c9d6_init_member_tables.py)과 1:1 일치.
-- 멱등(IF NOT EXISTS) — 재실행 안전.
-- 실제 DDL 실행은 alembic upgrade head 로 수행한다.
-- ============================================================

-- ── policy : 정책 본문 (plcy_no 자연키 PK) ─────────────────
CREATE TABLE IF NOT EXISTS policy (
    plcy_no              VARCHAR(30)  PRIMARY KEY,             -- 정책번호(자연키 PK)

    plcy_nm              TEXT         NOT NULL,                 -- 정책명
    plcy_expln_cn        TEXT,                                  -- 설명
    plcy_sprt_cn         TEXT,                                  -- 혜택

    lclsf_nm             TEXT,                                  -- 원본 대분류
    category             VARCHAR(20),                           -- 정규화 5종(필터)
    mclsf_nm             TEXT,                                  -- 중분류

    sprt_trgt_min_age    SMALLINT,                              -- 최소연령(0→NULL 정제됨)
    sprt_trgt_max_age    SMALLINT,                              -- 최대연령
    age_limit_yn         BOOLEAN,                               -- 연령제한 여부
    earn_cnd_se_cd       VARCHAR(10),                           -- 소득조건(code 참조)
    earn_min_amt         INTEGER,                               -- 만원
    earn_max_amt         INTEGER,                               -- 만원
    mrg_stts_cd          VARCHAR(10),                           -- 혼인상태

    aply_prd_se_cd       VARCHAR(10),                           -- 신청기간구분
    is_always_open       BOOLEAN      NOT NULL DEFAULT FALSE,   -- 마감일 없는 유형
    apply_start_date     DATE,                                  -- 신청 시작
    apply_end_date       DATE,                                  -- 신청 마감(D-day)
    aply_ymd_raw         TEXT,                                  -- 신청기간 원문

    region_sido          TEXT[]       NOT NULL DEFAULT '{}',    -- 시도코드 배열(광역 필터)
    region_zip           TEXT[]       NOT NULL DEFAULT '{}',    -- 법정동코드 배열(정밀)
    is_nationwide        BOOLEAN      NOT NULL DEFAULT FALSE,   -- 전국대상
    keywords             TEXT[]       NOT NULL DEFAULT '{}',    -- 키워드 배열

    sprt_arvl_seq_yn     BOOLEAN,                               -- 선착순
    sprvsn_inst_cd_nm    TEXT,                                  -- 주관기관명
    rgtr_inst_cd         VARCHAR(10),                           -- 등록기관코드(지자체 식별)
    aply_url_addr        TEXT,                                  -- 신청 URL

    frst_reg_dt          TIMESTAMPTZ,                           -- 최초등록(원본)
    last_mdfcn_dt        TIMESTAMPTZ,                           -- 최종수정(원본)

    raw_data             JSONB,                                 -- API 원본 전체
    is_active            BOOLEAN      NOT NULL DEFAULT TRUE,    -- 소프트 삭제
    content_hash         VARCHAR(32),                           -- 변경감지용 MD5
    first_seen_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),   -- 최초 적재 시각
    created_at           TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at           TIMESTAMPTZ  NOT NULL DEFAULT now(),

    CONSTRAINT ck_policy_age_range CHECK (
        sprt_trgt_min_age IS NULL OR sprt_trgt_max_age IS NULL
        OR sprt_trgt_min_age <= sprt_trgt_max_age),
    CONSTRAINT ck_policy_apply_range CHECK (
        apply_start_date IS NULL OR apply_end_date IS NULL
        OR apply_start_date <= apply_end_date)
);

CREATE INDEX IF NOT EXISTS idx_policy_sido     ON policy USING gin (region_sido);
CREATE INDEX IF NOT EXISTS idx_policy_zip      ON policy USING gin (region_zip);
CREATE INDEX IF NOT EXISTS idx_policy_keywords ON policy USING gin (keywords);
CREATE INDEX IF NOT EXISTS idx_policy_category ON policy (category) WHERE is_active;
CREATE INDEX IF NOT EXISTS idx_policy_age      ON policy (sprt_trgt_min_age, sprt_trgt_max_age) WHERE is_active;
CREATE INDEX IF NOT EXISTS idx_policy_end      ON policy (apply_end_date) WHERE is_active AND NOT is_always_open;

-- ── policy_stats : 변동값 1:1 분리 (매 동기화 갱신) ────────
CREATE TABLE IF NOT EXISTS policy_stats (
    plcy_no      VARCHAR(30)  PRIMARY KEY REFERENCES policy(plcy_no) ON DELETE CASCADE,
    inq_cnt      INTEGER      NOT NULL DEFAULT 0,
    last_seen_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
    synced_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_policy_stats_inq ON policy_stats (inq_cnt DESC);

-- ── code : 코드정의서 (cd 단일 PK) ─────────────────────────
CREATE TABLE IF NOT EXISTS code (
    cd      VARCHAR(7)   PRIMARY KEY,
    grp_cd  VARCHAR(20)  NOT NULL,
    cd_nm   VARCHAR(100) NOT NULL
);

CREATE INDEX IF NOT EXISTS ix_code_grp ON code (grp_cd);

-- ── users ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
    id                   UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    google_id            VARCHAR(255) NOT NULL UNIQUE,
    email                VARCHAR(255) NOT NULL UNIQUE,
    nickname             VARCHAR(10),
    profile_image        TEXT,
    age                  SMALLINT,
    region_city          VARCHAR(20),
    region_district      VARCHAR(20),
    employment_status    VARCHAR(20),
    interests            TEXT[],
    income_level         VARCHAR(30),
    household_type       VARCHAR(20),
    notification_enabled BOOLEAN      NOT NULL DEFAULT FALSE,
    terms_agreed         BOOLEAN      NOT NULL DEFAULT FALSE,
    survey_completed     BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at           TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at           TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- ── bookmarks ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bookmarks (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plcy_no    VARCHAR(30) NOT NULL REFERENCES policy(plcy_no) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_bookmarks_user_policy UNIQUE (user_id, plcy_no)
);

CREATE INDEX IF NOT EXISTS ix_bookmarks_user_id ON bookmarks (user_id);

-- ── refresh_tokens ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash  VARCHAR(255) NOT NULL UNIQUE,
    expires_at  TIMESTAMPTZ  NOT NULL,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_refresh_tokens_user_id    ON refresh_tokens (user_id);
