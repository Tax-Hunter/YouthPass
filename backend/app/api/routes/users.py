from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.db.models.user import User
from app.schemas.user import ProfileUpdateRequest, SurveyRequest, UserResponse

router = APIRouter()


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.patch("/me", response_model=UserResponse)
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


@router.post("/me/survey", response_model=UserResponse)
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
