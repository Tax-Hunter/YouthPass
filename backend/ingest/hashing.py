"""
hashing.py — 정책 본문 정체성 content_hash(정규직렬화 md5) + 변경 분류.

변경감지는 "우리가 저장·노출하는 본문이 바뀌었나"를 본다. 따라서:
- 제외: raw_data(원본 통째), 메타 타임스탬프 frst_reg_dt·last_mdfcn_dt,
  변동값 inq_cnt(애초에 transform 출력에 없음, policy_stats 소관)
- 포함: 본문 정체성 27필드(아래 HASH_FIELDS)

→ inq_cnt나 정부 수정시각만 바뀐 정책은 unchanged, 본문이 바뀐 정책만 changed.
content_hash 변경 시에만 loader가 updated_at을 갱신한다.

참고: 구 파이프라인(유실)의 직렬화 규칙과 다를 수 있어, 신 규칙 첫 적용 시 기존 행은
대량 changed로 잡힐 수 있다(loader의 --rehash-only로 해시만 백필 권장).
"""
import hashlib
import json
from datetime import date, datetime
from typing import Optional

# content_hash 대상 = transform 출력 중 본문 정체성 필드 (raw_data·타임스탬프 제외)
HASH_FIELDS = (
    "plcy_no", "plcy_nm", "plcy_expln_cn", "plcy_sprt_cn",
    "lclsf_nm", "category", "mclsf_nm",
    "sprt_trgt_min_age", "sprt_trgt_max_age", "age_limit_yn",
    "earn_cnd_se_cd", "earn_min_amt", "earn_max_amt", "mrg_stts_cd",
    "aply_prd_se_cd", "is_always_open",
    "apply_start_date", "apply_end_date", "aply_ymd_raw",
    "region_sido", "region_zip", "is_nationwide", "keywords",
    "sprt_arvl_seq_yn", "sprvsn_inst_cd_nm", "rgtr_inst_cd", "aply_url_addr",
)


def _normalize(v):
    """직렬화 안정화: 배열은 정렬(표현차 무관), 날짜는 ISO 문자열, 빈문자열→None."""
    if v is None:
        return None
    if isinstance(v, (list, tuple)):
        return sorted(_normalize(x) for x in v)
    if isinstance(v, (date, datetime)):
        return v.isoformat()
    if isinstance(v, str):
        return v or None
    return v


def content_hash(record: dict) -> str:
    """본문 필드만 정규직렬화 md5(32 hex). 누락키는 None으로 보충해 표현차 무관."""
    payload = {k: _normalize(record.get(k)) for k in HASH_FIELDS}
    blob = json.dumps(payload, sort_keys=True, ensure_ascii=False, separators=(",", ":"))
    return hashlib.md5(blob.encode("utf-8")).hexdigest()


def classify_change(record: dict, existing_hash: Optional[str]) -> str:
    """기존 content_hash 대비 new / changed / unchanged 분류."""
    if existing_hash is None:
        return "new"
    return "unchanged" if content_hash(record) == existing_hash else "changed"
