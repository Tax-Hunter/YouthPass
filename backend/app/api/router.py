from fastapi import APIRouter

from app.api.routes.health.health import router as health_router
from app.api.routes.auth.auth import router as auth_router
from app.api.routes.users.users import router as users_router
from app.api.routes.policy.policy import router as policy_router
from app.api.routes.chuncheon.chuncheon import router as chuncheon_router

api_router = APIRouter()

api_router.include_router(health_router, tags=["health"])
api_router.include_router(auth_router, prefix="/auth", tags=["auth"])
api_router.include_router(users_router, prefix="/users", tags=["users"])
api_router.include_router(policy_router)
api_router.include_router(chuncheon_router)
