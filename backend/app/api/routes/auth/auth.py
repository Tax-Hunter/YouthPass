import base64
import json
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

import httpx
from fastapi import APIRouter, Cookie, Depends, HTTPException, Response, status
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.config import settings
from app.core.oauth import GOOGLE_TOKEN_URL, GOOGLE_USERINFO_URL, get_google_auth_url
from app.core.security import create_access_token, generate_refresh_token, hash_token
from app.db.session import get_db
from app.db.models.refresh_token import RefreshToken
from app.db.models.user import User
from app.schemas.auth import AccessTokenResponse

router = APIRouter()

REFRESH_TOKEN_COOKIE = "refresh_token"
REFRESH_TOKEN_COOKIE_PATH = f"{settings.API_PREFIX}/auth"


def _set_refresh_token_cookie(response: Response, raw_refresh_token: str) -> None:
    # 브라우저는 Next.js rewrites 프록시를 통해 항상 프론트엔드와 동일 origin으로만 통신하므로
    # (frontend/next.config.ts 참고) refresh_token 쿠키는 first-party로 전달됨 — SameSite=Lax로 충분.
    response.set_cookie(
        key=REFRESH_TOKEN_COOKIE,
        value=raw_refresh_token,
        httponly=True,
        secure=settings.ENV != "dev",
        samesite="lax",
        path=REFRESH_TOKEN_COOKIE_PATH,
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,
    )


@router.get("/get/google-login")
def google_login(redirect_origin: str = ""):
    allowed = settings.allowed_origins_list
    origin = redirect_origin if redirect_origin in allowed else settings.FRONTEND_URL
    nonce = secrets.token_urlsafe(16)
    state = base64.urlsafe_b64encode(
        json.dumps({"nonce": nonce, "origin": origin}).encode()
    ).decode().rstrip("=")
    return RedirectResponse(url=get_google_auth_url(state))


@router.get("/get/google-callback")
def google_callback(code: str, state: str = "", db: Session = Depends(get_db)):
    # state에서 origin 추출 후 허용 목록 검증
    try:
        padding = 4 - len(state) % 4
        payload = json.loads(base64.urlsafe_b64decode(state + "=" * (padding % 4)).decode())
        origin = payload.get("origin", "")
    except Exception:
        origin = ""
    allowed = settings.allowed_origins_list
    frontend_url = origin if origin in allowed else settings.FRONTEND_URL

    # 1. code → Google access token 교환
    token_res = httpx.post(
        GOOGLE_TOKEN_URL,
        data={
            "code": code,
            "client_id": settings.GOOGLE_CLIENT_ID,
            "client_secret": settings.GOOGLE_CLIENT_SECRET,
            "redirect_uri": settings.GOOGLE_REDIRECT_URI,
            "grant_type": "authorization_code",
        },
    )
    if token_res.status_code != 200:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Google 토큰 교환 실패")

    google_access_token = token_res.json().get("access_token")

    # 2. Google 사용자 정보 조회
    userinfo_res = httpx.get(
        GOOGLE_USERINFO_URL,
        headers={"Authorization": f"Bearer {google_access_token}"},
    )
    if userinfo_res.status_code != 200:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Google 사용자 정보 조회 실패")

    userinfo = userinfo_res.json()
    google_id: str = userinfo["sub"]
    email: str = userinfo["email"]
    profile_image: Optional[str] = userinfo.get("picture")
    google_name: Optional[str] = userinfo.get("name")
    nickname: Optional[str] = google_name[:10] if google_name else None

    # 3. 신규/기존 회원 분기
    user = db.query(User).filter(User.google_id == google_id).first()
    is_new_user = user is None

    if is_new_user:
        user = User(google_id=google_id, email=email, nickname=nickname, profile_image=profile_image)
        db.add(user)
        db.commit()
        db.refresh(user)
    elif user.nickname is None and nickname:
        user.nickname = nickname
        db.commit()

    # 4. JWT 발급 및 Refresh Token DB 저장
    access_token = create_access_token(str(user.id))
    raw_refresh_token = generate_refresh_token()
    expires_at = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)

    db.add(RefreshToken(
        user_id=user.id,
        token_hash=hash_token(raw_refresh_token),
        expires_at=expires_at,
    ))
    db.commit()

    # 5. 프론트엔드로 리다이렉트 (access_token만 쿼리로 전달, refresh_token은 HttpOnly 쿠키로 발급)
    redirect_url = (
        f"{frontend_url}/auth/callback"
        f"?access_token={access_token}"
        f"&is_new_user={str(is_new_user).lower()}"
    )
    response = RedirectResponse(url=redirect_url)
    _set_refresh_token_cookie(response, raw_refresh_token)
    return response


@router.post("/post/refresh", response_model=AccessTokenResponse)
def refresh_access_token(
    response: Response,
    db: Session = Depends(get_db),
    refresh_token: Optional[str] = Cookie(default=None),
):
    if refresh_token is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh Token 쿠키가 없습니다.")

    token_hash = hash_token(refresh_token)
    db_token = db.query(RefreshToken).filter(RefreshToken.token_hash == token_hash).first()

    if db_token is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="유효하지 않은 Refresh Token입니다.")

    if db_token.expires_at.replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
        db.delete(db_token)
        db.commit()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="만료된 Refresh Token입니다.")

    # 토큰 회전: 기존 레코드 폐기 후 신규 발급 (재사용 탐지 대비)
    user_id = db_token.user_id
    db.delete(db_token)

    new_raw_refresh_token = generate_refresh_token()
    expires_at = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    db.add(RefreshToken(
        user_id=user_id,
        token_hash=hash_token(new_raw_refresh_token),
        expires_at=expires_at,
    ))
    db.commit()

    _set_refresh_token_cookie(response, new_raw_refresh_token)
    return AccessTokenResponse(access_token=create_access_token(str(user_id)))


@router.post("/post/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(
    response: Response,
    db: Session = Depends(get_db),
    refresh_token: Optional[str] = Cookie(default=None),
):
    if refresh_token:
        db_token = db.query(RefreshToken).filter(RefreshToken.token_hash == hash_token(refresh_token)).first()
        if db_token:
            db.delete(db_token)
            db.commit()
    response.delete_cookie(key=REFRESH_TOKEN_COOKIE, path=REFRESH_TOKEN_COOKIE_PATH)
