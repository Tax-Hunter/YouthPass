"""
정책 검색 인덱스의 매핑·분석기·사전 정의 (색인 파이프라인과 검색 쿼리 빌더 공용).

⚠ 이 파일의 분석기·동의어·사용자 사전은 인덱스 settings에 구워진다.
  수정하면 `python -m ingest.run reindex` 1회 필수 — 안 하면 구 설정으로 계속 검색된다.

- dday 등 시점 파생값과 raw_data 코드 필터는 색인하지 않는다
  (파생값은 응답 조립 시 KST 계산, 코드 필터는 PostgreSQL 경로 영구 유지).
- dynamic: strict — 정의 밖 필드가 들어오면 즉시 실패시켜 매핑 드리프트를 막는다.

설계 근거: workflow/18_feat/phase1_ES도입계획.md 7·12절
"""

# 검색 시점 동의어. 전 그룹 **단방향(=>)** — 광의어 검색만 협의어로 확장하고 역방향은 막는다.
# 동치(,)로 두면 광의어가 설명문 상투구("주거 안정")에 걸려 협의어 질의를 수 배로 부풀린다.
# 판정 기준은 문서빈도(df) 10% 이상 = 광의어 → 반드시 왼쪽에만 (실측 근거: phase12).
# ⚠ 등재 금지(df): 지원 90.9% / 청년 75.1% / 사업 51.9% — 오른쪽에 넣는 순간 코퍼스 절반과 매칭된다.
SYNONYMS = [
    "일자리, 취업 => 일자리, 취업, 구직, 채용, 인턴, 일경험",
    "주거 => 주거, 월세, 전세, 임대, 보증금",
    "금융 => 금융, 대출, 이자, 적금, 통장, 계좌",
    "교육 => 교육, 훈련, 강의, 교육비",
    "창업 => 창업, 벤처",
    "지원금 => 지원금, 수당, 바우처, 보조금",
]

# nori가 오분해해 의미 음절을 통째로 잃는 정책 고유명사 사전.
# 예: '청년도약계좌' → 청년+도(J)+약(MM)+계좌 → 조사·관형사 제거로 '도약' 소실.
#
# ⚠ 반드시 분해형("원어 부분어1 부분어2 …")으로 등재한다. 단일 등재는 복합어를 통짜 토큰
#   하나로만 색인해 부분어 recall을 깬다(실측: '제도' -8건, q='내일배움카드' 1위→10위).
# ⚠ 부분어를 이어붙인 문자열이 원어와 정확히 일치해야 한다. 길면 인덱스 생성이 400으로
#   실패하지만 **짧으면 오류 없이 엉뚱한 토큰을 만든다** — tests/test_es_indexer.py가 검사한다.
#
# 등재 기준: 코퍼스 전수 스캔에서 2음절 이상 의미어가 소실된 86건
USER_DICT = [
    # 도약 — 도(J)+약(MM) 오분해
    "청년도약계좌 청년 도약 계좌",
    "청년도약 청년 도약",
    "청년일자리도약장려금 청년 일자리 도약 장려금",
    "창업도약패키지 창업 도약 패키지",
    "취업도약 취업 도약",
    # 도전 — 문맥에 따라 도(J)+전(MM) 오분해
    "청년도전 청년 도전",
    # 이음 — 이(VCP)+음(E) 오분해 (최다 소실어)
    "고용이음 고용 이음",
    "꿈이음 꿈 이음",
    "희망이음 희망 이음",
    "마음이음 마음 이음",
    "청년이음전주 청년 이음 전주",
    "청년이어드림 청년 이어 드림",
    # 케이션 — 케이(XSV) 오분해
    "워케이션",
    "런케이션",
    # 브랜드·지명 오분해
    "아이플러스 아이 플러스",
    "중랑구 중랑 구",
    # 내일 — nori는 MAG(부사)로 정상 태깅하나 _POS_STOPTAGS가 제거한다.
    # 축약형('내일배움카드')도 등재한다 — 실사용 표기이며, 없으면 상위가 무관 카드 정책으로 채워진다.
    "내일채움공제 내일 채움 공제",
    "내일배움카드 내일 배움 카드",
    "국민내일배움카드 국민 내일 배움 카드",
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
            "user_dictionary_rules": USER_DICT,
        },
        # 검색측은 분해하지 않는다(none) — mixed가 만드는 스택 토큰(position increment 0)을
        # Lucene 동의어 파서가 거부하고 lenient가 조용히 버려서 복합어 동의어 규칙이 무음
        # 소실된다. 원형 토큰은 색인측 mixed가 보존하므로 recall 손실은 없다.
        # ⚠ 사전은 색인·검색 양쪽에 모두 걸 것 — 한쪽만이면 색인·질의 토큰이 어긋난다.
        "korean_nori_query": {
            "type": "nori_tokenizer",
            "decompound_mode": "none",
            "user_dictionary_rules": USER_DICT,
        },
        # nori 오분절로 형태소를 잃는 경우의 리터럴 안전망(2~3자). 색인·검색 동일 분석기.
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
        # 정확 문구 부스트 전용 — POS 불용어 필터를 쓰지 않는다.
        # 불용어를 지우면 위치 간격이 남아 문구가 '청년 ? ? 계좌' 같은 와일드카드가 되어 무관
        # 제목과 오매칭된다(간격 있는 제목이 코퍼스의 42%). 동의어도 없어 문구 의미가 유지된다.
        "korean_phrase": {
            "type": "custom",
            "tokenizer": "korean_nori",
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
        # 식별·정렬 (문서 _id도 plcy_no지만 tiebreak 정렬용으로 필드도 보유)
        "plcy_no": {"type": "keyword"},
        # 서브필드: ngram=리터럴 안전망, phrase=정확 문구 부스트 전용(위 분석기 주석 참조)
        "plcy_nm": {**_korean_text(), "fields": {
            "ngram": {"type": "text", "analyzer": "korean_ngram_analyzer"},
            "phrase": {
                "type": "text",
                "analyzer": "korean_phrase",
                "search_analyzer": "korean_phrase",
            },
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
