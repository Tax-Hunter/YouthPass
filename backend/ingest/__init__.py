"""
ingest — 청년정책 수집 ETL 파이프라인.

단방향 5단계: ① 수집(client) → ② 정제(transform) → ③ 변경감지(hashing)
→ ④ 검증(validate) → ⑤ 적재(loader). 의존은 ingest → (db, core) 단방향.

소비자(run.py·테스트·스크립트)는 내부 모듈 경로 대신 `from ingest import ...`로
아래 __all__ 공개 API만 사용한다. 운영 상수는 ingest.config, 어휘는 ingest.vocab 참조.
"""
from ingest.client import FetchMeta, fetch_all_policies
from ingest.errors import IngestConfigError, IngestError, IngestFetchError
from ingest.hashing import classify_change, content_hash
from ingest.loader import LoadReport, RehashReport, load, rehash_backfill
from ingest.lock import IngestLockError, advisory_lock
from ingest.transform import transform_batch, transform_item
from ingest.validate import (
    IngestValidationError,
    ValidationReport,
    assert_loadable,
    run_validation,
)

__all__ = [
    # ① 수집
    "fetch_all_policies", "FetchMeta",
    # ② 정제
    "transform_batch", "transform_item",
    # ③ 변경감지
    "content_hash", "classify_change",
    # ④ 검증
    "run_validation", "assert_loadable", "ValidationReport",
    # ⑤ 적재
    "load", "LoadReport",
    # 백필(첫 실적재 전 content_hash 재계산)
    "rehash_backfill", "RehashReport",
    # 동시실행 방지
    "advisory_lock", "IngestLockError",
    # 예외 계층
    "IngestError", "IngestConfigError", "IngestFetchError", "IngestValidationError",
]
