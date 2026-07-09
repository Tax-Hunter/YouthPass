import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

from jose import JWTError, jwt

from app.core.config import settings


def create_access_token(user_id: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {"sub": user_id, "exp": expire, "type": "access"}
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_access_token(token: str) -> str:
    """Access Token을 디코딩하여 user_id(sub)를 반환한다. 유효하지 않으면 JWTError 발생."""
    payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    if payload.get("type") != "access":
        raise JWTError("Invalid token type")
    user_id: Optional[str] = payload.get("sub")
    if user_id is None:
        raise JWTError("Missing subject")
    return user_id


def generate_refresh_token() -> str:
    """무작위 Refresh Token 원문을 생성한다."""
    return secrets.token_urlsafe(64)


def hash_token(token: str) -> str:
    """토큰 원문을 SHA-256으로 해싱하여 반환한다."""
    return hashlib.sha256(token.encode()).hexdigest()
