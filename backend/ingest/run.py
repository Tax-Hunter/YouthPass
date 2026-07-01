"""
run.py — 수집 파이프라인 CLI 오케스트레이터 (유일한 실행 엔트리포인트).

모드(권한 경사 — 아래로 갈수록 위험):
  collect   수집 → JSON 저장        (DB 미접속)
  verify    수집 → 정제 → 검증 리포트 (DB 미접속, 적재 안 함)
  dryrun    수집 → 정제 → 검증 → 적재 시뮬(ROLLBACK)
  load      수집 → 정제 → 검증 → 실적재(COMMIT)
  rehash    기존 DB content_hash 백필 (첫 load 전 1회, --dry-run 지원)

dryrun/load가 강제하는 불변식(사람이 깨뜨릴 수 없게):
  · run_validation → assert_loadable  (FAIL 0일 때만 적재)
  · allow_expire = not meta.is_partial (부분수집이면 만료 스킵 → 대량 오만료 차단)
  · run_ts = meta.fetched_at           (단일 출처 전파 → 자기만료 경계버그 방지)
  · dryrun/load는 own-session(session=None) → dry_run 롤백 보장

종료코드: 0 성공 / 2 검증FAIL / 3 수집실패 / 4 설정오류 / 5 만료스킵(주의) / 1 기타

사용: backend/ 에서  python -m ingest.run <mode> [옵션]
예:   python -m ingest.run verify --limit 300
      python -m ingest.run rehash --dry-run
      python -m ingest.run dryrun
      python -m ingest.run load
"""
import argparse
import json
import sys
from dataclasses import asdict

from ingest import (
    IngestConfigError,
    IngestFetchError,
    IngestLockError,
    IngestValidationError,
    advisory_lock,
    assert_loadable,
    fetch_all_policies,
    load,
    rehash_backfill,
    run_validation,
    transform_batch,
)
from ingest.config import MAX_PAGES, PAGE_SIZE

EXIT_OK = 0
EXIT_ERROR = 1
EXIT_VALIDATION = 2
EXIT_FETCH = 3
EXIT_CONFIG = 4
EXIT_EXPIRE_SKIPPED = 5
EXIT_LOCKED = 6


def _meta_dict(meta) -> dict:
    d = asdict(meta)
    d["fetched_at"] = meta.fetched_at.isoformat()
    return d


def _fetch(args):
    items, meta = fetch_all_policies(
        limit=args.limit, page_size=args.page_size, max_pages=args.max_pages
    )
    print(
        f"① 수집: {meta.fetched_count}건 / totCount {meta.tot_count} / "
        f"페이지 {meta.pages_fetched} / 중복 {meta.duplicates} / is_partial={meta.is_partial}"
    )
    return items, meta


def _transform_and_validate(items, meta):
    records = transform_batch(items)
    print(f"② 정제: {len(records)}건 (스킵 {len(items) - len(records)})")
    report = run_validation(records, meta)
    print(f"④ {report.summary()}")
    for issue in report.issues:
        ex = f" 예시 {issue.examples}" if issue.examples else ""
        print(f"   [{issue.level}] {issue.check}: {issue.detail}{ex}")
    return records, report


def cmd_collect(args) -> int:
    items, meta = _fetch(args)
    if args.output:
        with open(args.output, "w", encoding="utf-8") as f:
            json.dump({"meta": _meta_dict(meta), "items": items}, f, ensure_ascii=False)
        print(f"저장: {args.output}")
    return EXIT_OK


def cmd_verify(args) -> int:
    items, meta = _fetch(args)
    _, report = _transform_and_validate(items, meta)
    return EXIT_OK if report.can_load else EXIT_VALIDATION


def _run_load(args, *, dry_run: bool) -> int:
    # 수집 전에 락 획득 → 동시 실행은 fetch 낭비 없이 즉시 IngestLockError로 빠진다.
    with advisory_lock():
        items, meta = _fetch(args)
        records, report = _transform_and_validate(items, meta)
        assert_loadable(report)  # FAIL이면 IngestValidationError → main에서 EXIT_VALIDATION
        if meta.is_partial:
            print("⚠ 부분수집(is_partial) — 만료 단계 스킵하고 부분 적재합니다.", file=sys.stderr)
        result = load(
            records,
            run_ts=meta.fetched_at,
            allow_expire=not meta.is_partial,
            dry_run=dry_run,
        )
    print(f"⑤ {result.summary()}")
    # 만료율 캡 트립(reason 존재) = 부분수집/빈입력 의심 이상신호 → 운영자 분기용 종료코드
    if result.expire_skip_reason:
        print(f"⚠ 만료 스킵(이상): {result.expire_skip_reason}", file=sys.stderr)
        return EXIT_EXPIRE_SKIPPED
    return EXIT_OK


def cmd_dryrun(args) -> int:
    return _run_load(args, dry_run=True)


def cmd_load(args) -> int:
    return _run_load(args, dry_run=False)


def cmd_rehash(args) -> int:
    with advisory_lock():
        report = rehash_backfill(dry_run=args.dry_run)
    print(report.summary())
    return EXIT_OK


def _add_fetch_args(p):
    p.add_argument("--limit", type=int, default=None, help="수집 건수 제한(부분수집 → 만료 스킵)")
    p.add_argument("--page-size", type=int, default=PAGE_SIZE, help=f"페이지 크기(기본 {PAGE_SIZE})")
    p.add_argument("--max-pages", type=int, default=MAX_PAGES, help=f"최대 페이지(기본 {MAX_PAGES})")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="ingest.run", description="청년정책 수집 파이프라인 CLI"
    )
    sub = parser.add_subparsers(dest="mode", required=True)

    p = sub.add_parser("collect", help="수집→JSON (DB 미접속)")
    _add_fetch_args(p)
    p.add_argument("--output", help="수집 결과 JSON 저장 경로")
    p.set_defaults(func=cmd_collect)

    p = sub.add_parser("verify", help="수집→정제→검증 (적재 안 함)")
    _add_fetch_args(p)
    p.set_defaults(func=cmd_verify)

    p = sub.add_parser("dryrun", help="적재 시뮬(ROLLBACK)")
    _add_fetch_args(p)
    p.set_defaults(func=cmd_dryrun)

    p = sub.add_parser("load", help="실적재(COMMIT)")
    _add_fetch_args(p)
    p.set_defaults(func=cmd_load)

    p = sub.add_parser("rehash", help="기존 DB content_hash 백필(첫 load 전 1회)")
    p.add_argument("--dry-run", action="store_true", help="롤백(미리보기)")
    p.set_defaults(func=cmd_rehash)

    return parser


def main(argv=None) -> int:
    args = build_parser().parse_args(argv)
    try:
        return args.func(args)
    except IngestLockError as e:
        print(f"동시실행 차단: {e}", file=sys.stderr)
        return EXIT_LOCKED
    except IngestValidationError as e:
        print(f"검증 FAIL — 적재 차단: {e}", file=sys.stderr)
        return EXIT_VALIDATION
    except IngestConfigError as e:
        print(f"설정 오류: {e}", file=sys.stderr)
        return EXIT_CONFIG
    except IngestFetchError as e:
        print(f"수집 실패: {e}", file=sys.stderr)
        return EXIT_FETCH


if __name__ == "__main__":
    sys.exit(main())
