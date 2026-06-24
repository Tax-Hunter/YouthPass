-- ============================================================
-- 청년정책 추천 플랫폼 — 확정 스키마 (policy + code)
-- ------------------------------------------------------------
-- 클라우드(Railway PostgreSQL 18)에 배포된 확정 상태와 1:1 일치.
-- 멱등(IF NOT EXISTS) — 재실행 안전.
-- ※ policy_requirement·member는 아직 미확정이라 제외한다.
--   (확정 시 이 파일에 추가)
-- ============================================================

-- ── policy : 정책 본문(지역·키워드는 배열로 흡수) ───────────
CREATE TABLE IF NOT EXISTS policy (
    id                   BIGSERIAL    PRIMARY KEY,
    plcy_no              VARCHAR(30)  NOT NULL UNIQUE,          -- 정책번호(자연키, UPSERT)

    plcy_nm              TEXT         NOT NULL,                 -- 정책명
    plcy_expln_cn        TEXT,                                  -- 설명
    plcy_sprt_cn         TEXT,                                  -- 혜택

    lclsf_nm             TEXT,                                  -- 원본 대분류(다중분류 보존)
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
    keywords             TEXT[]       NOT NULL DEFAULT '{}',    -- 키워드 배열(17종)

    sprt_arvl_seq_yn     BOOLEAN,                               -- 선착순
    sprvsn_inst_cd_nm    TEXT,                                  -- 주관기관명
    rgtr_inst_cd         VARCHAR(10),                           -- 등록기관코드(지자체 식별)
    aply_url_addr        TEXT,                                  -- 신청 URL

    inq_cnt              INTEGER      NOT NULL DEFAULT 0,        -- 조회수
    frst_reg_dt          TIMESTAMPTZ,                           -- 최초등록
    last_mdfcn_dt        TIMESTAMPTZ,                           -- 최종수정

    raw_data             JSONB,                                 -- API 원본 전체
    is_active            BOOLEAN      NOT NULL DEFAULT TRUE,    -- 소프트 삭제
    synced_at            TIMESTAMPTZ  NOT NULL DEFAULT now(),   -- 동기화 시각
    created_at           TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at           TIMESTAMPTZ  NOT NULL DEFAULT now(),

    CONSTRAINT ck_policy_age_range CHECK (
        sprt_trgt_min_age IS NULL OR sprt_trgt_max_age IS NULL
        OR sprt_trgt_min_age <= sprt_trgt_max_age),
    CONSTRAINT ck_policy_apply_range CHECK (
        apply_start_date IS NULL OR apply_end_date IS NULL
        OR apply_start_date <= apply_end_date),
    CONSTRAINT ck_policy_keywords_vocab CHECK (keywords <@ ARRAY[
        '교육지원','보조금','맞춤형상담서비스','장기미취업청년','주거지원','중소기업',
        '인턴','바우처','벤처','해외진출','출산','대출','금리혜택','육아',
        '청년가장','공공임대주택','신용회복']::text[])
);

CREATE INDEX IF NOT EXISTS idx_policy_sido     ON policy USING gin (region_sido);
CREATE INDEX IF NOT EXISTS idx_policy_zip      ON policy USING gin (region_zip);
CREATE INDEX IF NOT EXISTS idx_policy_keywords ON policy USING gin (keywords);
CREATE INDEX IF NOT EXISTS idx_policy_category ON policy (category) WHERE is_active;
CREATE INDEX IF NOT EXISTS idx_policy_age      ON policy (sprt_trgt_min_age, sprt_trgt_max_age) WHERE is_active;
CREATE INDEX IF NOT EXISTS idx_policy_end      ON policy (apply_end_date) WHERE is_active AND NOT is_always_open;
CREATE INDEX IF NOT EXISTS idx_policy_inq      ON policy (inq_cnt DESC) WHERE is_active;

-- ── code : 코드정의서(API코드정보.xlsx 적재 예정, 지금은 빈 테이블) ──
CREATE TABLE IF NOT EXISTS code (
    grp_cd      VARCHAR(30)  NOT NULL,                          -- 'jobCd' 등(=req_type)
    cd          VARCHAR(20)  NOT NULL,                          -- 코드값
    cd_nm       VARCHAR(100) NOT NULL,                          -- 한글 라벨
    sort_no     SMALLINT,
    use_yn      BOOLEAN      NOT NULL DEFAULT TRUE,
    PRIMARY KEY (grp_cd, cd)
);
