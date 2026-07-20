import hashlib
import secrets
import logging
from datetime import date, datetime, timedelta, timezone
from typing import List, Optional, Tuple

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import and_, case, func, or_
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import get_db
from app.db.models import Policy, PolicyStats, Code, BookmarkShare
from app.schemas.policy import (
    Eligibility,
    PolicyCard,
    PolicyDetail,
    PolicyListResponse,
    ShareCreateRequest,
    ShareCreateResponse,
)
from app.api.routes.policy.cache import policy_cache_get, policy_cache_set
from app.api.routes.policy.constants import (
    APLY_PRD_CLOSED,
    CATEGORY_FALLBACK,
    CODE_FILTERS,
    RAW_PLACEHOLDERS,
    REQ_NOLIMIT,
    SHARE_LINK_EXPIRY_DAYS,
    SIDO_LABELS,
)
from app.core.es import get_es
from app.api.routes.policy.es_query import search_policy_ids
from app.api.routes.policy.search_stats import record_search, record_search_zero

router = APIRouter(prefix="/policy", tags=["policy"])

logger = logging.getLogger(__name__)

KST = timezone(timedelta(hours=9))


def _today_kst() -> date:
    # D-day·마감 판정 기준일 — 서버가 UTC 컨테이너여도 한국 날짜 기준 유지
    # (date.today()는 UTC 자정~KST 자정 사이 하루 어긋남)
    return datetime.now(KST).date()


    # raw_data 원문에서 빈값/placeholder는 None으로
def _clean(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    v = value.strip()
    return v if v and v.lower() not in RAW_PLACEHOLDERS else None

   # 참고 URL에 스킴 없으면 https:// 보정
def _norm_url(value: Optional[str]) -> Optional[str]:
    u = _clean(value)
    if not u:
        return None
    return u if u.lower().startswith("http") else f"https://{u}"


def _fmt_ymd(value: Optional[str]) -> Optional[str]:
    # "20260918" → "2026.09.18"
    s = _clean(value)
    if not s or len(s) != 8 or not s.isdigit():
        return None
    return f"{s[:4]}.{s[4:6]}.{s[6:]}"


def _biz_period(bgn: Optional[str], end: Optional[str]) -> Optional[str]:
    b = _fmt_ymd(bgn)
    e = "별도 공고" if _clean(end) == "29991231" else _fmt_ymd(end)
    if b and e:
        return f"{b} ~ {e}"
    if b:
        return f"{b} ~"
    if e:
        return f"~ {e}"
    return None


def _apply_url(aply_url_addr: Optional[str], plcy_no: str) -> str:
    # DB에 신청 URL이 있으면 그대로, 없으면 온통청년 정책 상세 페이지로 폴백
    if aply_url_addr and aply_url_addr.strip():
        return aply_url_addr
    return f"{settings.YTH_DETAIL_URL_BASE}/{plcy_no}"


def _code_labels(db: Session, *codes: Optional[str]) -> dict:
    # 주어진 코드값들의 한글 라벨을 code 테이블에서 조회 (미정의/미적재 시 키 없음)
    wanted = {c for c in codes if c}
    if not wanted:
        return {}
    rows = db.query(Code.cd, Code.cd_nm).filter(Code.cd.in_(wanted)).all()
    return {cd: nm for cd, nm in rows}


def _region_label(is_nationwide: bool, region_sido: Optional[List[str]]) -> str:
    if is_nationwide:
        return "전국 공통"
    labels = [SIDO_LABELS.get(c, c) for c in (region_sido or [])]
    if not labels:
        return "-"
    if len(labels) <= 2:
        return ", ".join(labels)
    return f"{labels[0]} 외 {len(labels) - 1}곳"


def _dday(
    aply_prd_se_cd: Optional[str],
    is_always_open: bool,
    apply_end_date: Optional[date],
) -> Tuple[str, Optional[int]]:
    # 마감코드(0057003)를 최우선 판정 — is_always_open 재오염(마감인데 TRUE)에도 방어
    if aply_prd_se_cd == APLY_PRD_CLOSED:
        return "마감", None
    if is_always_open:
        return "상시모집", None
    if apply_end_date is None:
        return "미정", None
    days = (apply_end_date - _today_kst()).days
    if days < 0:
        return "마감", days
    if days == 0:
        return "D-DAY", days
    return f"D-{days}", days


def _age_label(
    min_age: Optional[int],
    max_age: Optional[int],
    age_limit_yn: Optional[bool],
) -> str:
    # 연령 표시 폴백 4분기: 범위 / 한쪽 경계 / 무관 / 확인필요
    if min_age is not None and max_age is not None:
        return f"만 {min_age}~{max_age}세"
    if min_age is not None:
        return f"만 {min_age}세 이상"
    if max_age is not None:
        return f"만 {max_age}세 이하"
    # 연령값 양쪽 없음 — 제한여부로 분기
    if age_limit_yn:
        return "연령 조건 상세 확인"  # 제한 있다 표기됐으나 값 없음(모순) → 무관 단정 금지
    return "연령 무관"


def _income_label(
    cd: Optional[str], min_amt: Optional[int], max_amt: Optional[int], earn_etc: Optional[str]
) -> Optional[str]:
    if cd is None:
        return None
    if cd == "0043001":  # 소득 무관
        return "소득 무관"
    etc = _clean(earn_etc)
    if cd == "0043002":  # 연소득
        if max_amt:
            if min_amt:
                return f"연소득 {min_amt:,}~{max_amt:,}만원"
            return f"연소득 {max_amt:,}만원 이하"
        return etc or "연소득 조건 있음"
    # 0043003 기타
    return etc or "기타 소득조건"


def _req_label(code_map: dict, raw_value: Optional[str], nolimit_cd: str) -> Optional[str]:
    # 콤마 다중 코드 → 라벨. 제한없음 단독/미매핑이면 None
    if not raw_value or not str(raw_value).strip():
        return None
    cds = [c.strip() for c in str(raw_value).split(",") if c.strip() and c.strip() != nolimit_cd]
    labels = [code_map[c] for c in cds if c in code_map]
    return ", ".join(labels) if labels else None


def _compose_target(e: Eligibility) -> str:
    # None 아닌 항목만 "• 라벨: 값" 줄로 조합
    rows = [
        ("연령", e.age), ("거주지역", e.region), ("소득", e.income), ("혼인", e.marriage),
        ("취업상태", e.job), ("학력", e.education), ("전공", e.major),
        ("특화분야", e.specialization), ("추가 자격", e.additional),
    ]
    return "\n".join(f"• {k}: {v}" for k, v in rows if v)


def _to_card(p: Policy, inq_cnt: Optional[int] = None) -> PolicyCard:
    label, days = _dday(p.aply_prd_se_cd, p.is_always_open, p.apply_end_date)
    return PolicyCard(
        plcy_no=p.plcy_no,
        plcy_nm=p.plcy_nm,
        category=p.category or CATEGORY_FALLBACK,
        keywords=p.keywords or [],
        region=_region_label(p.is_nationwide, p.region_sido),
        org=p.sprvsn_inst_cd_nm,
        summary=p.plcy_expln_cn or p.plcy_sprt_cn,
        benefit=p.plcy_sprt_cn or p.plcy_expln_cn,
        age_label=_age_label(p.sprt_trgt_min_age, p.sprt_trgt_max_age, p.age_limit_yn),
        dday=label,
        days=days,
        views=inq_cnt or 0,
        is_always_open=p.is_always_open,
        sprt_arvl_seq_yn=p.sprt_arvl_seq_yn,
        apply_end_date=p.apply_end_date,
        aply_url_addr=_apply_url(p.aply_url_addr, p.plcy_no),
    )


def _hydrate_cards(db: Session, plcy_nos: List[str], size: int) -> List[PolicyCard]:
    # ES가 반환한 plcy_no 순서열 → PG 재조회 → 카드 조립 (dday 등 시점 파생값은 여기서 계산).
    # IN 조회는 순서를 보장하지 않으므로 ES 순서로 재정렬 후 size로 절단한다.
    # 색인 이후 소프트만료된 문서는 is_active 필터에서 탈락하고 보충 없이 짧은 페이지를 허용
    # (버퍼 보충은 페이지 경계 카드 중복을 만든다 — es_query.py 참조). 탈락 발생 시
    # total 보정·캐시 스킵은 호출측(_es_search)이 책임진다.
    if not plcy_nos:
        return []
    rows = (
        db.query(Policy, PolicyStats.inq_cnt)
        .outerjoin(PolicyStats, PolicyStats.plcy_no == Policy.plcy_no)
        .filter(Policy.plcy_no.in_(plcy_nos), Policy.is_active.is_(True))
        .all()
    )
    by_no = {p.plcy_no: (p, cnt) for p, cnt in rows}
    ordered = [by_no[no] for no in plcy_nos if no in by_no][:size]
    return [_to_card(p, cnt) for p, cnt in ordered]


# ── /get/policies(목록)·/get/search(코드검색) 공용 필터·정렬 헬퍼 ──
def _apply_text_filter(q, term: Optional[str]):
    # q(정책명 부분일치 검색) — pg_trgm GIN(idx_policy_nm_trgm)이 ILIKE를 가속.
    # %·_·\ 는 리터럴로 이스케이프(와일드카드 주입 방지).
    t = (term or "").strip()
    if not t:
        return q
    esc = t.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    return q.filter(Policy.plcy_nm.ilike(f"%{esc}%", escape="\\"))


def _norm_codes(values: Optional[List[str]], grp: str) -> List[str]:
    # 반복(?job=A&job=B)·콤마(?job=A,B) 혼용을 콤마로 합쳐 한 번에 평탄화
    # → 형식검증(7자리·그룹접두어) + 순서보존 중복제거.
    # FastAPI가 '?job='를 ['']로 넘겨도 strip 후 걸러져 빈 리스트가 됨(LIKE '%%' 전건매칭 방지).
    if not values:
        return []
    out: List[str] = []
    seen = set()
    for c in ",".join(str(v) for v in values).split(","):
        c = c.strip()
        if len(c) == 7 and c.isdigit() and c.startswith(grp) and c not in seen:
            seen.add(c)
            out.append(c)
    return out


def _cache_ident(*parts) -> str:
    # 파라미터 조합 → 결정적 캐시 식별자. 다중값(list)은 정렬해 표현 순서 차이를 무시.
    norm = tuple(sorted(p) if isinstance(p, list) else p for p in parts)
    return hashlib.sha1(repr(norm).encode()).hexdigest()


def _apply_base_filters(q, *, category, keywords, sido, age, applicable):
    # 목록/검색이 공유하는 기본 필터(분류·키워드·지역·연령·신청가능)
    if category:
        q = q.filter(Policy.category.in_(category))
    if keywords:
        q = q.filter(Policy.keywords.overlap(keywords))
    if sido:
        q = q.filter(or_(Policy.is_nationwide.is_(True),
                         Policy.region_sido.contains([sido])))
    if age is not None:
        q = q.filter(and_(
            or_(Policy.sprt_trgt_min_age.is_(None), Policy.sprt_trgt_min_age <= age),
            or_(Policy.sprt_trgt_max_age.is_(None), Policy.sprt_trgt_max_age >= age),
        ))
    if applicable:
        # 마감(0057003) 제외 후, 상시 OR 마감일 미상 OR 마감 전
        q = q.filter(
            Policy.aply_prd_se_cd != APLY_PRD_CLOSED,
            or_(
                Policy.is_always_open.is_(True),
                Policy.apply_end_date.is_(None),
                Policy.apply_end_date >= _today_kst(),
            ),
        )
    return q


    # 코드 8종 필터. 정규화 결과가 빈 것은 무제약. 차원 내 OR, 차원 간 AND.
def _apply_code_filters(q, code_params: dict):
    for key, spec in CODE_FILTERS.items():
        codes = code_params.get(key) or []
        if not codes:
            continue
        raw_key, nolimit, source = spec["raw_key"], spec["nolimit"], spec["source"]
        eff = codes + ([nolimit] if nolimit else [])  # 제한없음/무관 자동 포함
        if source == "raw_multi":
            # raw_data 콤마 문자열 → 경계보호(',값,')로 정확 토큰 매칭(부분매칭 오탐 방지)
            hay = func.concat(",", func.coalesce(Policy.raw_data[raw_key].astext, ""), ",")
            q = q.filter(or_(*[hay.like(f"%,{c},%") for c in eff]))
        elif source == "raw_single":
            q = q.filter(Policy.raw_data[raw_key].astext.in_(codes))
        else:  # column
            q = q.filter(getattr(Policy, raw_key).in_(eff))
    return q


    # 정렬: popular=조회수순 / deadline=마감임박순 / recent=최신 인지순. 동점은 plcy_no로 안정정렬.
def _apply_sort(q, sort: str):
    if sort == "popular":
        return q.order_by(PolicyStats.inq_cnt.desc().nullslast(), Policy.plcy_no.desc())
    if sort == "deadline":
        # 마감임박순 = 신청가능(미래 마감) 임박순 → 상시/미정(NULL) → 이미 지난 마감.
        # 활성 정책의 39%가 과거 마감(2026-07 실측)이라, 보정 없으면 최상단이 전부 지난 정책이 됨.
        rank = case(
            (Policy.apply_end_date < _today_kst(), 2),
            (Policy.apply_end_date.is_(None), 1),
            else_=0,
        )
        return q.order_by(rank.asc(), Policy.apply_end_date.asc(), Policy.plcy_no.desc())
    return q.order_by(Policy.first_seen_at.desc().nullslast(), Policy.plcy_no.desc())


def _es_search(
    db: Session, *, cache_kind: str, cache_id: str, q_text, category, keywords,
    sido, age, applicable, sort, page, size,
) -> Tuple[Optional[PolicyListResponse], bool]:
    """q 검색을 ES(nori 형태소·멀티필드·관련도)로 시도. 반환 (응답 or None, cache_allowed).

    - (None, True):  q 없음 또는 ES 미설정 — 정상 PG 경로(폴백 아님, 캐시 저장 유지)
    - (None, False): ES 시도 중 실패 또는 스테일 전량 탈락 — PG 폴백, 폴백 응답은 캐시 저장 스킵
    - (응답, True):  ES 성공 — 스테일 탈락이 없을 때만 캐시에 저장됨
    get_es()는 잘못된 URL에 생성자 예외를 던질 수 있어 반드시 try 안에서 호출한다(fail-open).
    """
    if not (q_text and q_text.strip()):
        return None, True
    # ES max_result_window(10,000) 초과 깊은 페이지는 400을 내므로 PG로 — 정상 경로(폴백 아님, 캐시 가능)
    if (page - 1) * size + size > 10_000:
        return None, True
    try:
        es = get_es()
        if es is None:
            return None, True
        plcy_nos, total = search_policy_ids(
            es, q_text=q_text, category=category, keywords=keywords, sido=sido,
            age=age, applicable=applicable, sort=sort, page=page, size=size,
            today_kst=_today_kst(),
        )
        items = _hydrate_cards(db, plcy_nos, size)
        # 색인·DB 시점차(재색인 실패 fail-soft 창 등)로 소프트만료분이 hydration에서 탈락하면
        # ES total과 items 수가 어긋난다.
        # · 전량 탈락: total>0·items=[] 사구간(프론트가 '결과 없음'을 렌더하고 다음 페이지를
        #   영영 요청하지 않음) → 자기일관적인 PG 폴백으로 넘긴다.
        # · 부분 탈락: total은 ES 전역값 그대로 둔다. 페이지 지역 탈락분을 전역 total에서
        #   빼면 페이지마다 total이 달라지고, 탈락이 많은 페이지에서 total이 page*size 아래로
        #   내려가 프론트 무한스크롤이 조기 종료된다(잔여 페이지 유실). 과대 계수가 조기
        #   종료보다 무해하다.
        # 어느 경우든 어긋난 응답이 KST 자정까지 고착되지 않도록 캐시 저장은 생략한다.
        dropped = len(plcy_nos) - len(items)
        if plcy_nos and not items:
            logger.warning(
                "ES 스테일 전량 탈락 — PG 폴백: page=%s, ES ids=%s", page, len(plcy_nos))
            return None, False
        resp = PolicyListResponse(total=total, page=page, size=size, items=items)
        if dropped:
            logger.warning(
                "ES 스테일 %s건 탈락 — 캐시 스킵 (page=%s, total=%s)", dropped, page, total)
        else:
            policy_cache_set(cache_kind, cache_id, resp.model_dump_json())
        return resp, True
    except Exception as e:
        logger.warning("ES 검색 실패 — PG 폴백: %s: %s", type(e).__name__, e)
        db.rollback()  # ES 성공 후 hydration DB 오류 시 세션 오염 → 폴백 쿼리 PendingRollbackError 방지
        return None, False


@router.get("/get/policies", response_model=PolicyListResponse)
def list_policies(
    db: Session = Depends(get_db),
    q_text: Optional[str] = Query(default=None, alias="q", min_length=1, max_length=100,
                                  description="정책명 텍스트 검색어(부분일치)"),
    category: Optional[List[str]] = Query(default=None, description="카테고리(다중)"),
    keywords: Optional[List[str]] = Query(default=None, description="키워드(다중, 하나라도 포함)"),
    sido: Optional[str] = Query(default=None, description="시도코드(전국 OR 해당 시도)"),
    age: Optional[int] = Query(default=None, ge=0, description="나이(경계 포함 비교)"),
    applicable: bool = Query(default=False, description="신청 가능한 것만"),
    sort: str = Query(default="recent", pattern="^(popular|deadline|recent)$"),
    page: int = Query(default=1, ge=1),
    size: int = Query(default=20, ge=1, le=100),
):
    if q_text:
        record_search(q_text)  # 캐시 조회 전 — 히트/미스 무관 빈도 기록 (search_stats)
    # 0건 기록은 필터 없는 순수 텍스트 질의만 — 필터 때문에 0건이 된 것을 섞으면
    # "텍스트가 안 맞아 0건"이라는 지표 의미가 오염된다(search_stats 계약).
    zero_loggable = bool(q_text) and not (category or keywords or sido
                                          or age is not None or applicable)
    cache_id = _cache_ident(q_text, category, keywords, sido, age, applicable, sort, page, size)
    cached = policy_cache_get("list", cache_id)
    if cached is not None:
        return Response(content=cached, media_type="application/json")

    # ── ES 분기: q 검색만 ES(nori 형태소·멀티필드·관련도)로. q 없는 목록은 항상 PG ──
    es_resp, cache_allowed = _es_search(
        db, cache_kind="list", cache_id=cache_id, q_text=q_text, category=category,
        keywords=keywords, sido=sido, age=age, applicable=applicable, sort=sort, page=page, size=size)
    if es_resp is not None:
        if zero_loggable and es_resp.total == 0:
            record_search_zero(q_text)
        return es_resp

    q = (
        db.query(Policy, PolicyStats.inq_cnt)
        .outerjoin(PolicyStats, PolicyStats.plcy_no == Policy.plcy_no)
        .filter(Policy.is_active.is_(True))
    )
    q = _apply_base_filters(q, category=category, keywords=keywords,
                            sido=sido, age=age, applicable=applicable)
    q = _apply_text_filter(q, q_text)

    total = q.count()
    if zero_loggable and total == 0:
        record_search_zero(q_text)
    q = _apply_sort(q, sort)
    rows = q.offset((page - 1) * size).limit(size).all()
    resp = PolicyListResponse(
        total=total, page=page, size=size,
        items=[_to_card(p, inq_cnt) for p, inq_cnt in rows],
    )
    if cache_allowed:
        policy_cache_set("list", cache_id, resp.model_dump_json())
    return resp


@router.get("/get/search", response_model=PolicyListResponse)
def search_policies(
    db: Session = Depends(get_db),
    q_text: Optional[str] = Query(default=None, alias="q", min_length=1, max_length=100,
                                  description="정책명 텍스트 검색어(부분일치)"),
    # ── 코드 필터(신규, 콤마/반복 다중 = 차원 내 OR) ──
    pvsn_method: Optional[List[str]] = Query(default=None, description="지원방식 코드(0042, 다중)"),
    job: Optional[List[str]] = Query(default=None, description="취업상태 코드(0013, 다중)"),
    school: Optional[List[str]] = Query(default=None, description="학력 코드(0049, 다중)"),
    major: Optional[List[str]] = Query(default=None, description="전공 코드(0011, 다중)"),
    sbiz: Optional[List[str]] = Query(default=None, description="특화분야 코드(0014, 다중)"),
    inst_group: Optional[List[str]] = Query(default=None, description="제공기관 코드(0054 중앙/지자체, 다중)"),
    income: Optional[List[str]] = Query(default=None, description="소득조건 코드(0043, 다중)"),
    marriage: Optional[List[str]] = Query(default=None, description="혼인 코드(0055, 다중)"),
    # ── 기존 필터 계승 ──
    category: Optional[List[str]] = Query(default=None, description="카테고리(다중)"),
    keywords: Optional[List[str]] = Query(default=None, description="키워드(다중, 하나라도 포함)"),
    sido: Optional[str] = Query(default=None, description="시도코드(전국 OR 해당 시도)"),
    age: Optional[int] = Query(default=None, ge=0, description="나이(경계 포함 비교)"),
    applicable: bool = Query(default=False, description="신청 가능한 것만"),
    sort: str = Query(default="recent", pattern="^(popular|deadline|recent)$"),
    page: int = Query(default=1, ge=1),
    size: int = Query(default=20, ge=1, le=100),
):
    """코드 기반 정책 검색 — 온통청년 코드 8종 필터 + 기존 필터(연령·지역·분류·키워드·신청가능)
    + q(정책명 부분일치). 차원 내 OR·차원 간 AND, 제한없음/무관 자동 포함. 응답은 목록과 동일한 PolicyCard.
    """
    # 코드 필터 정규화(빈/무효 → 차원 드롭). 필터 0개면 활성 전체 반환(= /get/policies 무필터와 동일).
    code_params = {
        k: _norm_codes(v, CODE_FILTERS[k]["grp"])
        for k, v in {
            "pvsn_method": pvsn_method, "job": job, "school": school, "major": major,
            "sbiz": sbiz, "inst_group": inst_group, "income": income, "marriage": marriage,
        }.items()
    }

    if q_text:
        record_search(q_text)  # 캐시 조회 전 — 히트/미스 무관 빈도 기록 (search_stats)
    # 0건 기록은 필터(코드 8종 포함) 없는 순수 텍스트 질의만 — list_policies와 동일 계약
    zero_loggable = bool(q_text) and not (category or keywords or sido or age is not None
                                          or applicable or any(code_params.values()))
    # 캐시 식별자는 정규화된 코드 필터 기준 — 동치 요청(순서/중복 차이)이 같은 키를 공유
    cache_id = _cache_ident(q_text, category, keywords, sido, age, applicable, sort, page, size,
                            sorted((k, tuple(sorted(v))) for k, v in code_params.items()))
    cached = policy_cache_get("search", cache_id)
    if cached is not None:
        return Response(content=cached, media_type="application/json")

    # 코드필터 8종은 ES에 미색인(PG 영구 유지) → 코드필터 없는 q 검색만 ES 경유.
    # dev 프론트가 /get/search를 텍스트 검색에 쓰므로(SearchScreen은 q만 전송) 이 경로가 실사용됨.
    if any(code_params.values()):
        cache_allowed = True
    else:
        es_resp, cache_allowed = _es_search(
            db, cache_kind="search", cache_id=cache_id, q_text=q_text, category=category,
            keywords=keywords, sido=sido, age=age, applicable=applicable, sort=sort, page=page, size=size)
        if es_resp is not None:
            if zero_loggable and es_resp.total == 0:
                record_search_zero(q_text)
            return es_resp

    q = (
        db.query(Policy, PolicyStats.inq_cnt)
        .outerjoin(PolicyStats, PolicyStats.plcy_no == Policy.plcy_no)
        .filter(Policy.is_active.is_(True))
    )
    q = _apply_base_filters(q, category=category, keywords=keywords,
                            sido=sido, age=age, applicable=applicable)
    q = _apply_text_filter(q, q_text)
    q = _apply_code_filters(q, code_params)

    total = q.count()
    if zero_loggable and total == 0:
        record_search_zero(q_text)
    q = _apply_sort(q, sort)
    rows = q.offset((page - 1) * size).limit(size).all()
    resp = PolicyListResponse(
        total=total, page=page, size=size,
        items=[_to_card(p, inq_cnt) for p, inq_cnt in rows],
    )
    if cache_allowed:
        policy_cache_set("search", cache_id, resp.model_dump_json())
    return resp


@router.get("/get/policy/{policy_id}", response_model=PolicyDetail)
def get_policy(policy_id: str, db: Session = Depends(get_db)):
    cached = policy_cache_get("detail", policy_id)
    if cached is not None:
        return Response(content=cached, media_type="application/json")

    row = (
        db.query(Policy, PolicyStats.inq_cnt)
        .outerjoin(PolicyStats, PolicyStats.plcy_no == Policy.plcy_no)
        .filter(Policy.plcy_no == policy_id)
        .first()
    )
    if row is None:
        raise HTTPException(status_code=404, detail="policy not found")
    p, inq_cnt = row
    label, days = _dday(p.aply_prd_se_cd, p.is_always_open, p.apply_end_date)
    age_label = _age_label(p.sprt_trgt_min_age, p.sprt_trgt_max_age, p.age_limit_yn)
    region_label = _region_label(p.is_nationwide, p.region_sido)

    # 자격요건 코드(raw_data 보존분) + 단일값 코드 라벨을 1쿼리로 조회
    raw = p.raw_data or {}
    req_raw = {k: raw.get(k) for k in REQ_NOLIMIT}
    req_cds = [
        c.strip()
        for v in req_raw.values() if v
        for c in str(v).split(",") if c.strip()
    ]
    pvsn_cd = _clean(raw.get("plcyPvsnMthdCd"))            # 지원 방식 코드
    scl_cnt_raw = str(raw.get("sprtSclCnt") or "").strip()  # 지원 규모/인원
    labels = _code_labels(db, p.earn_cnd_se_cd, p.mrg_stts_cd, p.aply_prd_se_cd, pvsn_cd, *req_cds)

    eligibility = Eligibility(
        age=age_label,
        region=region_label,
        income=_income_label(p.earn_cnd_se_cd, p.earn_min_amt, p.earn_max_amt, raw.get("earnEtcCn")),
        marriage=(labels.get(p.mrg_stts_cd) if p.mrg_stts_cd and p.mrg_stts_cd != "0055003" else None),
        job=_req_label(labels, req_raw["jobCd"], REQ_NOLIMIT["jobCd"]),
        education=_req_label(labels, req_raw["schoolCd"], REQ_NOLIMIT["schoolCd"]),
        major=_req_label(labels, req_raw["plcyMajorCd"], REQ_NOLIMIT["plcyMajorCd"]),
        specialization=_req_label(labels, req_raw["sbizCd"], REQ_NOLIMIT["sbizCd"]),
        additional=_clean(raw.get("addAplyQlfcCndCn")),
    )
    target = _compose_target(eligibility)

    ref_urls = [u for u in (_norm_url(raw.get("refUrlAddr1")), _norm_url(raw.get("refUrlAddr2"))) if u]
    contact = _clean(raw.get("sprvsnInstPicNm")) or _clean(raw.get("operInstPicNm"))

    resp = PolicyDetail(
        plcy_no=p.plcy_no,
        plcy_nm=p.plcy_nm,
        category=p.category or CATEGORY_FALLBACK,
        lclsf_nm=p.lclsf_nm,
        mclsf_nm=p.mclsf_nm,
        plcy_expln_cn=p.plcy_expln_cn,
        plcy_sprt_cn=p.plcy_sprt_cn,
        region=region_label,
        region_sido=p.region_sido or [],
        is_nationwide=p.is_nationwide,
        keywords=p.keywords or [],
        sprt_trgt_min_age=p.sprt_trgt_min_age,
        sprt_trgt_max_age=p.sprt_trgt_max_age,
        age_label=age_label,
        earn_cnd_se_cd=p.earn_cnd_se_cd,
        earn_cnd_se_nm=labels.get(p.earn_cnd_se_cd),
        earn_min_amt=p.earn_min_amt,
        earn_max_amt=p.earn_max_amt,
        mrg_stts_cd=p.mrg_stts_cd,
        mrg_stts_nm=labels.get(p.mrg_stts_cd),
        aply_prd_se_cd=p.aply_prd_se_cd,
        aply_prd_se_nm=labels.get(p.aply_prd_se_cd),
        is_always_open=p.is_always_open,
        apply_start_date=p.apply_start_date,
        apply_end_date=p.apply_end_date,
        dday=label,
        days=days,
        is_active=p.is_active,
        sprt_arvl_seq_yn=p.sprt_arvl_seq_yn,
        sprt_scl_lmt_yn={"Y": True, "N": False}.get(raw.get("sprtSclLmtYn")),
        sprt_scl_cnt=int(scl_cnt_raw) if scl_cnt_raw.lstrip("-").isdigit() else None,
        plcy_pvsn_mthd_cd=pvsn_cd,
        plcy_pvsn_mthd_nm=labels.get(pvsn_cd),
        sprvsn_inst_cd_nm=p.sprvsn_inst_cd_nm,
        aply_url_addr=_apply_url(p.aply_url_addr, p.plcy_no),
        views=inq_cnt or 0,
        frst_reg_dt=p.frst_reg_dt,
        last_mdfcn_dt=p.last_mdfcn_dt,
        eligibility=eligibility,
        target=target,
        apply_method=_clean(raw.get("plcyAplyMthdCn")),
        documents=_clean(raw.get("sbmsnDcmntCn")),
        screening=_clean(raw.get("srngMthdCn")),
        etc_notes=_clean(raw.get("etcMttrCn")),
        oper_inst_nm=_clean(raw.get("operInstCdNm")),
        contact=contact,
        ref_urls=ref_urls,
        biz_period=_biz_period(raw.get("bizPrdBgngYmd"), raw.get("bizPrdEndYmd")),
    )
    # 404는 캐시하지 않음(위에서 조기 반환) — 존재 정책의 성공 응답만 저장
    policy_cache_set("detail", policy_id, resp.model_dump_json())
    return resp


def _dedupe_preserve_order(values: List[str]) -> List[str]:
    seen = set()
    out = []
    for v in values:
        if v not in seen:
            seen.add(v)
            out.append(v)
    return out


def _generate_share_code(db: Session, attempts: int = 5) -> str:
    # 12자 URL-safe 코드. 충돌(희박) 시 재생성.
    for _ in range(attempts):
        code = secrets.token_urlsafe(9)[:12]
        exists = db.query(BookmarkShare.id).filter(BookmarkShare.share_code == code).first()
        if not exists:
            return code
    raise HTTPException(status_code=500, detail="failed to generate share code")


@router.post("/post/share", response_model=ShareCreateResponse)
def create_bookmark_share(body: ShareCreateRequest, db: Session = Depends(get_db)):
    # 로그인 여부 무관 — 클라이언트가 들고 있는 plcy_no 스냅샷을 그대로 저장
    requested = _dedupe_preserve_order(body.plcy_nos)
    existing = {
        row[0]
        for row in db.query(Policy.plcy_no).filter(Policy.plcy_no.in_(requested)).all()
    }
    plcy_nos = [p for p in requested if p in existing]
    if not plcy_nos:
        raise HTTPException(status_code=400, detail="no valid policies to share")

    now = datetime.now(timezone.utc)

    # 동일한 찜 목록(구성 무관, 순서 무관)에 대해 아직 만료되지 않은 공유 링크가 있으면 재사용 —
    # 매 클릭마다 새 URL이 생기지 않도록 함. 배열 순서 그대로 비교(==)하면 찜 해제/재추가로
    # 순서만 바뀌어도 다른 스냅샷으로 오판되므로, 정렬된 값으로 비교한다.
    sorted_key = sorted(plcy_nos)
    same_length_candidates = (
        db.query(BookmarkShare)
        .filter(func.array_length(BookmarkShare.plcy_nos, 1) == len(plcy_nos))
        .filter(or_(BookmarkShare.expires_at.is_(None), BookmarkShare.expires_at > now))
        .order_by(BookmarkShare.created_at.desc())
        .all()
    )
    existing_share = next(
        (row for row in same_length_candidates if sorted(row.plcy_nos) == sorted_key),
        None,
    )
    if existing_share is not None:
        return ShareCreateResponse(
            share_code=existing_share.share_code, expires_at=existing_share.expires_at
        )

    share = BookmarkShare(
        share_code=_generate_share_code(db),
        plcy_nos=plcy_nos,
        created_at=now,
        expires_at=now + timedelta(days=SHARE_LINK_EXPIRY_DAYS),
    )
    db.add(share)
    db.commit()
    db.refresh(share)
    return ShareCreateResponse(share_code=share.share_code, expires_at=share.expires_at)


@router.get("/get/share/{share_code}", response_model=PolicyListResponse)
def get_bookmark_share(share_code: str, db: Session = Depends(get_db)):
    share = (
        db.query(BookmarkShare)
        .filter(BookmarkShare.share_code == share_code)
        .first()
    )
    if share is None:
        raise HTTPException(status_code=404, detail="share not found")
    if share.expires_at is not None and share.expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=404, detail="share expired")

    rows = (
        db.query(Policy, PolicyStats.inq_cnt)
        .outerjoin(PolicyStats, PolicyStats.plcy_no == Policy.plcy_no)
        .filter(Policy.plcy_no.in_(share.plcy_nos), Policy.is_active.is_(True))
        .all()
    )
    # 스냅샷 순서 보존 — 비활성화/삭제된 정책은 자연히 제외됨
    by_no = {p.plcy_no: (p, inq_cnt) for p, inq_cnt in rows}
    ordered = [by_no[no] for no in share.plcy_nos if no in by_no]

    items = [_to_card(p, inq_cnt) for p, inq_cnt in ordered]
    return PolicyListResponse(total=len(items), page=1, size=len(items) or 1, items=items)
