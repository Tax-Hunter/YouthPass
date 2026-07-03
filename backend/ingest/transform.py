"""
transform.py — raw getPlcy item 1건 → policy 본문 dict (순수함수).

DB/네트워크/해시와 무관. 필수키(plcyNo/plcyNm) 누락 시 None 반환(스킵).
content_hash·is_active·first_seen_at·created_at·updated_at·policy_stats(inq_cnt 등)는
만들지 않는다(loader/hashing 책임).
"""
import re
from datetime import date, datetime
from typing import List, Optional

from app.api.routes.policy.constants import (
    APLY_PRD_ALWAYS,
    RAW_PLACEHOLDERS,
    SIDO_LABELS,
    ZIP12_SIDO,
)
from ingest.vocab import filter_keywords, resolve_category

VALID_SIDO = frozenset(SIDO_LABELS.keys())   # 17 시도 코드
EARN_UNIT_THRESHOLD = 20000                  # 이 값(만원) 초과 = 원단위 오입력 의심
WON_PER_MANWON = 10000                        # 원 → 만원 환산 제수(오입력 보정)
EARN_DEFAULT_CND = "0043001"                 # 소득 무관(빈 코드 기본값)
_SMALLINT_MAX = 32767                         # 연령 컬럼 SMALLINT 상한(초과 → None)
_INT_MAX = 2_147_483_647                      # earn 컬럼 INTEGER 상한(초과 → None)
_YMD8 = re.compile(r"\d{8}")
_DT_FORMATS = ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d")


def _clean(v) -> Optional[str]:
    """빈값/placeholder → None, 그 외 strip."""
    if v is None:
        return None
    s = str(v).strip()
    return s if s and s.lower() not in RAW_PLACEHOLDERS else None


def _to_int(v) -> Optional[int]:
    s = _clean(v)
    if s is None:
        return None
    try:
        return int(s)
    except ValueError:
        return None


def _to_bool(v) -> Optional[bool]:
    s = _clean(v)
    if s is None:
        return None
    return s.upper() == "Y"


def _clamp_ages(min_v, max_v):
    """0 센티넬·범위초과 → None, min>max 역전 → 둘 다 None (ck_policy_age_range·SMALLINT 보장)."""
    mn, mx = _to_int(min_v), _to_int(max_v)
    if mn == 0 or (mn is not None and not 0 <= mn <= _SMALLINT_MAX):
        mn = None
    if mx == 0 or (mx is not None and not 0 <= mx <= _SMALLINT_MAX):
        mx = None
    if mn is not None and mx is not None and mn > mx:
        return None, None
    return mn, mx


def _earn_amt(v) -> Optional[int]:
    """소득금액 파싱 + 단위 오입력 보정(만원칸에 원단위). INTEGER 범위 밖·음수 → None."""
    n = _to_int(v)
    if n is None:
        return None
    amt = n // WON_PER_MANWON if n > EARN_UNIT_THRESHOLD else n
    return amt if 0 <= amt <= _INT_MAX else None


def _ymd8_to_date(s: str) -> Optional[date]:
    try:
        return datetime.strptime(s, "%Y%m%d").date()
    except (ValueError, TypeError):
        return None


def _parse_apply_period(aply_ymd):
    """'YYYYMMDD ~ YYYYMMDD' → (start, end). start>end 역전 → (None, None)."""
    raw = _clean(aply_ymd)
    if not raw:
        return None, None
    m = _YMD8.findall(raw)
    start = _ymd8_to_date(m[0]) if len(m) >= 1 else None
    end = _ymd8_to_date(m[1]) if len(m) >= 2 else None
    if start and end and start > end:
        return None, None
    return start, end


def _parse_dt(v) -> Optional[datetime]:
    """'YYYY-MM-DD HH:MM:SS'(naive=UTC) 등 파싱."""
    s = _clean(v)
    if not s:
        return None
    for fmt in _DT_FORMATS:
        try:
            return datetime.strptime(s, fmt)
        except ValueError:
            continue
    return None


def _pick_url(*candidates) -> Optional[str]:
    """aply_url_addr·refUrlAddr1·refUrlAddr2 중 신청 URL 선택.

    http(s) URL을 우선 선택(원본 동작 재현). http가 없으면 스킴 없는 도메인형은
    https 보정(개선), 비URL(전화문의 등)은 제외 → 조회계층의 온통청년 폴백으로 넘김.
    """
    cleaned = [c for c in (_clean(v) for v in candidates) if c]
    for c in cleaned:
        if c.lower().startswith("http"):
            return c
    for c in cleaned:
        if "." in c and " " not in c:
            return f"https://{c}"
    return None


def _region(zip_cd):
    """zipCd 콤마분할 → (region_zip[], region_sido[], is_nationwide)."""
    raw = _clean(zip_cd)
    zips: List[str] = []
    sidos: List[str] = []
    if raw:
        seen_z, seen_s = set(), set()
        for tok in raw.split(","):
            z = tok.strip()
            if not z or z in seen_z:
                continue
            seen_z.add(z)
            zips.append(z)
            sido = ZIP12_SIDO.get(z[:3]) if z[:2] == "12" else z[:2]
            if sido and sido in VALID_SIDO and sido not in seen_s:
                seen_s.add(sido)
                sidos.append(sido)
    sidos.sort()
    return zips, sidos, len(sidos) == len(VALID_SIDO)


def transform_item(raw: dict) -> Optional[dict]:
    """raw item 1건 → policy dict. 비dict·필수키(plcy_no/plcy_nm) 누락 시 None.

    미분류(lclsf·mclsf·keyword 전부 빈 → category None·keywords [])는 스킵하지 않고
    적재 대상으로 유지한다(validate가 category None 허용). 〈결정 2026-06-30〉
    """
    if not isinstance(raw, dict):
        return None
    plcy_no = _clean(raw.get("plcyNo"))
    plcy_nm = _clean(raw.get("plcyNm"))   # plcy_no와 대칭으로 placeholder도 None 처리
    if not plcy_no or not plcy_nm:
        return None

    lclsf_nm = _clean(raw.get("lclsfNm"))
    mclsf_nm = _clean(raw.get("mclsfNm"))
    min_age, max_age = _clamp_ages(raw.get("sprtTrgtMinAge"), raw.get("sprtTrgtMaxAge"))
    start_date, end_date = _parse_apply_period(raw.get("aplyYmd"))
    aply_prd = _clean(raw.get("aplyPrdSeCd"))
    zips, sidos, nationwide = _region(raw.get("zipCd"))

    return {
        "plcy_no": plcy_no,
        "plcy_nm": plcy_nm,
        "plcy_expln_cn": _clean(raw.get("plcyExplnCn")),
        "plcy_sprt_cn": _clean(raw.get("plcySprtCn")),
        "lclsf_nm": lclsf_nm,
        "category": resolve_category(mclsf_nm, lclsf_nm),
        "mclsf_nm": mclsf_nm,
        "sprt_trgt_min_age": min_age,
        "sprt_trgt_max_age": max_age,
        "age_limit_yn": _to_bool(raw.get("sprtTrgtAgeLmtYn")),
        "earn_cnd_se_cd": _clean(raw.get("earnCndSeCd")) or EARN_DEFAULT_CND,
        "earn_min_amt": _earn_amt(raw.get("earnMinAmt")),
        "earn_max_amt": _earn_amt(raw.get("earnMaxAmt")),
        "mrg_stts_cd": _clean(raw.get("mrgSttsCd")),
        "aply_prd_se_cd": aply_prd,
        "is_always_open": aply_prd == APLY_PRD_ALWAYS,   # ★ 코드정의서 확정값(추측 금지)
        "apply_start_date": start_date,
        "apply_end_date": end_date,
        "aply_ymd_raw": _clean(raw.get("aplyYmd")),
        "region_sido": sidos,
        "region_zip": zips,
        "is_nationwide": nationwide,
        "keywords": filter_keywords(raw.get("plcyKywdNm")),
        "sprt_arvl_seq_yn": _to_bool(raw.get("sprtArvlSeqYn")),
        "sprvsn_inst_cd_nm": _clean(raw.get("sprvsnInstCdNm")),
        "rgtr_inst_cd": _clean(raw.get("rgtrInstCd")),
        "aply_url_addr": _pick_url(
            raw.get("aplyUrlAddr"), raw.get("refUrlAddr1"), raw.get("refUrlAddr2")
        ),
        "frst_reg_dt": _parse_dt(raw.get("frstRegDt")),
        "last_mdfcn_dt": _parse_dt(raw.get("lastMdfcnDt")),
        "raw_data": raw,
    }


def transform_batch(raws: List[dict]) -> List[dict]:
    """raw 리스트 → policy dict 리스트. 결함 1건이 전체를 죽이지 않도록 per-item 격리.

    스킵·예외 건은 제외 → 입력 대비 출력 건수 차이로 드러난다(상류 validate가 결손 감지).
    """
    out: List[dict] = []
    for r in raws:
        try:
            rec = transform_item(r)
        except Exception:
            continue
        if rec is not None:
            out.append(rec)
    return out
