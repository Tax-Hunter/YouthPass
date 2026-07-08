"""
정책 검색 인덱스의 매핑·분석기·동의어 정의 (색인 파이프라인과 검색 쿼리 빌더가 공용).

설계 근거: workflow/18_feat/phase1_ES도입계획.md 7절(매핑)·12절(동의어)
- 분석기 2종: korean_index(색인), korean_search(검색 — synonym_graph 추가).
  동의어를 검색 시점에만 적용하므로 사전 수정 시 재색인이 필요 없다.
- dday/days 등 시점 파생값과 raw_data 코드 필터 필드는 의도적으로 색인하지 않는다
  (파생값은 응답 조립 시 KST 계산, 코드 필터는 PostgreSQL 경로 영구 유지).
- dynamic: strict — 색인 파이프라인이 정의 밖 필드를 넣으면 즉시 실패시켜 매핑 드리프트를 방지.
"""

# 검색 시점 동의어 시드 — 통제어휘 17종·category 5종 기반, 수동 큐레이션으로 확장.
# 주의: 코퍼스 준불용어는 넣지 말 것 — '사업'은 제목 절반가량('…지원사업')에 등장해
# '창업' 질의의 매칭 집합을 폭증시키는 것이 실측으로 확인되어 제거함 (적대적 검증 F-12).
SYNONYMS = [
    "일자리, 취업, 구직, 채용, 인턴, 일경험",
    "주거, 월세, 전세, 임대, 보증금",
    "금융, 대출, 이자, 적금, 통장, 계좌",
    "교육, 훈련, 강의, 교육비",
    "창업, 벤처",
    "지원금, 수당, 바우처, 보조금",
]

# 조사·어미·접사 등 검색 의미가 없는 품사 제거 (nori_part_of_speech 기본 셋 기준)
_POS_STOPTAGS = [
    "E", "IC", "J", "MAG", "MAJ", "MM",
    "SP", "SSC", "SSO", "SC", "SE",
    "XPN", "XSA", "XSN", "XSV",
    "UNA", "NA", "VSV",
]

ANALYSIS = {
    "tokenizer": {
        "korean_nori": {
            "type": "nori_tokenizer",
            # mixed: 복합어를 분해하되 원형 토큰도 보존 ("청년도약계좌" → 청년/도약/계좌 + 원형)
            "decompound_mode": "mixed",
        },
        # 검색(=동의어 파싱) 전용: 복합어를 분해하지 않는다(none).
        # synonym_graph는 동의어 규칙의 각 항을 같은 분석기 체인으로 파싱하는데, mixed가 만드는
        # 스택 토큰(position increment 0)은 Lucene 동의어 파서가 거부하고 lenient가 '조용히'
        # 버린다 — 지원금/보조금/교육비 같은 복합어 규칙이 무음 소실되는 함정.
        # 질의 원형 토큰은 색인측 mixed가 보존한 원형과 매칭되므로 recall 손실 없음.
        "korean_nori_query": {
            "type": "nori_tokenizer",
            "decompound_mode": "none",
        },
        # 정책명 리터럴 안전망용 문자 n-gram (2~3자).
        # nori가 신조어 정책명을 오분절해 핵심 형태소를 잃는 경우(예: '청년도전지원사업' →
        # 도/J 삭제로 '도전' 토큰 소실 — 실측 21/33건 recall 누락) ILIKE 이상의 부분문자열
        # recall을 보장한다. 색인·검색 동일 분석기 사용.
        "korean_ngram": {
            "type": "ngram",
            "min_gram": 2,
            "max_gram": 3,
            "token_chars": ["letter", "digit"],
        },
    },
    "filter": {
        "korean_pos": {
            "type": "nori_part_of_speech",
            "stoptags": _POS_STOPTAGS,
        },
        "search_synonyms": {
            "type": "synonym_graph",
            "synonyms": SYNONYMS,
            "lenient": True,
        },
    },
    "analyzer": {
        "korean_index": {
            "type": "custom",
            "tokenizer": "korean_nori",
            "filter": ["korean_pos", "lowercase"],
        },
        "korean_search": {
            "type": "custom",
            "tokenizer": "korean_nori_query",
            "filter": ["korean_pos", "lowercase", "search_synonyms"],
        },
        "korean_ngram_analyzer": {
            "type": "custom",
            "tokenizer": "korean_ngram",
            "filter": ["lowercase"],
        },
    },
}


def _korean_text() -> dict:
    return {
        "type": "text",
        "analyzer": "korean_index",
        "search_analyzer": "korean_search",
    }


MAPPINGS = {
    "dynamic": "strict",
    "properties": {
        # 식별·정렬 (문서 _id도 plcy_no를 사용하지만 tiebreak 정렬용 필드로 중복 보유)
        "plcy_no": {"type": "keyword"},
        # 텍스트 검색 대상 — plcy_nm.ngram은 nori 오분절 대비 리터럴 안전망(부분문자열 recall)
        "plcy_nm": {**_korean_text(), "fields": {
            "ngram": {"type": "text", "analyzer": "korean_ngram_analyzer"},
        }},
        "plcy_expln_cn": _korean_text(),
        "plcy_sprt_cn": _korean_text(),
        "mclsf_nm": _korean_text(),
        "sprvsn_inst_cd_nm": _korean_text(),
        # keywords: terms 필터(overlap 의미론) + 텍스트 검색 겸용
        "keywords": {"type": "keyword", "fields": {"text": _korean_text()}},
        # 필터 필드 (backend/app/api/routes/policy/policy.py _apply_base_filters 의미론과 1:1)
        "category": {"type": "keyword"},
        "region_sido": {"type": "keyword"},
        "is_nationwide": {"type": "boolean"},
        "sprt_trgt_min_age": {"type": "integer"},
        "sprt_trgt_max_age": {"type": "integer"},
        "aply_prd_se_cd": {"type": "keyword"},
        "apply_end_date": {"type": "date"},
        "is_always_open": {"type": "boolean"},
        "is_active": {"type": "boolean"},
        # 정렬 신호
        "first_seen_at": {"type": "date"},
        "inq_cnt": {"type": "integer"},
    },
}


def index_body() -> dict:
    """인덱스 생성용 전체 body — ingest 색인 파이프라인(reindex/부트스트랩)이 사용."""
    return {
        "settings": {
            "number_of_shards": 1,
            "number_of_replicas": 0,
            "analysis": ANALYSIS,
        },
        "mappings": MAPPINGS,
    }
