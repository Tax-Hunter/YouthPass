"""
정책 도메인 상수 — 환경 무관 참조 데이터.

배포 환경에 따라 바뀌지 않는 도메인 값(코드/라벨/정제규칙)
"""

# 시도 코드 → 한글 라벨
SIDO_LABELS = {
    "11": "서울", "26": "부산", "27": "대구", "28": "인천", "29": "광주",
    "30": "대전", "31": "울산", "36": "세종", "41": "경기", "43": "충북",
    "44": "충남", "46": "전남", "47": "경북", "48": "경남", "50": "제주",
    "51": "강원", "52": "전북",
}

# 온통청년 zipCd는 광주/전남을 표준코드(29/46) 대신 "12" 상위코드로 묶는다.
# 3자리로 갈림 — 광주광역시=122·123, 전라남도=121·127·128 (실데이터 확인).
# 적재(transform._region)가 zipCd→시도 매핑 시 앞2자리 "12"는 이 표로 3자리 판별.
ZIP12_SIDO = {"122": "29", "123": "29", "121": "46", "127": "46", "128": "46"}

# 신청기간구분 코드 (코드정의서) — 마감의 단일 진실
APLY_PRD_ALWAYS = "0057002"   # 상시
APLY_PRD_CLOSED = "0057003"   # 마감

# category 미분류(NULL) 폴백 라벨
CATEGORY_FALLBACK = "기타"

# 찜 목록 공유 링크(bookmark_shares) 만료 기간
SHARE_LINK_EXPIRY_DAYS = 30

# raw_data 텍스트(정제 전 원본)의 placeholder → 정보 없음으로 간주
RAW_PLACEHOLDERS = {
    "-", ".", "해당없음", "해당 없음", "해당사항없음", "해당사항 없음",
    "없음", "미정", "별도문의", "별도 문의", "n/a",
}

# 자격요건 raw_data 키 → 해당 그룹 '제한없음' cd (단독이면 표시 생략)
REQ_NOLIMIT = {
    "jobCd": "0013010",          # 취업상태
    "schoolCd": "0049010",       # 학력
    "plcyMajorCd": "0011009",    # 전공
    "sbizCd": "0014010",         # 특화분야
}

# 코드 기반 검색(/get/search) 필터 스펙 — 온통청년 코드정의서 기준.
#   source : 'raw_multi'(raw_data 콤마 다중값) | 'raw_single'(raw_data 단일값) | 'column'(DB 컬럼)
#   grp    : 코드 그룹 접두어(4자리) — 형식 검증용(형식 불일치 코드는 조용히 무시)
#   nolimit: 제한없음/무관 cd (있으면 필터 시 자동 포함, None이면 미적용)
CODE_FILTERS = {
    "job":         {"raw_key": "jobCd",           "source": "raw_multi",  "grp": "0013", "nolimit": "0013010"},
    "school":      {"raw_key": "schoolCd",        "source": "raw_multi",  "grp": "0049", "nolimit": "0049010"},
    "major":       {"raw_key": "plcyMajorCd",     "source": "raw_multi",  "grp": "0011", "nolimit": "0011009"},
    "sbiz":        {"raw_key": "sbizCd",          "source": "raw_multi",  "grp": "0014", "nolimit": "0014010"},
    "pvsn_method": {"raw_key": "plcyPvsnMthdCd",  "source": "raw_single", "grp": "0042", "nolimit": None},
    "inst_group":  {"raw_key": "pvsnInstGroupCd", "source": "raw_single", "grp": "0054", "nolimit": None},
    # income 은 '조건 유형 분류자'(자격은 earn_min/max_amt가 담당) + 기본값이 무관(0043001)이라 다수.
    # 무관 자동포함 시 연소득/기타 필터가 무력화되므로 nolimit=None(자동포함 제외). 0043001 명시 필터는 여전히 동작.
    "income":      {"raw_key": "earn_cnd_se_cd",  "source": "column",     "grp": "0043", "nolimit": None},
    "marriage":    {"raw_key": "mrg_stts_cd",     "source": "column",     "grp": "0055", "nolimit": "0055003"},
}
