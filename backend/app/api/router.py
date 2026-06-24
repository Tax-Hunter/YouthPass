from fastapi import APIRouter

from app.api.routes import health
from app.api.policy.router import router as policy_router

api_router = APIRouter()

api_router.include_router(health.router, tags=["health"])
api_router.include_router(policy_router)
