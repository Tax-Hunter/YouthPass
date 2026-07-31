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
from app.schemas.auth import AccessTokenResponse, ExchangeRefreshTokenRequest

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


def _rotate_refresh_token(db: Session, db_token: RefreshToken) -> str:
    """기존 Refresh Token 레코드를 폐기하고 새 레코드를 발급해 원문을 반환한다 (재사용 탐지 대비 회전)."""
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
    return new_raw_refresh_token


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

    # 5. 프론트엔드로 리다이렉트.
    # refresh_token 쿠키는 이 302 리다이렉트 응답에서 바로 발급하지 않는다 — iOS Safari의 ITP(Intelligent
    # Tracking Prevention)는 Google→백엔드→프론트로 이어지는 자동 리다이렉트 체인 중간에 설정된 쿠키를
    # 짧은 시간 내 삭제하는 휴리스틱(cross-site bounce tracking 완화)을 갖고 있어, 여기서 쿠키를 심으면
    # iOS Safari에서만 로그인 직후 세션이 삭제되는 문제가 재현된다.
    # 대신 원문 refresh_token을 쿼리로 프론트에 1회 전달하고, 프론트가 자동 리다이렉트가 아닌 페이지
    # 로드 후 별도 fetch(POST /auth/post/exchange)로 쿠키를 발급받도록 한다. 이 원문은 exchange 시점에
    # 즉시 회전(폐기 후 재발급)되므로 URL(브라우저 히스토리·서버 로그 등)에 잠시 노출되더라도 exchange가
    # 끝난 뒤에는 무효한 값이 된다.
    redirect_url = (
        f"{frontend_url}/auth/callback"
        f"?access_token={access_token}"
        f"&refresh_token={raw_refresh_token}"
        f"&is_new_user={str(is_new_user).lower()}"
    )
    return RedirectResponse(url=redirect_url)


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

    user_id = db_token.user_id
    new_raw_refresh_token = _rotate_refresh_token(db, db_token)

    _set_refresh_token_cookie(response, new_raw_refresh_token)
    return AccessTokenResponse(access_token=create_access_token(str(user_id)))


@router.post("/post/exchange", status_code=status.HTTP_204_NO_CONTENT)
def exchange_refresh_token(
    payload: ExchangeRefreshTokenRequest,
    response: Response,
    db: Session = Depends(get_db),
):
    """구글 로그인 콜백이 쿼리로 전달한 원문 refresh_token을 HttpOnly 쿠키로 교환 발급한다.

    google_callback의 302 리다이렉트 응답이 아니라, 프론트가 /auth/callback 페이지 로드 후
    직접 보내는 fetch 요청에서 쿠키를 심기 위한 전용 엔드포인트 — iOS Safari ITP의 리다이렉트
    체인 쿠키 삭제 휴리스틱을 회피하기 위함.
    """
    token_hash = hash_token(payload.refresh_token)
    db_token = db.query(RefreshToken).filter(RefreshToken.token_hash == token_hash).first()

    if db_token is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="유효하지 않은 Refresh Token입니다.")

    if db_token.expires_at.replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
        db.delete(db_token)
        db.commit()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="만료된 Refresh Token입니다.")

    new_raw_refresh_token = _rotate_refresh_token(db, db_token)
    _set_refresh_token_cookie(response, new_raw_refresh_token)


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
