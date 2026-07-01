"""
정책 분류 어휘 — 적재된 DB 2,635건에서 역추출한 권위 출처 (2026-06-29).

추측 매핑 금지(과거 is_always_open 888건 오분류 교훈). 본 값은 현재 적재본과 1:1 일치하도록
실데이터에서 역추출했다.
- CATEGORY_MCLSF_MAP: 중분류(mclsfNm) 토큰 → 정규화 category(5종)
- '권익보호'만 부모 대분류(lclsfNm) 의존 → resolve_category에서 분기
- 다중 중분류는 CATEGORY_PRIORITY로 단일 선택
- KEYWORD_VOCAB: plcyKywdNm 중 이 17종만 keywords[] 로 채택
"""
from typing import List, Optional

# ── 통제 키워드 17종 ──
KEYWORD_VOCAB = frozenset({
    "교육지원", "보조금", "맞춤형상담서비스", "장기미취업청년", "주거지원",
    "중소기업", "인턴", "바우처", "벤처", "해외진출", "출산", "대출",
    "금리혜택", "육아", "청년가장", "공공임대주택", "신용회복",
})

# ── 정규화 category 5종 ──
CATEGORY_VOCAB = ("일자리", "생활", "교육", "금융", "주거")

# 다중분류 시 단일 선택 우선순위 (앞일수록 높음). 데이터 검증: 일자리>교육, 금융>생활.
CATEGORY_PRIORITY = ("주거", "금융", "일자리", "교육", "생활")
_PRIORITY_RANK = {c: i for i, c in enumerate(CATEGORY_PRIORITY)}

# ── 중분류 토큰 → category (단일 의존, 18토큰) ──
CATEGORY_MCLSF_MAP = {
    "취업": "일자리", "창업": "일자리", "재직자": "일자리",
    "미래역량강화": "교육", "교육비지원": "교육", "온·오프라인교육": "교육", "온라인교육": "교육",
    "주택 및 거주지": "주거", "전월세 및 주거급여 지원": "주거", "기숙사": "주거",
    "취약계층 및 금융지원": "금융",
    "문화활동 및 생활지원": "생활", "문화활동": "생활", "건강": "생활",
    "예술인지원": "생활", "청년참여": "생활", "정책인프라구축": "생활", "청년국제교류": "생활",
}

# 부모 대분류 의존 토큰: '권익보호' → lclsfNm에 '일자리' 있으면 일자리, 아니면 생활(참여)
PARENT_DEPENDENT_TOKEN = "권익보호"


def _split_tokens(text: Optional[str]) -> List[str]:
    if not isinstance(text, str) or not text:
        return []
    return [t.strip() for t in text.split(",") if t.strip()]


def resolve_category(mclsf_nm: Optional[str], lclsf_nm: Optional[str]) -> Optional[str]:
    """중분류(+대분류)로부터 정규화 category 단일값 도출. 매핑 실패 시 None."""
    cats = []
    for tok in _split_tokens(mclsf_nm):
        if tok in CATEGORY_MCLSF_MAP:
            cats.append(CATEGORY_MCLSF_MAP[tok])
        elif tok == PARENT_DEPENDENT_TOKEN:
            cats.append("일자리" if (lclsf_nm and "일자리" in lclsf_nm) else "생활")
    if not cats:
        return None
    # 우선순위가 가장 높은(랭크가 작은) category 선택
    return min(cats, key=lambda c: _PRIORITY_RANK[c])


def filter_keywords(plcy_kywd_nm: Optional[str]) -> List[str]:
    """plcyKywdNm 콤마분할 → 통제어휘 17종 교집합(중복 제거, 등장순)."""
    out, seen = [], set()
    for tok in _split_tokens(plcy_kywd_nm):
        if tok in KEYWORD_VOCAB and tok not in seen:
            seen.add(tok)
            out.append(tok)
    return out
