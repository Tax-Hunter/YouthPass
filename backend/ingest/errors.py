"""수집 파이프라인 예외 계층."""


class IngestError(Exception):
    """수집 파이프라인 공통 예외."""


class IngestConfigError(IngestError):
    """인증키 등 사전조건 위반 — 네트워크 호출 전 즉시 실패."""


class IngestFetchError(IngestError):
    """네트워크/HTTP/응답 스키마 실패 — 재시도 소진 또는 회복 불가."""
