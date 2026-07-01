"""수집 파이프라인 예외 계층.

각 예외는 메시지 외에 상황별 구조화 필드를 옵션(keyword)으로 싣는다(없으면 None).
필드는 상위 핸들러가 프로그램적으로 분기·로깅할 때 쓴다(예: status_code로 재시도 판단).
필드는 전부 선택적이라 `raise IngestFetchError("메시지")`처럼 기존 방식도 그대로 동작한다.
"""


class IngestError(Exception):
    """수집 파이프라인 공통 예외."""


class IngestConfigError(IngestError):
    """인증키 등 사전조건 위반 — 네트워크 호출 전 즉시 실패."""

    def __init__(self, message, *, field=None):
        super().__init__(message)
        self.field = field           # 문제된 설정 키 (예: "YOUTH_API_KEY")


class IngestFetchError(IngestError):
    """네트워크/HTTP/응답 스키마 실패 — 재시도 소진 또는 회복 불가."""

    def __init__(self, message, *, status_code=None, url=None, attempt=None):
        super().__init__(message)
        self.status_code = status_code   # HTTP 상태코드(있으면) — 재시도 정책 분기용
        self.url = url                   # 호출 URL
        self.attempt = attempt           # 최종 실패 시 시도 횟수
