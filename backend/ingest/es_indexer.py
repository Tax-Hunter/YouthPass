"""
es_indexer.py — DB(적재 완료 후 상태)의 정책 전량을 ES에 재색인 (alias 원자 스왑).

전략 (workflow/18_feat/phase1_ES도입계획.md 결정 4):
  새 물리 인덱스 생성({alias}-{yyyyMMddHHmmss}-{hex6}) → bulk 색인 → alias 원자 교체
  → 구/고아 인덱스 정리. 증분 없이 전량 재색인 — inq_cnt가 content_hash 밖이라 증분은
  조회수 변경을 놓치고, ~2,600건은 bulk 수 초면 끝나 전량이 더 단순·안전하다.

불변식:
  · 색인 소스는 반드시 DB(post-load) — fetch 배치 기준이면 만료 스킵 경로에서 활성 정책 유실
  · 활성·비활성 전 행을 색인(DB 미러) — is_active 필터는 검색 쿼리 책임
  · ELASTICSEARCH_URL 미설정이면 fetch 없이 즉시 skipped 리포트 반환(예외 아님)
  · dry_run은 ES에 일절 접속하지 않고 DB 읽기·문서 변환·건수 리포트만 수행
  · 실패 시 삭제는 "이번에 만들었고(created) 아직 스왑 전(swapped 전)"인 인덱스만 —
    create 실패(이름 충돌)면 남의 인덱스라 삭제 금지, 스왑 후면 new_index가 라이브라 삭제 금지.
    alias는 항상 유효한 인덱스를 가리키므로 검색은 stale일지언정 끊기지 않는다(fail-soft)
  · 정리(삭제)는 이 모듈의 이름 형태({alias}-\\d{14}-[0-9a-f]{6})와 일치하는 인덱스만 대상
"""
import re
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import List, Optional, Tuple

from elasticsearch import ApiError, NotFoundError, TransportError, helpers
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.es import get_es
from app.core.es_schema import MAPPINGS, index_body
from app.db.models import Policy, PolicyStats
from app.db.session import SessionLocal
from ingest.config import ES_INDEX_TIMEOUT_SEC, LOAD_BATCH_SIZE
from ingest.errors import IngestEsIndexError

# ES 문서 = Policy 컬럼 + PolicyStats.inq_cnt. 매핑(es_schema.MAPPINGS, dynamic: strict)이
# 단일 진실 원천 — 여기서 유도하므로 두 목록이 어긋날 수 없다. 매핑에 Policy 컬럼이 아닌
# 필드를 추가하면 _fetch_docs의 getattr(Policy, ...)가 AttributeError로 즉시 드러난다.
_POLICY_FIELDS = [f for f in MAPPINGS["properties"] if f != "inq_cnt"]


@dataclass
class EsIndexReport:
    alias: str = ""
    index_name: str = ""
    total: int = 0            # DB에서 읽은 행 수(활성+비활성)
    indexed: int = 0          # bulk 성공 문서 수
    deleted_indices: int = 0  # 스왑 후 정리한 구/고아 인덱스 수
    dry_run: bool = False
    skipped: bool = False
    skip_reason: str = ""

    def summary(self) -> str:
        if self.skipped:
            return f"[ES 색인] 스킵 — {self.skip_reason}"
        if self.dry_run:
            return f"[ES 색인 DRY-RUN] 대상 {self.total}건 문서 변환 검증 완료 (ES 미접속)"
        return (
            f"[ES 색인] {self.indexed}/{self.total}건 → {self.index_name} "
            f"(alias '{self.alias}' 스왑, 구 인덱스 {self.deleted_indices}개 정리)"
        )


def _to_doc(row: Tuple) -> dict:
    doc = dict(zip(_POLICY_FIELDS, row[:-1]))
    # None 보존(0으로 강등 금지) — ES 매핑 integer는 null 허용, missing:_last 정렬이
    # PG의 NULLS LAST와 정확히 일치해야 popular 정렬 순서가 ES↔PG 동일해진다.
    doc["inq_cnt"] = row[-1]
    for f in ("apply_end_date", "first_seen_at"):
        if doc[f] is not None:
            doc[f] = doc[f].isoformat()
    return doc


def _fetch_docs(db: Session) -> List[dict]:
    # 필요 컬럼만 조회(raw_data 미로드) + inq_cnt outer join — rehash_backfill과 동일 접근
    rows = (
        db.query(*[getattr(Policy, f) for f in _POLICY_FIELDS], PolicyStats.inq_cnt)
        .outerjoin(PolicyStats, PolicyStats.plcy_no == Policy.plcy_no)
        .all()
    )
    return [_to_doc(r) for r in rows]


def es_reindex(*, dry_run: bool = False, session: Optional[Session] = None) -> EsIndexReport:
    """DB 전량을 새 인덱스에 색인하고 alias를 원자 교체한다.

    ES 미설정이면 skipped 리포트를 반환한다(호출측이 수동 실행이면 설정 오류로 승격 — run.py 참조).
    ES 관련 실패(클라이언트 생성 포함)는 IngestEsIndexError로 래핑한다
    (적재 자체는 이미 성공했으므로 fail-soft 처리용).
    """
    report = EsIndexReport(alias=settings.ES_INDEX_ALIAS, dry_run=dry_run)

    # ES 확인을 DB 조회보다 먼저 — 미설정(로컬 기본) load가 전체 테이블 조회를 낭비하지 않게.
    # dry_run은 문서 변환 검증이 목적이므로 ES 없이도 아래 fetch를 수행한다.
    es = None
    if not dry_run:
        try:
            es = get_es()
        except Exception as e:  # 잘못된 URL 형식 등 — 커밋 이후 경로라 반드시 래핑
            raise IngestEsIndexError(f"ES 클라이언트 생성 실패: {e}") from e
        if es is None:
            report.skipped = True
            report.skip_reason = "ELASTICSEARCH_URL 미설정 (검색은 PostgreSQL 경로)"
            return report
        # 검색용 짧은 타임아웃(ES_TIMEOUT_S)은 bulk에 부족 — 색인 작업만 별도 타임아웃
        es = es.options(request_timeout=ES_INDEX_TIMEOUT_SEC)

    own = session is None
    db = session or SessionLocal()
    try:
        docs = _fetch_docs(db)
    finally:
        if own:
            db.close()
    report.total = len(docs)
    if dry_run:
        return report

    body = index_body()
    # 초 단위 타임스탬프 + 난수 suffix — 동시/연속 실행 간 이름 충돌 원천 차단
    new_index = (
        f"{report.alias}-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}"
        f"-{uuid.uuid4().hex[:6]}"
    )
    report.index_name = new_index

    created = swapped = False
    try:
        es.indices.create(index=new_index, settings=body["settings"], mappings=body["mappings"])
        created = True
        success, _ = helpers.bulk(
            es,
            ({"_index": new_index, "_id": d["plcy_no"], "_source": d} for d in docs),
            chunk_size=LOAD_BATCH_SIZE,
        )
        report.indexed = success
        es.indices.refresh(index=new_index)

        # alias 원자 스왑: 기존 보유 인덱스 remove + 새 인덱스 add를 한 요청으로
        try:
            olds = list(es.indices.get_alias(name=report.alias))
        except NotFoundError:
            olds = []
        actions = [{"remove": {"index": o, "alias": report.alias}} for o in olds]
        actions.append({"add": {"index": new_index, "alias": report.alias}})
        es.indices.update_aliases(actions=actions)
        swapped = True
    except (ApiError, TransportError, helpers.BulkIndexError) as e:
        # 이번에 만들었고 아직 라이브가 아닐 때만 삭제 — 삭제 실패 잔여물은 아래 정리가 회수.
        # create 자체가 실패(이름 충돌 등)면 해당 인덱스는 남의 것이므로 건드리지 않는다.
        if created and not swapped:
            try:
                es.indices.delete(index=new_index, ignore_unavailable=True)
            except (ApiError, TransportError):
                pass
        raise IngestEsIndexError(
            f"ES 색인 실패({type(e).__name__}): {e} [index={new_index}]", index_name=new_index
        ) from e

    # 스왑 성공 이후의 구/고아 인덱스 정리 — best-effort. 여기서 실패해도 색인은 성공 상태이며
    # 잔여물은 다음 성공 색인이 회수한다. new_index(라이브)는 절대 삭제하지 않고,
    # 이 모듈의 이름 형태와 정확히 일치하는 인덱스만 지운다(형제 인덱스 패밀리·수동 백업 보호).
    own_shape = re.compile(re.escape(report.alias) + r"-\d{14}-[0-9a-f]{6}")
    try:
        for idx in es.indices.get(index=f"{report.alias}-*", expand_wildcards="open"):
            if idx != new_index and own_shape.fullmatch(idx):
                es.indices.delete(index=idx, ignore_unavailable=True)
                report.deleted_indices += 1
    except (ApiError, TransportError):
        pass
    return report
