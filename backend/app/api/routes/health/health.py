from fastapi import APIRouter

router = APIRouter()


@router.get("/health/get/status")
def health_check():
    return {"status": "ok"}
