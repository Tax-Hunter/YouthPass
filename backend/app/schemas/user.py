from datetime import datetime
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, Field


class UserResponse(BaseModel):
    id: UUID
    email: str
    nickname: Optional[str] = None
    profile_image: Optional[str] = None
    age: Optional[int] = None
    region_city: Optional[str] = None
    region_district: Optional[str] = None
    employment_status: Optional[str] = None
    interests: Optional[List[str]] = None
    income_level: Optional[str] = None
    household_type: Optional[str] = None
    notification_enabled: bool
    survey_completed: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class SurveyRequest(BaseModel):
    nickname: str = Field(..., min_length=2, max_length=12)
    age: Optional[int] = Field(None, ge=14, le=39)
    region_city: Optional[str] = None
    region_district: Optional[str] = None
    employment_status: Optional[str] = None
    interests: Optional[List[str]] = None
    income_level: Optional[str] = None
    household_type: Optional[str] = None
    notification_enabled: bool = False
    terms_agreed: bool


class ProfileUpdateRequest(BaseModel):
    nickname: Optional[str] = Field(None, min_length=2, max_length=12)
    age: Optional[int] = Field(None, ge=14, le=39)
    region_city: Optional[str] = None
    region_district: Optional[str] = None
    employment_status: Optional[str] = None
    interests: Optional[List[str]] = None
    income_level: Optional[str] = None
    household_type: Optional[str] = None
    notification_enabled: Optional[bool] = None
    profile_image: Optional[str] = None
