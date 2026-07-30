"""
summarizer.py — 정책 AI 요약 배치 생성 (Claude API → policy_summary UPSERT).

증분 원리: policy_summary.source_hash(생성 시점의 content_hash)가 현재
policy.content_hash와 다르거나 요약이 없으면 재요약 대상. 실패분은 source_hash가
갱신되지 않으므로 다음 실행이 자동 재시도한다(별도 재시도 큐 불필요).

fail-open 계약(Redis/ES와 동일): SUMMARY_API_KEY 빈값이면 skipped 리포트만 반환.
서빙은 policy_summary 테이블만 읽으므로 이 모듈 실패가 API 응답을 깨지 않는다
(요약 없는 정책은 카드/상세에서 원문 폴백).

공급자 이원화: SUMMARY_MODEL 프리픽스로 판별 — claude-*=Anthropic, gemini-*=Google.
env(SUMMARY_MODEL·SUMMARY_API_KEY)만 바꾸면 코드 수정 없이 공급자 전환.
LLM SDK는 지연 import — 웹 서비스 경로(app.*)에 의존성을 전파하지 않는다.
"""
import re
import sys
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import List, Optional

from pydantic import BaseModel
from sqlalchemy import or_
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.models import Policy, PolicySummary
from app.db.session import SessionLocal
from ingest.config import (
    SUMMARY_INPUT_MAX_CHARS,
    SUMMARY_MAX_PER_RUN,
    SUMMARY_MAX_TOKENS,
    SUMMARY_ONE_LINER_MAX,
    SUMMARY_RETRY_BACKOFF_SEC,
    SUMMARY_RETRY_COUNT,
    SUMMARY_RETRY_MAX_WAIT_SEC,
    SUMMARY_UPSERT_CHUNK,
)
from ingest.errors import IngestSummaryError


class SummaryOutput(BaseModel):
    """Claude structured output 스키마 — 4필드 전부 required string, 모르면 빈 문자열."""

    one_liner: str
    benefit: str
    target: str
    how_to_apply: str


# 검증·후처리(공백 정규화·길이 절단·빈값→NULL)는 _build_row가 수행 — 프롬프트는 형식 가이드만.
# v2 (phase2 피드백 반영): "지역+나이 축약"으로 자격 조건이 탈락하는 실패 패턴 방어 —
# one_liner만 짧게, 나머지 필드는 길이보다 정보 보존(자격 판단·신청 준비 가능성)이 우선.
_SYSTEM_PROMPT = """당신은 대한민국 청년 정책 안내 서비스의 요약 작성자다. \
입력으로 주어진 정책 원문을 청년이 빠르게 이해할 수 있게 요약한다.

핵심 원칙: 요약의 목적은 "짧게 줄이기"가 아니라 "사용자가 상세 페이지를 다시 열지 않아도
자격 판단('나 해당되나?')과 신청 준비를 할 수 있게 하기"다. one_liner를 제외한 필드는
길이보다 정보 보존이 우선이다.

규칙:
1. 원문에 없는 사실을 만들지 마라. 금액·기간·연령·기관명은 원문에 있는 값만 사용한다.
2. 원문에서 확인할 수 없는 항목은 빈 문자열("")로 남겨라. 추측 금지.
   나이를 출생연도로 환산하는 등 원문에 없는 계산·환산 값을 새로 만들지 마라
   (단위 표기 변환은 허용: 122백만원 → 1억2200만원).
3. 자격·선별 조건은 절대 생략하지 마라. 연령·지역 외에도 소득 기준 금액, 대상 상태·활동
   요건(구직자, 재학생, 시험 응시자, 정서·심리 지원 필요 등), 우선선발·가점 대상,
   제외 대상이 원문에 있으면 전부 담아라. 지역과 나이만 남기고 줄이는 것은 실패다.
   정책명·설명이 특정 집단을 지칭하는 명칭으로 대상을 한정하면(예: 찬찬히 청년(느린학습자),
   자립준비청년, 임신부) 그 집단명도 target에 자격 조건으로 명시하라.
4. 행정 용어는 일상어로 풀어 쓴다. 존댓말·인사말·이모지 금지, 간결한 서술형.
5. 필드별 형식:
   - one_liner: 50자 이내 한 줄. "누가 무엇을 받는다"가 드러나게. 정책명 반복 금지.
   - benefit: 받는 혜택. 금액·횟수·기간·한도가 원문에 있으면 반드시 포함. 1~3문장.
   - target: 받을 수 있는 사람의 모든 선별 조건(규칙 3) — 정보 손실 없이 1~4문장.
   - how_to_apply: 신청 채널(사이트 URL·이메일 주소·방문처)과 접수 기간, 제출 서류를
     원문에 있으면 반드시 포함. 1~3문장. 원문에 없으면 빈 문자열."""


@dataclass
class SummarizeReport:
    total_stale: int = 0      # 이번 실행 시작 시점의 전체 재요약 대상 수
    summarized: int = 0       # 생성·저장 성공
    failed: int = 0           # 항목별 실패(다음 실행이 자동 재시도)
    rate_limited: int = 0     # 429로 재시도한 횟수(성공분 포함) — 무료 티어 여유 판단용
    remaining: int = 0        # 상한(limit) 때문에 이번에 처리하지 못한 잔여
    skipped: bool = False     # SUMMARY_API_KEY 미설정 → 기능 비활성
    dry_run: bool = False
    model: str = ""

    def summary(self) -> str:
        if self.skipped:
            return "[요약] SUMMARY_API_KEY 미설정 — 스킵(기능 비활성)"
        if self.dry_run:
            return f"[요약 DRY-RUN] 재요약 대상 {self.total_stale}건 (API 호출·쓰기 없음)"
        rl = f" / 429재시도 {self.rate_limited}" if self.rate_limited else ""
        return (
            f"[요약 {self.model}] 대상 {self.total_stale} / 생성 {self.summarized} "
            f"/ 실패 {self.failed}{rl} / 잔여 {self.remaining}"
        )


def _provider(model_id: str) -> str:
    """모델 ID 프리픽스로 공급자 판별. 미지 프리픽스는 즉시 설정 오류로 승격."""
    if model_id.startswith("gemini"):
        return "google"
    if model_id.startswith("claude"):
        return "anthropic"
    raise IngestSummaryError(
        f"SUMMARY_MODEL '{model_id}'의 공급자를 판별할 수 없습니다 (claude-* 또는 gemini-*)."
    )


def summary_enabled() -> bool:
    """요약 기능 활성 여부 — API 키가 없으면 비활성(REDIS_URL·ES 빈값 관례와 동일)."""
    return bool(settings.SUMMARY_API_KEY)


def _client(provider: str):
    # 지연 import — ingest 외 경로(웹 서비스)에 LLM SDK 의존성 전파 방지
    if provider == "google":
        from google import genai

        return genai.Client(api_key=settings.SUMMARY_API_KEY)
    # anthropic은 requirements 미포함(운영 모델이 gemini-*) — claude 사용 시에만 설치
    try:
        import anthropic
    except ImportError as e:
        raise IngestSummaryError(
            "claude-* 모델을 쓰려면 anthropic 패키지가 필요합니다: pip install anthropic"
        ) from e

    return anthropic.Anthropic(api_key=settings.SUMMARY_API_KEY)


def _generate_anthropic(client, model_id: str, text: str) -> SummaryOutput:
    resp = client.messages.parse(
        model=model_id,
        max_tokens=SUMMARY_MAX_TOKENS,
        system=[{
            "type": "text",
            "text": _SYSTEM_PROMPT,
            # 순차 호출이 5분 TTL 내에 이어짐 — 프리픽스 캐시로 입력비 절감.
            # 모델 최소 캐시 길이 미달이면 조용히 미적용(무해).
            "cache_control": {"type": "ephemeral"},
        }],
        messages=[{"role": "user", "content": text}],
        output_format=SummaryOutput,
    )
    out = resp.parsed_output
    if out is None:
        raise ValueError(f"structured output 파싱 실패 (stop_reason={resp.stop_reason})")
    return out


def _generate_google(client, model_id: str, text: str) -> SummaryOutput:
    from google.genai import types

    resp = client.models.generate_content(
        model=model_id,
        contents=text,
        config=types.GenerateContentConfig(
            system_instruction=_SYSTEM_PROMPT,
            response_mime_type="application/json",
            response_schema=SummaryOutput,  # Pydantic 스키마 강제 — resp.parsed로 수신
            # Gemini 3.x는 thinking 토큰이 출력 예산에 포함 — 1024면 JSON이 절단되어
            # 파싱 실패함(phase2 실측). 요약 본문(~300)+thinking 여유분으로 4배 확보.
            max_output_tokens=4 * SUMMARY_MAX_TOKENS,
        ),
    )
    out = resp.parsed
    if out is None:
        raise ValueError("structured output 파싱 실패 (Google — 응답 스키마 불일치/차단)")
    return out


def _stale_query(db: Session):
    """재요약 대상: 활성 + 해시 보유 + (요약 없음 OR 본문 변경). content_hash NULL은
    rehash 전 행 — 매 실행 재요약되는 낭비를 막기 위해 제외한다."""
    return (
        db.query(Policy)
        .outerjoin(PolicySummary, PolicySummary.plcy_no == Policy.plcy_no)
        .filter(
            Policy.is_active.is_(True),
            Policy.content_hash.isnot(None),
            or_(
                PolicySummary.plcy_no.is_(None),
                PolicySummary.source_hash.is_distinct_from(Policy.content_hash),
            ),
        )
    )


def _policy_text(p: Policy) -> str:
    """정책 1건 → 프롬프트 입력 텍스트. raw_data 부가 필드까지 포함하되 상한으로 절단."""
    raw = p.raw_data if isinstance(p.raw_data, dict) else {}
    age = ""
    if p.sprt_trgt_min_age is not None or p.sprt_trgt_max_age is not None:
        age = f"{p.sprt_trgt_min_age or ''}~{p.sprt_trgt_max_age or ''}세"
    parts = [
        f"[정책명] {p.plcy_nm}",
        f"[설명] {p.plcy_expln_cn or ''}",
        f"[지원내용] {p.plcy_sprt_cn or ''}",
        f"[연령] {age}",
        f"[신청기간 원문] {p.aply_ymd_raw or ''}",
        f"[신청방법] {raw.get('plcyAplyMthdCn') or ''}",
        f"[제출서류] {raw.get('sbmsnDcmntCn') or ''}",
        f"[추가자격] {raw.get('addAplyQlfcCndCn') or ''}",
        f"[소득조건 기타] {raw.get('earnEtcCn') or ''}",
        f"[주관기관] {p.sprvsn_inst_cd_nm or ''}",
    ]
    return "\n".join(parts)[:SUMMARY_INPUT_MAX_CHARS]


def _clean_opt(v: Optional[str]) -> Optional[str]:
    v = (v or "").strip()
    return v or None


def _build_row(p: Policy, out: SummaryOutput, model_id: str, now: datetime) -> dict:
    one = " ".join((out.one_liner or "").split())  # 개행·연속공백 정규화(카드 한 줄 표시용)
    if not one:
        raise ValueError("one_liner 빈 응답 — 핵심 필드라 실패 처리(다음 실행 재시도)")
    return {
        "plcy_no": p.plcy_no,
        "one_liner": one[:SUMMARY_ONE_LINER_MAX],
        "benefit": _clean_opt(out.benefit),
        "target": _clean_opt(out.target),
        "how_to_apply": _clean_opt(out.how_to_apply),
        "source_hash": p.content_hash,  # 선별 시점 해시 — advisory lock이 동시 load 변경을 차단
        "model": model_id,
        "generated_at": now,
    }


def _flush(db: Session, rows: List[dict], own: bool) -> None:
    """UPSERT + (own 세션이면) 즉시 commit — 중간 실패에도 처리분 보존."""
    if not rows:
        return
    stmt = insert(PolicySummary).values(rows)
    db.execute(stmt.on_conflict_do_update(
        index_elements=["plcy_no"],
        set_={
            "one_liner": stmt.excluded.one_liner,
            "benefit": stmt.excluded.benefit,
            "target": stmt.excluded.target,
            "how_to_apply": stmt.excluded.how_to_apply,
            "source_hash": stmt.excluded.source_hash,
            "model": stmt.excluded.model,
            "generated_at": stmt.excluded.generated_at,
        },
    ))
    if own:
        db.commit()
    rows.clear()


def _is_rate_limited(e: Exception) -> bool:
    s = str(e)
    return "429" in s or "RESOURCE_EXHAUSTED" in s


def _retry_wait(e: Exception, attempt: int) -> float:
    """429 재시도 대기(초). 응답에 retryDelay가 있으면 그 값을, 없으면 지수 백오프."""
    m = re.search(r"retryDelay'?\s*:\s*'?(\d+(?:\.\d+)?)s", str(e))
    if m:
        wait = float(m.group(1)) + 1.0     # 경계 오차 여유
    else:
        wait = SUMMARY_RETRY_BACKOFF_SEC * (2 ** attempt)
    return min(wait, SUMMARY_RETRY_MAX_WAIT_SEC)


def _summarize_sync(db: Session, targets: List[Policy], model_id: str,
                    report: SummarizeReport, own: bool) -> None:
    """동기 순차 호출(cron 증분용). 항목별 실패는 격리 — 카운트 후 계속.

    무료 티어(5 RPM) 대응: 호출 간 최소 간격(SUMMARY_RPM)을 지키고, 그래도 발생하는
    429는 응답의 retryDelay만큼 기다렸다 재시도한다. 재시도까지 소진한 건은 실패로
    집계되지만 source_hash가 갱신되지 않아 다음 실행이 자동으로 다시 처리한다.
    """
    provider = _provider(model_id)
    client = _client(provider)
    generate = _generate_google if provider == "google" else _generate_anthropic
    now = datetime.now(timezone.utc)
    buffer: List[dict] = []

    rpm = max(0, settings.SUMMARY_RPM)
    min_gap = (60.0 / rpm) if rpm else 0.0
    last_call = 0.0
    if min_gap:
        print(f"  · 레이트리밋 준수: {rpm} RPM (호출 간 {min_gap:.0f}초)")

    for p in targets:
        for attempt in range(SUMMARY_RETRY_COUNT + 1):
            gap = last_call + min_gap - time.monotonic()
            if gap > 0:
                time.sleep(gap)
            try:
                last_call = time.monotonic()
                out = generate(client, model_id, _policy_text(p))
                buffer.append(_build_row(p, out, model_id, now))
                report.summarized += 1
                break
            except Exception as e:
                if attempt < SUMMARY_RETRY_COUNT and _is_rate_limited(e):
                    wait = _retry_wait(e, attempt)
                    report.rate_limited += 1
                    print(f"  · 429 — {wait:.0f}초 대기 후 재시도 "
                          f"({attempt + 1}/{SUMMARY_RETRY_COUNT}) {p.plcy_no}", file=sys.stderr)
                    time.sleep(wait)
                    continue
                report.failed += 1
                print(f"  ⚠ 요약 실패 {p.plcy_no}: {type(e).__name__}: {e}", file=sys.stderr)
                break
        if len(buffer) >= SUMMARY_UPSERT_CHUNK:
            _flush(db, buffer, own)
    _flush(db, buffer, own)


def summarize_stale(
    *,
    limit: Optional[int] = None,
    batch: bool = False,
    dry_run: bool = False,
    session: Optional[Session] = None,
) -> SummarizeReport:
    """재요약 대상 선별 → Claude 생성 → policy_summary UPSERT.

    - limit: 이번 실행 처리 상한. None이면 동기 모드는 SUMMARY_MAX_PER_RUN
      (drip backfill — 잔여는 다음 회차), 배치 모드는 전량.
    - batch: Anthropic Message Batches API 사용(백필용, 50% 할인) — claude-* 모델 전용.
      gemini-* 모델은 동기 모드로 전량 처리(저가 모델이라 비용 미미). ※ 6단계에서 구현 예정.
    - dry_run: 선별 건수만 리포트(API 호출·DB 쓰기 없음).
    - session 주입 시 commit은 호출측 제어(loader와 동일 규약).
    """
    if not summary_enabled():
        return SummarizeReport(skipped=True, dry_run=dry_run)

    model_id = settings.SUMMARY_MODEL
    own = session is None
    db = session or SessionLocal()
    try:
        total = _stale_query(db).count()
        report = SummarizeReport(total_stale=total, dry_run=dry_run, model=model_id)
        if dry_run or total == 0:
            return report

        cap = limit if limit is not None else (None if batch else SUMMARY_MAX_PER_RUN)
        q = _stale_query(db).order_by(Policy.first_seen_at.desc(), Policy.plcy_no.desc())
        targets = (q.limit(cap) if cap else q).all()
        report.remaining = total - len(targets)

        if batch:
            if _provider(model_id) != "anthropic":
                raise IngestSummaryError(
                    "--batch는 Anthropic(claude-*) 모델 전용입니다. gemini-* 모델은 "
                    "동기 모드로 실행하세요 (예: --limit 3000 — 저가 모델이라 전량도 비용 미미)."
                )
            raise IngestSummaryError("배치 모드는 아직 미구현 — 동기 모드(--batch 없이)를 사용하세요.")
        _summarize_sync(db, targets, model_id, report, own)
        return report
    except Exception:
        if own:
            db.rollback()
        raise
    finally:
        if own:
            db.close()
