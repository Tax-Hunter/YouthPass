from typing import List

from pydantic import Field, computed_field, field_validator
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

    ALLOWED_ORIGINS: List[str] = Field(default=["http://localhost:3000"])

    @computed_field
    @property
    def FRONTEND_URL(self) -> str:
        return self.ALLOWED_ORIGINS[0]

    YOUTH_API_KEY: str = ""
    YOUTH_API_BASE_URL: str = "https://www.youthcenter.go.kr/opi/empInt.do"

    @field_validator("ALLOWED_ORIGINS", mode="before")
    @classmethod
    def parse_allowed_origins(cls, v: object) -> List[str]:
        if isinstance(v, str):
            return [origin.strip() for origin in v.split(",") if origin.strip()]
        return v

    model_config = {"env_file": ".env", "case_sensitive": True}


settings = Settings()
