"""
client.py — 온통청년 getPlcy 전수 수집 (I/O 전담).

원본을 손실 없이 가져오는 데만 책임진다. 정제·content_hash·검증·DB 적재는 일절 하지 않음.
반환: (raw_items: list[dict], meta: FetchMeta).

- 엔드포인트는 settings.YOUTH_API_BASE_URL(.env), pageSize/MAX_PAGES 등 튜닝상수는 ingest.config
- apiKeyNm 인증, rtnType=json, totCount 도달 시 종료, plcyNo dedup
- 정부서버 봇차단(403) 우회: Chrome UA + Accept + Referer
- 페이지 단위 재시도. getPlcy가 간헐적 4xx를 던지므로 모든 비-200 응답을 재시도한다.
"""
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import List, Optional, Tuple

import httpx

from app.core.config import settings
from ingest.config import (
    BROWSER_HEADERS,
    MAX_PAGES,
    PAGE_SIZE,
    RETRY_BACKOFF_SEC,
    RETRY_COUNT,
    TEMPLATE_HINTS,
    TIMEOUT_SEC,
)
from ingest.errors import IngestConfigError, IngestFetchError


@dataclass(frozen=True)
class FetchMeta:
    source: str
    endpoint: str
    fetched_at: datetime    # run_ts(UTC) — 하류 synced_at/last_seen_at/소프트만료 기준
    tot_count: int          # API 선언 totCount(첫 페이지 스냅샷)
    fetched_count: int      # dedup 후 실제 수집 건수
    pages_fetched: int
    duplicates: int
    is_partial: bool        # 부분수집(limit/MAX_PAGES) — 소프트만료 스킵 신호


def _validate_api_key(api_key: Optional[str]) -> str:
    """빈값/템플릿잔여/비ASCII를 네트워크 호출 전 차단."""
    if not api_key or not api_key.strip():
        raise IngestConfigError("YOUTH_API_KEY 미설정")
    key = api_key.strip()
    low = key.lower()
    if any(h in low for h in TEMPLATE_HINTS):
        raise IngestConfigError(f"YOUTH_API_KEY가 템플릿 값으로 보임: {key[:12]}…")
    if not key.isascii():
        raise IngestConfigError("YOUTH_API_KEY에 비ASCII 문자 포함(템플릿 잔여 의심)")
    return key


def _extract(payload) -> Tuple[List[dict], int]:
    """응답 → (youthPolicyList, totCount). resultCode·스키마·오타입 방어."""
    if not isinstance(payload, dict):
        raise IngestFetchError(f"응답이 JSON 객체 아님: {type(payload).__name__}(스키마 변경 의심)")
    code = str(payload.get("resultCode", ""))
    if code != "200":
        raise IngestFetchError(f"API resultCode={code}: {payload.get('resultMessage')}")
    result = payload.get("result")
    if not isinstance(result, dict):
        raise IngestFetchError("응답에 result 객체 없음(스키마 변경 의심)")
    items = result.get("youthPolicyList")
    if items is None:
        raise IngestFetchError("응답에 youthPolicyList 키 없음(스키마 변경 의심)")
    if not isinstance(items, list):
        raise IngestFetchError(f"youthPolicyList가 list 아님: {type(items).__name__}(스키마 변경 의심)")
    pagging = result.get("pagging")
    raw_tot = (pagging if isinstance(pagging, dict) else {}).get("totCount", 0)
    try:
        tot = int(raw_tot)
    except (TypeError, ValueError):
        tot = 0
    return items, tot


def _fetch_page(client: httpx.Client, api_key: str, page_num: int, page_size: int) -> Tuple[List[dict], int]:
    # getPlcy는 동일 요청에도 간헐적 4xx(특히 400)를 반환하므로 모든 비-200 응답을 재시도한다.
    # (인증키의 명백한 오류는 _validate_api_key가 호출 전 차단)
    params = {"apiKeyNm": api_key, "rtnType": "json", "pageNum": page_num, "pageSize": page_size}
    last_err = None
    for attempt in range(1, RETRY_COUNT + 1):
        try:
            r = client.get(settings.YOUTH_API_BASE_URL, params=params, headers=BROWSER_HEADERS, timeout=TIMEOUT_SEC)
            if r.status_code == 200:
                return _extract(r.json())
            last_err = IngestFetchError(f"HTTP {r.status_code}: {r.text[:120]}")
        except (httpx.HTTPError, ValueError) as e:
            last_err = e
        if attempt < RETRY_COUNT:
            time.sleep(RETRY_BACKOFF_SEC * attempt)
    raise IngestFetchError(f"페이지 {page_num} 수집 실패(재시도 {RETRY_COUNT}회 소진): {last_err}")


def fetch_all_policies(
    *,
    api_key: Optional[str] = None,
    page_size: int = PAGE_SIZE,
    max_pages: int = MAX_PAGES,
    limit: Optional[int] = None,
    client: Optional[httpx.Client] = None,
) -> Tuple[List[dict], FetchMeta]:
    """getPlcy 전수 수집. 정제·검증 없음. (raw_items, FetchMeta) 반환."""
    key = _validate_api_key(api_key if api_key is not None else settings.YOUTH_API_KEY)
    run_ts = datetime.now(timezone.utc)
    own_client = client is None
    client = client or httpx.Client()

    seen: set = set()
    items: List[dict] = []
    duplicates = 0
    tot_count = 0
    pages = 0
    is_partial = False
    try:
        for page_num in range(1, max_pages + 1):
            batch, tot = _fetch_page(client, key, page_num, page_size)
            if page_num == 1:
                tot_count = tot          # 첫 페이지 totCount를 스냅샷으로 고정
            pages += 1
            if not batch:
                break                    # 빈 페이지 = 종료
            for it in batch:
                no = (it.get("plcyNo") or "").strip()
                if no:
                    if no in seen:
                        duplicates += 1
                        continue
                    seen.add(no)
                items.append(it)
            if limit is not None and len(items) >= limit:
                items = items[:limit]
                is_partial = True
                break
            if tot_count and len(seen) >= tot_count:
                break                    # 전수 도달
        else:
            is_partial = True            # MAX_PAGES 도달(전수 미보장)
    finally:
        if own_client:
            client.close()

    meta = FetchMeta(
        source="youthcenter.getPlcy",
        endpoint=settings.YOUTH_API_BASE_URL,
        fetched_at=run_ts,
        tot_count=tot_count,
        fetched_count=len(items),
        pages_fetched=pages,
        duplicates=duplicates,
        is_partial=is_partial,
    )
    return items, meta
