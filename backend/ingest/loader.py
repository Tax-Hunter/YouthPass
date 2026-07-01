"""
loader.py — 검증 통과 레코드를 운영 DB에 멱등 적재 (유일한 DB write 모듈).

- policy UPSERT ON CONFLICT(plcy_no): 본문 전컬럼 + is_active=TRUE,
  content_hash 변경 시에만 updated_at 갱신, first_seen_at/created_at 보존
- policy_stats UPSERT: inq_cnt / last_seen_at / synced_at (= run_ts)
- 소프트 만료: 이번 미수신(policy_stats.synced_at < run_ts) 활성 정책 → is_active=FALSE
  (부분수집 시 allow_expire=False로 스킵 — 대량 오만료 방지)
- 신규/변경/무변경/만료/부활 집계(LoadReport)
- dry_run=True면 트랜잭션 ROLLBACK(쓰기 없음, 리포트만)

run_ts는 collect가 1회 생성한 값을 재사용(각 SQL이 now()를 따로 부르지 않음 → 자기만료 경계버그 방지).
"""
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import List, Optional

from sqlalchemy import case, text
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.db.models import Policy, PolicyStats
from app.db.session import SessionLocal
from ingest.config import LOAD_BATCH_SIZE, SOFT_EXPIRE_MAX_RATE
from ingest.hashing import HASH_FIELDS, content_hash

# UPSERT DO UPDATE에서 제외(보존)할 컬럼 — PK·최초시각
_PRESERVE = {"plcy_no", "first_seen_at", "created_at", "updated_at"}


@dataclass
class LoadReport:
    run_ts: datetime
    total: int
    new: List[str] = field(default_factory=list)
    changed: List[str] = field(default_factory=list)
    unchanged: int = 0
    revived: List[str] = field(default_factory=list)
    expired: List[str] = field(default_factory=list)
    dry_run: bool = False
    expire_skipped: bool = False
    expire_skip_reason: Optional[str] = None

    def summary(self) -> str:
        mode = "DRY-RUN(롤백)" if self.dry_run else "적재"
        if self.expire_skipped:
            exp = f"스킵({self.expire_skip_reason})" if self.expire_skip_reason else "스킵"
        else:
            exp = len(self.expired)
        return (
            f"[{mode}] 대상 {self.total} / 신규 {len(self.new)} / 변경 {len(self.changed)} "
            f"/ 무변경 {self.unchanged} / 부활 {len(self.revived)} / 만료 {exp}"
        )


@dataclass
class RehashReport:
    total: int
    rehashed: int = 0       # 신 규칙으로 content_hash가 바뀐(백필된) 행 수
    unchanged: int = 0      # 이미 신 규칙 해시였던 행
    dry_run: bool = False

    def summary(self) -> str:
        mode = "DRY-RUN(롤백)" if self.dry_run else "백필"
        return f"[REHASH {mode}] 대상 {self.total} / 백필 {self.rehashed} / 무변경 {self.unchanged}"


def _inq_cnt(record: dict) -> int:
    raw = record.get("raw_data")
    if not isinstance(raw, dict):
        return 0
    try:
        return max(0, int(str(raw.get("inqCnt") or "0").strip() or 0))
    except (ValueError, TypeError):
        return 0


def _upsert_policy(db: Session, records: List[dict], hashes: dict, run_ts: datetime) -> None:
    rows = []
    for rec in records:
        row = dict(rec)
        row["content_hash"] = hashes[rec["plcy_no"]]
        row["is_active"] = True
        row["first_seen_at"] = run_ts
        row["created_at"] = run_ts
        row["updated_at"] = run_ts
        rows.append(row)

    for i in range(0, len(rows), LOAD_BATCH_SIZE):
        stmt = insert(Policy).values(rows[i:i + LOAD_BATCH_SIZE])
        set_ = {
            c.name: stmt.excluded[c.name]
            for c in Policy.__table__.columns
            if c.name not in _PRESERVE
        }
        set_["is_active"] = True
        # content_hash 변경 시에만 updated_at 갱신, 아니면 기존 보존
        set_["updated_at"] = case(
            (Policy.content_hash.is_distinct_from(stmt.excluded.content_hash), run_ts),
            else_=Policy.updated_at,
        )
        db.execute(stmt.on_conflict_do_update(index_elements=["plcy_no"], set_=set_))


def _upsert_stats(db: Session, records: List[dict], run_ts: datetime) -> None:
    rows = [
        {"plcy_no": r["plcy_no"], "inq_cnt": _inq_cnt(r), "last_seen_at": run_ts, "synced_at": run_ts}
        for r in records
    ]
    for i in range(0, len(rows), LOAD_BATCH_SIZE):
        stmt = insert(PolicyStats).values(rows[i:i + LOAD_BATCH_SIZE])
        db.execute(stmt.on_conflict_do_update(
            index_elements=["plcy_no"],
            set_={"inq_cnt": stmt.excluded.inq_cnt, "last_seen_at": run_ts, "synced_at": run_ts},
        ))


def load(
    records: List[dict],
    *,
    run_ts: Optional[datetime] = None,
    allow_expire: bool = True,
    dry_run: bool = False,
    session: Optional[Session] = None,
) -> LoadReport:
    """검증 통과 레코드 멱등 적재. session 주입 시 commit/rollback은 호출측이 제어.

    dry_run은 자체 세션(session=None)에서만 지원한다 — 주입 세션은 호출측이 트랜잭션을
    제어하므로 loader가 롤백을 보장할 수 없다(거짓 DRY-RUN 표시 방지).
    """
    if dry_run and session is not None:
        raise ValueError(
            "dry_run은 자체 세션에서만 지원됩니다(session=None). "
            "주입 세션은 트랜잭션을 호출측이 제어하므로 dry_run 롤백을 보장할 수 없습니다."
        )
    run_ts = run_ts or datetime.now(timezone.utc)
    own = session is None
    db = session or SessionLocal()
    # 배치 내 중복 plcy_no 제거(마지막 값 우선) — ON CONFLICT가 동일 행을 2회 갱신하는 CardinalityViolation 방지
    if records:
        _by_no = {}
        for r in records:
            no = r.get("plcy_no")
            if no:
                _by_no[no] = r
        records = list(_by_no.values())
    report = LoadReport(run_ts=run_ts, total=len(records), dry_run=dry_run,
                        expire_skipped=not allow_expire)
    try:
        hashes = {r["plcy_no"]: content_hash(r) for r in records}
        nos = list(hashes.keys())

        # 적재 전 현재 상태 로드 → 신규/변경/무변경/부활 분류
        existing = {}
        for i in range(0, len(nos), 5000):
            for no, h, active in db.query(
                Policy.plcy_no, Policy.content_hash, Policy.is_active
            ).filter(Policy.plcy_no.in_(nos[i:i + 5000])).all():
                existing[no] = (h, active)
        for r in records:
            no = r["plcy_no"]
            if no not in existing:
                report.new.append(no)
            else:
                old_h, old_active = existing[no]
                if hashes[no] != old_h:
                    report.changed.append(no)
                else:
                    report.unchanged += 1
                if not old_active:
                    report.revived.append(no)

        # 멱등 적재: 부모(policy) → 자식(policy_stats) 순서 (FK)
        _upsert_policy(db, records, hashes, run_ts)
        _upsert_stats(db, records, run_ts)

        # 소프트 만료 (이번 미수신 = synced_at < run_ts).
        # 빈입력/부분수집 오만료 방어: 만료율이 상한 초과면 스킵(삭제 아님 — 사람이 검토).
        # count와 update가 동일 WHERE를 공유해 판단·실행이 드리프트하지 않음.
        if allow_expire:
            expire_where = ("is_active = TRUE AND plcy_no IN "
                            "(SELECT plcy_no FROM policy_stats WHERE synced_at < :run_ts)")
            active_total = db.execute(
                text("SELECT count(*) FROM policy WHERE is_active = TRUE")
            ).scalar() or 0
            to_expire = db.execute(
                text(f"SELECT count(*) FROM policy WHERE {expire_where}"), {"run_ts": run_ts}
            ).scalar() or 0
            rate = (to_expire / active_total) if active_total else 0.0
            if rate > SOFT_EXPIRE_MAX_RATE:
                report.expire_skipped = True
                report.expire_skip_reason = (
                    f"만료율 {rate:.0%}(>{SOFT_EXPIRE_MAX_RATE:.0%}) — 부분수집/빈입력 의심, 오만료 방지"
                )
            else:
                rows = db.execute(
                    text(f"UPDATE policy SET is_active = FALSE WHERE {expire_where} RETURNING plcy_no"),
                    {"run_ts": run_ts},
                ).fetchall()
                report.expired = [r[0] for r in rows]

        if own:
            db.rollback() if dry_run else db.commit()
        return report
    except Exception:
        if own:
            db.rollback()
        raise
    finally:
        if own:
            db.close()


def rehash_backfill(*, dry_run: bool = False, session: Optional[Session] = None) -> RehashReport:
    """기존 DB 행의 content_hash만 현 직렬화 규칙으로 재계산·갱신(일회성 백필).

    updated_at·first_seen_at·created_at·is_active 불변, 소프트만료 미수행.
    신 직렬화 규칙 첫 적용 시 load()가 기존 행을 대량 changed로 잡는 churn을 사전 제거한다.
    dry_run은 자체 세션 전용(주입 세션은 호출측이 트랜잭션 제어 → 롤백 보장 불가).
    """
    if dry_run and session is not None:
        raise ValueError(
            "dry_run은 자체 세션에서만 지원됩니다(session=None). "
            "주입 세션은 트랜잭션을 호출측이 제어하므로 dry_run 롤백을 보장할 수 없습니다."
        )
    own = session is None
    db = session or SessionLocal()
    try:
        # 필요 컬럼만(content_hash + 본문 HASH_FIELDS) 조회 — raw_data 미로드, ORM identity-map 미오염
        rows = db.query(Policy.content_hash, *[getattr(Policy, f) for f in HASH_FIELDS]).all()
        report = RehashReport(total=len(rows), dry_run=dry_run)
        updates = []
        for row in rows:
            stored, record = row[0], dict(zip(HASH_FIELDS, row[1:]))
            new_hash = content_hash(record)
            if new_hash != stored:
                updates.append({"no": record["plcy_no"], "h": new_hash})
            else:
                report.unchanged += 1
        report.rehashed = len(updates)

        # content_hash 컬럼만 갱신 — 다른 컬럼·시각(updated_at 등) 일절 불변.
        # 배치당 1왕복(UPDATE FROM VALUES) — 행별 executemany의 원격 N왕복 회피.
        for i in range(0, len(updates), LOAD_BATCH_SIZE):
            chunk = updates[i:i + LOAD_BATCH_SIZE]
            values = ", ".join(f"(:no{j}, :h{j})" for j in range(len(chunk)))
            params = {}
            for j, u in enumerate(chunk):
                params[f"no{j}"], params[f"h{j}"] = u["no"], u["h"]
            db.execute(text(
                f"UPDATE policy SET content_hash = v.h "
                f"FROM (VALUES {values}) AS v(no, h) WHERE policy.plcy_no = v.no"
            ), params)

        if own:
            db.rollback() if dry_run else db.commit()
        return report
    except Exception:
        if own:
            db.rollback()
        raise
    finally:
        if own:
            db.close()
