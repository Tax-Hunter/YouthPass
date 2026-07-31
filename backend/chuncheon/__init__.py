"""
chuncheon — 대회 전용(춘천 청년정책) 격리 패키지.

⚠ 순수 대회/데모용. dev까지만 올라가고 release(운영)에는 가지 않는다.
   - 기존 app/·ingest/ 코드를 일절 변경하지 않는다.
   - 테이블(chuncheon_policy)은 alembic이 아니라 bootstrap.py 독립 스크립트로 생성/삭제한다
     (alembic 체인 미접촉 → policy_summary 등 기존 스키마와 무관, teardown은 DROP 한 줄).
   - 수집 파이프라인(ingest.run/loader/cron)에 연결하지 않는다 — 1회성 스냅샷 적재.
   - 조회는 app과 분리된 별도 FastAPI 앱(chuncheon.api)으로 서빙, 별도 프로세스로 실행.
"""

TABLE_NAME = "chuncheon_policy"
