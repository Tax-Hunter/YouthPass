"""
ingest 파이프라인 운영 상수 (환경 무관).

수집(client)·적재(loader)의 동작 파라미터(페이지·재시도·타임아웃·배치·헤더).
외부 엔드포인트 URL은 환경마다 교체 가능하도록 app.core.config.settings.YOUTH_API_BASE_URL(.env)로 분리.
"""

# ── 수집(client) ──
PAGE_SIZE = 300          # 약 9페이지에 전수
MAX_PAGES = 50           # 무한루프 방어(현재치의 5배 여유)
RETRY_COUNT = 3
TIMEOUT_SEC = 30
RETRY_BACKOFF_SEC = 2.0  # 재시도 백오프 기준(attempt 배수)

# 정부서버 봇차단(403) 우회 — python-requests 기본 UA가 차단되므로 브라우저로 위장
BROWSER_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"
    ),
    "Accept": "application/json, text/plain, */*",
    "Referer": "https://www.youthcenter.go.kr/",
}

# 인증키 템플릿 잔여 문자 검출 힌트
TEMPLATE_HINTS = ("여기에", "your", "발급", "changeme", "xxxx", "{{")

# ── 적재(loader) ──
LOAD_BATCH_SIZE = 500          # UPSERT 청크 크기 (ES bulk 청크에도 공용)
SOFT_EXPIRE_MAX_RATE = 0.30    # 1회 소프트만료 상한(현 활성 대비). 초과 시 부분수집/빈입력 의심 → 만료 스킵

# 적재 동시실행 방지 advisory lock 키. "YP10"(YouthPass #10) ASCII 인코딩.
# 배포 후 변경 금지 — 운영 중 바꾸면 이전 실행이 잡은 락을 못 풀어 orphan 발생.
LOAD_LOCK_KEY = 0x59503130

# ── ES 색인(es_indexer) ──
# 검색용 타임아웃(settings.ES_TIMEOUT_S, 기본 2s)은 bulk 색인에 부족 — 색인 작업 전용 상한
ES_INDEX_TIMEOUT_SEC = 30
