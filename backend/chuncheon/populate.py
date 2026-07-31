"""
populate.py — chuncheon_policy 적재 (1회성 스냅샷, 수집 파이프라인 미연결).

⚠ 대회/데모 전용. dev까지만, release 미승격. ingest.run/loader/cron과 무관하게 수동 실행.

적재 소스(출처는 source 컬럼으로 공존 — 중복은 하드삭제하지 않고 표시계층에서 선택):
  1) youthcenter : policy에서 춘천 대상(전국+춘천 zip) 460건 스냅샷 복사 (마감 포함 전부)
  2) chuncheon   : 대회 원본 문서 파싱분 (후속 단계 — TODO)

춘천 대상 필터(정밀, 전수조사 검증): is_active AND (is_nationwide OR '51110' = ANY(region_zip))
  - '51110'(춘천시 법정동 5자리)를 zip에 가진 정책 = 전국(zip 전건 나열) + 춘천전용 + 강원전역
  - sido='51'(강원)로 잡으면 원주·삼척 등 타 시군 39건 오포함 → zip 방식으로 제외

사용(backend/ 에서):
  python -m chuncheon.populate                 # youthcenter 적재(멱등: source='youthcenter' 삭제 후 재적재)
  python -m chuncheon.populate --verify        # 적재 현황만 출력
"""
import argparse
import sys

from sqlalchemy import text

from app.db.session import engine
from chuncheon import TABLE_NAME
from chuncheon.seed_2026 import SEED_2026

# 공고 원문 검증(phase9) 결과 드랍 — 개인 청년 신청 불가 + 신청기간 자리에 사업기간 혼입:
#   직업계고-전문대학 교육과정 연계: 대학(기관)이 공문 제출하는 사업, 실접수 2026.5.13 종료 (NRF 공고)
#   마을기업 육성사업: 주민 5인 이상 출자 법인 신청, 연말 연례 공모 (행안부)
EXCLUDE_PLCY_NO = {
    "20260406005400112497": "직업계고-전문대학 교육과정 연계",
    "20250704005400111154": "마을기업 육성사업",
}

# 춘천 대상 정밀 필터
ELIGIBLE = "p.is_active AND (p.is_nationwide OR '51110' = ANY(p.region_zip))"
CHUN_CNT = "(SELECT count(*) FROM unnest(p.region_zip) z WHERE z LIKE '51110%')"
ZLEN = "coalesce(array_length(p.region_zip, 1), 0)"

# policy 35컬럼 (chuncheon_policy와 컬럼명 동일 → 그대로 SELECT)
POLICY_COLS = [
    "plcy_no", "plcy_nm", "plcy_expln_cn", "plcy_sprt_cn", "lclsf_nm", "category", "mclsf_nm",
    "sprt_trgt_min_age", "sprt_trgt_max_age", "age_limit_yn",
    "earn_cnd_se_cd", "earn_min_amt", "earn_max_amt", "mrg_stts_cd",
    "aply_prd_se_cd", "is_always_open", "apply_start_date", "apply_end_date", "aply_ymd_raw",
    "region_sido", "region_zip", "is_nationwide", "keywords",
    "sprt_arvl_seq_yn", "sprvsn_inst_cd_nm", "rgtr_inst_cd", "aply_url_addr",
    "frst_reg_dt", "last_mdfcn_dt", "raw_data", "is_active", "content_hash",
    "first_seen_at", "created_at", "updated_at",
]


def load_youthcenter() -> None:
    """policy → chuncheon_policy: 춘천 대상 460건 스냅샷 (source='youthcenter'). 멱등."""
    p_cols = ", ".join(f"p.{c}" for c in POLICY_COLS)
    insert_cols = ", ".join(POLICY_COLS)
    region_scope = (
        f"CASE WHEN p.is_nationwide THEN '전국' "
        f"WHEN {CHUN_CNT} = {ZLEN} THEN '춘천전용' "
        f"ELSE '강원전역' END"
    )
    sql = f"""
    DELETE FROM {TABLE_NAME} WHERE source = 'youthcenter';
    INSERT INTO {TABLE_NAME} (
        {insert_cols},
        source, source_ref, region_scope, curated_at, inq_cnt
    )
    SELECT
        {p_cols},
        'youthcenter'        AS source,
        p.plcy_no            AS source_ref,
        {region_scope}       AS region_scope,
        now()                AS curated_at,
        coalesce(s.inq_cnt, 0) AS inq_cnt
    FROM policy p
    LEFT JOIN policy_stats s ON s.plcy_no = p.plcy_no
    WHERE {ELIGIBLE}
      AND p.plcy_no NOT IN ({", ".join(f"'{no}'" for no in EXCLUDE_PLCY_NO)});
    """
    with engine.begin() as conn:
        conn.execute(text(sql))


def load_chuncheon() -> None:
    """대회 원본 시드(23건) → chuncheon_policy (source='chuncheon'). 멱등."""
    import json
    rows = []
    for s in SEED_2026:
        raw = {"source_doc": "2026 청년정책 단위사업별 사업계획서", "부서": s["org"]}
        if s.get("note"):
            raw["note"] = s["note"]               # 신청기간 미상분의 사업기간/모집시기 근거
        if s.get("supersedes"):
            raw["supersedes"] = s["supersedes"]   # 대체하는 youthcenter 2025판(표시계층 dedup 근거)
        rows.append({
            "plcy_no": s["no"], "plcy_nm": s["nm"], "category": s["cat"], "org": s["org"],
            "min_age": s["min_age"], "max_age": s["max_age"],
            "benefit": s["benefit"], "expln": s["expln"],
            "start": s["start"], "end": s["end"], "always": s["always"],
            "url": s.get("url"),                    # 공고에서 확인된 신청 URL(없으면 None)
            "earn": s.get("earn"),                  # 소득조건 코드(신규는 규칙추출, 중복은 enrich)
            "keywords": s.get("keywords") or [],    # 통제어휘(신규는 규칙추출, 중복은 enrich)
            "region_sido": ["51"], "region_zip": ["51110"],
            "raw_data": json.dumps(raw, ensure_ascii=False),
        })
    insert = f"""
    INSERT INTO {TABLE_NAME} (
        plcy_no, plcy_nm, category, sprvsn_inst_cd_nm,
        sprt_trgt_min_age, sprt_trgt_max_age, plcy_sprt_cn, plcy_expln_cn,
        apply_start_date, apply_end_date, is_always_open, aply_url_addr,
        earn_cnd_se_cd, keywords, region_sido, region_zip, is_nationwide,
        source, source_ref, region_scope, curated_at, inq_cnt, raw_data
    ) VALUES (
        :plcy_no, :plcy_nm, :category, :org,
        :min_age, :max_age, :benefit, :expln,
        CAST(:start AS date), CAST(:end AS date), :always, :url,
        :earn, :keywords, :region_sido, :region_zip, FALSE,
        'chuncheon', '2026 청년정책 단위사업별 사업계획서', '춘천', now(), 0,
        CAST(:raw_data AS jsonb)
    )
    """
    with engine.begin() as conn:
        conn.execute(text(f"DELETE FROM {TABLE_NAME} WHERE source = 'chuncheon'"))
        conn.execute(text(insert), rows)


def enrich_chuncheon() -> None:
    """supersedes 원본(youthcenter 2025)에서 chuncheon의 빈 구조화 필드를 보강. 멱등(COALESCE).

    보강 대상: 대회 본문에 없는 구조화 필드(키워드·소득·혼인·선착순·분류·연령·신청URL·등록기관).
    보존: 대회 최신 본문(정책명·category·혜택·설명·주관·날짜)과 상태 코드(aply_prd_se_cd)는 건드리지 않음.
    """
    sql = f"""
    UPDATE {TABLE_NAME} c SET
      keywords          = CASE WHEN cardinality(c.keywords)=0 THEN y.keywords ELSE c.keywords END,
      earn_cnd_se_cd    = COALESCE(c.earn_cnd_se_cd, y.earn_cnd_se_cd),
      earn_min_amt      = COALESCE(c.earn_min_amt, y.earn_min_amt),
      earn_max_amt      = COALESCE(c.earn_max_amt, y.earn_max_amt),
      mrg_stts_cd       = COALESCE(c.mrg_stts_cd, y.mrg_stts_cd),
      sprt_arvl_seq_yn  = COALESCE(c.sprt_arvl_seq_yn, y.sprt_arvl_seq_yn),
      age_limit_yn      = COALESCE(c.age_limit_yn, y.age_limit_yn),
      sprt_trgt_min_age = COALESCE(c.sprt_trgt_min_age, y.sprt_trgt_min_age),
      sprt_trgt_max_age = COALESCE(c.sprt_trgt_max_age, y.sprt_trgt_max_age),
      lclsf_nm          = COALESCE(c.lclsf_nm, y.lclsf_nm),
      mclsf_nm          = COALESCE(c.mclsf_nm, y.mclsf_nm),
      rgtr_inst_cd      = COALESCE(c.rgtr_inst_cd, y.rgtr_inst_cd),
      aply_url_addr     = COALESCE(c.aply_url_addr, y.aply_url_addr),
      updated_at        = now()
    FROM {TABLE_NAME} y
    WHERE c.source = 'chuncheon' AND c.raw_data ? 'supersedes'
      AND y.source = 'youthcenter' AND y.plcy_no = c.raw_data->>'supersedes'
    """
    with engine.begin() as conn:
        res = conn.execute(text(sql))
        print(f"[enrich] supersedes 원본에서 보강: {res.rowcount}행")


def verify() -> None:
    with engine.begin() as conn:
        def one(q):
            return conn.execute(text(q)).scalar()
        total = one(f"SELECT count(*) FROM {TABLE_NAME}")
        print(f"[chuncheon_policy] 총 {total}건")
        print("  source별:")
        for r in conn.execute(text(
            f"SELECT source, count(*) n FROM {TABLE_NAME} GROUP BY source ORDER BY n DESC")):
            print(f"    {r[0]:<12} {r[1]}")
        print("  region_scope별:")
        for r in conn.execute(text(
            f"SELECT region_scope, count(*) n FROM {TABLE_NAME} GROUP BY region_scope ORDER BY n DESC")):
            print(f"    {r[0]:<10} {r[1]}")
        today = "(now() AT TIME ZONE 'Asia/Seoul')::date"
        applicable = one(
            f"""SELECT count(*) FROM {TABLE_NAME}
                WHERE aply_prd_se_cd IS DISTINCT FROM '0057003'
                  AND (is_always_open OR apply_end_date IS NULL OR apply_end_date >= {today})""")
        closed = one(
            f"""SELECT count(*) FROM {TABLE_NAME}
                WHERE aply_prd_se_cd = '0057003'
                   OR (NOT is_always_open AND apply_end_date < {today})""")
        print(f"  상태: 신청가능 {applicable} / 마감·경과 {closed}")
        # 참조 무결성: 원본 policy가 실제 존재하는지
        orphan = one(
            f"""SELECT count(*) FROM {TABLE_NAME} c
                WHERE c.source='youthcenter'
                  AND NOT EXISTS (SELECT 1 FROM policy p WHERE p.plcy_no = c.source_ref)""")
        print(f"  무결성: youthcenter 고아(원본 policy 없음) {orphan}건")


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(prog="chuncheon.populate", description="chuncheon_policy 적재")
    ap.add_argument("--youthcenter", action="store_true", help="youthcenter만 적재")
    ap.add_argument("--chuncheon", action="store_true", help="chuncheon(대회 시드) 적재 + 원본 보강")
    ap.add_argument("--enrich", action="store_true", help="supersedes 원본에서 보강만")
    ap.add_argument("--verify", action="store_true", help="적재 현황만 출력")
    args = ap.parse_args(argv)
    if args.verify:
        verify()
        return 0
    if args.enrich:
        enrich_chuncheon()
    elif args.youthcenter:
        load_youthcenter()
    elif args.chuncheon:
        load_chuncheon()
        enrich_chuncheon()
    else:  # 전체 재적재
        load_youthcenter()
        load_chuncheon()
        enrich_chuncheon()
    verify()
    return 0


if __name__ == "__main__":
    sys.exit(main())
