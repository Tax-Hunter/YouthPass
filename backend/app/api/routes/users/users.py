from fastapi import APIRouter, Depends, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.storage import ALLOWED_EXTENSIONS, MAX_FILE_SIZE_BYTES, upload_profile_image
from app.db.session import get_db
from app.db.models.user import User
from app.schemas.user import ProfileUpdateRequest, SurveyRequest, UserResponse

router = APIRouter()


@router.get("/get/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.put("/put/me", response_model=UserResponse)
def update_me(
    body: ProfileUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(current_user, field, value)
    db.commit()
    db.refresh(current_user)
    return current_user


@router.post("/post/profile-image")
async def upload_profile_image_endpoint(
    file: UploadFile,
    current_user: User = Depends(get_current_user),
):
    ext = file.filename.rsplit(".", 1)[-1].lower() if file.filename and "." in file.filename else ""
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="jpg, png, webp 형식의 이미지만 업로드할 수 있습니다.",
        )

    content = await file.read()
    if len(content) > MAX_FILE_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="이미지 용량은 5MB를 초과할 수 없습니다.",
        )

    url = upload_profile_image(
        user_id=str(current_user.id),
        filename=file.filename,
        content=content,
        content_type=file.content_type or "application/octet-stream",
    )
    return {"profile_image": url}


@router.post("/post/survey", response_model=UserResponse)
def submit_survey(
    body: SurveyRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.survey_completed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="이미 설문을 완료한 회원입니다.",
        )
    if not body.terms_agreed:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="서비스 이용약관에 동의해야 합니다.",
        )

    for field, value in body.model_dump().items():
        setattr(current_user, field, value)
    current_user.survey_completed = True

    db.commit()
    db.refresh(current_user)
    return current_user
