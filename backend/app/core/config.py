from pydantic import Field, model_validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    PROJECT_NAME: str = "YouthPass API"
    VERSION: str = "0.1.0"
    API_PREFIX: str = "/api"

    DATABASE_URL: str = Field(..., description="PostgreSQL connection URL")

    SECRET_KEY: str = Field(..., min_length=32, description="JWT signing secret key")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    GOOGLE_CLIENT_ID: str = Field(default="", description="Google OAuth 클라이언트 ID")
    GOOGLE_CLIENT_SECRET: str = Field(default="", description="Google OAuth 클라이언트 시크릿")
    GOOGLE_REDIRECT_URI: str = Field(default="", description="Google Cloud Console에 등록된 콜백 URI")

    # 쉼표 구분 문자열로 받아 allowed_origins_list 프로퍼티에서 리스트로 변환
    ALLOWED_ORIGINS: str = Field(default="http://localhost:3000")
    FRONTEND_URL: str = Field(default="", description="OAuth 콜백 리다이렉트 대상 프론트엔드 URL")

    @property
    def allowed_origins_list(self) -> list[str]:
        return [o.strip() for o in self.ALLOWED_ORIGINS.split(",") if o.strip()]

    @model_validator(mode="after")
    def set_frontend_url_default(self) -> "Settings":
        if not self.FRONTEND_URL:
            origins = self.allowed_origins_list
            if origins:
                self.FRONTEND_URL = origins[0]
        return self

    # 빈값이면 Redis 기능(정책 응답 캐시 등) 전체가 조용히 비활성 — 로컬/미구성 환경 기본
    REDIS_URL: str = Field(default="", description="Redis 연결 URL (Railway Redis의 REDIS_URL)")

    # 빈값이면 ES 검색 기능 전체가 조용히 비활성(모든 검색이 PostgreSQL 경로) — 로컬/미구성 환경 기본
    ELASTICSEARCH_URL: str = Field(default="", description="Elasticsearch 연결 URL (basic auth 포함 가능)")
    ES_INDEX_ALIAS: str = Field(default="youthpass-policy", description="정책 검색 인덱스 alias (검색·색인 모두 alias 경유)")
    ES_TIMEOUT_S: float = Field(default=2.0, description="ES 요청 타임아웃(초) — 초과 시 PostgreSQL 폴백")

    R2_ACCOUNT_ID: str = Field(default="", description="Cloudflare R2 계정 ID")
    R2_ACCESS_KEY_ID: str = Field(default="", description="R2 API 액세스 키")
    R2_SECRET_ACCESS_KEY: str = Field(default="", description="R2 API 시크릿 키")
    R2_BUCKET_NAME: str = Field(default="", description="R2 버킷 이름")
    R2_PUBLIC_BASE_URL: str = Field(default="", description="R2 버킷에 연결된 퍼블릭 도메인 (업로드 결과 URL 조합에 사용)")

    YOUTH_API_KEY: str = ""
    # 온통청년 getPlcy 현행 엔드포인트 (수집 파이프라인 client가 사용). 구 opi/empInt.do에서 교정.
    YOUTH_API_BASE_URL: str = "https://www.youthcenter.go.kr/go/ythip/getPlcy"
    # 신청 URL이 없을 때 폴백할 온통청년 정책 상세 페이지 베이스
    YTH_DETAIL_URL_BASE: str = "https://www.youthcenter.go.kr/youthPolicy/ythPlcyTotalSearch/ythPlcyDetail"

    model_config = {"env_file": ".env", "case_sensitive": True}


settings = Settings()
