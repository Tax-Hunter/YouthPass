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

    YOUTH_API_KEY: str = ""
    YOUTH_API_BASE_URL: str = "https://www.youthcenter.go.kr/opi/empInt.do"

    model_config = {"env_file": ".env", "case_sensitive": True}


settings = Settings()
