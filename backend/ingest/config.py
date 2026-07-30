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

# ── AI 요약(summarizer) ──
SUMMARY_MAX_PER_RUN = 300        # 동기 모드 회당 상한 — 크론 시간·비용 bound. 잔여는 다음 회차가
                                 # 자연 소화(drip backfill)하므로 백필 없이도 수 회차면 전량 커버
SUMMARY_MAX_TOKENS = 1024        # 요약 1건 출력 상한 (4필드 합산으로 충분)
SUMMARY_INPUT_MAX_CHARS = 6000   # 정책 1건 입력 절단 상한 (비용 bound)
SUMMARY_ONE_LINER_MAX = 80       # policy_summary.one_liner VARCHAR(80)과 일치 — 초과분 코드에서 절단
SUMMARY_UPSERT_CHUNK = 50        # N건마다 UPSERT+commit — 중간 실패에도 처리분 보존
SUMMARY_BATCH_POLL_SEC = 20      # Batch API 폴링 간격
SUMMARY_BATCH_TIMEOUT_SEC = 7200 # Batch 완료 대기 상한(2h) — 초과 시 IngestSummaryError

# 레이트리밋 대응 — 무료 티어(gemini 5 RPM)에서 429가 대량 발생하는 것을 막는다.
# 실패해도 fail-soft(다음 실행 재시도)지만, 스로틀 없이는 회차당 절반 이상이 429로 밀려
# 적체가 누적된다. 분당 상한은 settings.SUMMARY_RPM(환경변수)로 조절.
SUMMARY_RETRY_COUNT = 3          # 429 재시도 횟수 (그 외 오류는 즉시 실패 처리)
SUMMARY_RETRY_BACKOFF_SEC = 20   # 재시도 기본 대기(초) — 응답의 retryDelay가 있으면 그 값 우선
SUMMARY_RETRY_MAX_WAIT_SEC = 90  # 회당 대기 상한 — 크론이 과도하게 길어지는 것 방지
