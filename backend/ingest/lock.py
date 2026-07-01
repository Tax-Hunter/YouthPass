"""
lock.py — PostgreSQL advisory lock으로 적재 동시실행 방지.

두 배치가 동시에 적재/만료하면 UPSERT 경합·중복 만료·행락 데드락이 생길 수 있다.
run.py의 load/dryrun/rehash 모드를 advisory_lock으로 감싸 단일 실행을 보장한다.

세션 레벨 비차단 락(pg_try_advisory_lock): 이미 점유 중이면 대기하지 않고 즉시 IngestLockError.
→ cron이 겹쳐 떠도 두 번째는 빠르게 실패(EXIT_LOCKED)하고 빠진다(작업 중복·정체 없음).
"""
from contextlib import contextmanager
from typing import Iterator, Optional

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.db.session import SessionLocal
from ingest.config import LOAD_LOCK_KEY
from ingest.errors import IngestError


class IngestLockError(IngestError):
    """다른 적재 실행이 advisory lock을 점유 중 — 동시실행 차단."""

    def __init__(self, message, *, key=None):
        super().__init__(message)
        self.key = key               # 점유 중인 advisory lock 키


@contextmanager
def advisory_lock(key: int = LOAD_LOCK_KEY, *, session: Optional[Session] = None) -> Iterator[None]:
    """비차단 advisory lock. 획득 실패 시 IngestLockError, 종료 시 해제.

    락 전용 세션을 따로 잡아(적재 세션과 독립) 락 보유 동안 다른 세션의 적재가 진행된다.
    락 세션은 SELECT(데이터 무변경)만 수행 → 적재 트랜잭션을 막지 않는다.
    프로세스가 비정상 종료해도 연결이 끊기면 세션 레벨 락은 자동 해제된다.
    """
    own = session is None
    db = session or SessionLocal()
    got = bool(db.execute(text("SELECT pg_try_advisory_lock(:k)"), {"k": key}).scalar())
    if not got:
        if own:
            db.close()
        raise IngestLockError(f"이미 실행 중인 적재가 lock을 점유 중 — 동시실행 차단(key={key})", key=key)
    try:
        yield
    finally:
        try:
            db.execute(text("SELECT pg_advisory_unlock(:k)"), {"k": key})
        finally:
            if own:
                db.close()
