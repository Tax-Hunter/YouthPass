from pydantic import Field
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    PROJECT_NAME: str = "YouthPass API"
    VERSION: str = "0.1.0"
    API_PREFIX: str = "/api"

    DATABASE_URL: str = Field(..., description="PostgreSQL connection URL")

    # 기본값 없음 — .env에 반드시 설정해야 함 (없으면 시작 시 오류 발생)
    SECRET_KEY: str = Field(..., min_length=32, description="JWT signing secret key")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

    YOUTH_API_KEY: str = ""
    YOUTH_API_BASE_URL: str = "https://www.youthcenter.go.kr/opi/empInt.do"

    model_config = {"env_file": ".env", "case_sensitive": True}


settings = Settings()
