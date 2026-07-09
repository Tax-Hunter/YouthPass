import base64
import json
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.config import settings
from app.core.oauth import GOOGLE_TOKEN_URL, GOOGLE_USERINFO_URL, get_google_auth_url
from app.core.security import create_access_token, generate_refresh_token, hash_token
from app.db.session import get_db
from app.db.models.refresh_token import RefreshToken
from app.db.models.user import User
from app.schemas.auth import AccessTokenResponse, RefreshRequest

router = APIRouter()


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

    # 5. 프론트엔드로 리다이렉트 (토큰 + 신규 여부)
    redirect_url = (
        f"{frontend_url}/auth/callback"
        f"?access_token={access_token}"
        f"&refresh_token={raw_refresh_token}"
        f"&is_new_user={str(is_new_user).lower()}"
    )
    return RedirectResponse(url=redirect_url)


@router.post("/post/refresh", response_model=AccessTokenResponse)
def refresh_access_token(body: RefreshRequest, db: Session = Depends(get_db)):
    token_hash = hash_token(body.refresh_token)
    db_token = db.query(RefreshToken).filter(RefreshToken.token_hash == token_hash).first()

    if db_token is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="유효하지 않은 Refresh Token입니다.")

    if db_token.expires_at.replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
        db.delete(db_token)
        db.commit()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="만료된 Refresh Token입니다.")

    return AccessTokenResponse(access_token=create_access_token(str(db_token.user_id)))


@router.post("/post/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(body: RefreshRequest, db: Session = Depends(get_db)):
    db_token = db.query(RefreshToken).filter(RefreshToken.token_hash == hash_token(body.refresh_token)).first()
    if db_token:
        db.delete(db_token)
        db.commit()
