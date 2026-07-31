import logging
from datetime import date
from typing import List, Optional

import httpx
from fastapi import APIRouter, HTTPException, Query

from app.core.config import settings
from app.schemas.policy import (
    Eligibility,
    PolicyCard,
    PolicyDetail,
    PolicyListResponse,
)

router = APIRouter(prefix="/chuncheon", tags=["chuncheon"])

logger = logging.getLogger(__name__)


def _get(path: str, params: Optional[dict] = None) -> dict:
    # 외부 대회용 서비스(별도 배포체) 프록시 호출 — 실패 시 502로 통일해 원인 파악 용이하게 함
    url = f"{settings.CHUNCHEON_API_BASE_URL}{path}"
    try:
        resp = httpx.get(url, params=params, timeout=settings.CHUNCHEON_API_TIMEOUT_S)
    except httpx.HTTPError as e:
        logger.warning("춘천 정책 API 호출 실패: %s %s", url, e)
        raise HTTPException(status_code=502, detail="춘천 정책 데이터를 불러오지 못했습니다") from e
    if resp.status_code == 404:
        raise HTTPException(status_code=404, detail="policy not found")
    if resp.is_error:
        logger.warning("춘천 정책 API 오류 응답: %s %s", url, resp.status_code)
        raise HTTPException(status_code=502, detail="춘천 정책 데이터를 불러오지 못했습니다")
    return resp.json()


def _to_card(item: dict) -> PolicyCard:
    return PolicyCard(
        plcy_no=item["plcy_no"],
        plcy_nm=item["plcy_nm"],
        category=item.get("category"),
        keywords=[],
        region=item.get("region_scope") or "춘천",
        org=item.get("org"),
        summary=item.get("summary"),
        benefit=item.get("benefit"),
        age_label=item["age_label"],
        dday=item["status"],
        days=item.get("days"),
        views=item["views"],
        is_always_open=item["is_always_open"],
        sprt_arvl_seq_yn=None,
        apply_end_date=item.get("apply_end_date"),
        aply_url_addr=item.get("aply_url_addr") or "",
    )


def _to_detail(item: dict) -> PolicyDetail:
    # 춘천 API는 자격요건 세부코드·서류·심사방법 등을 제공하지 않아 해당 필드는 빈 값으로 채운다.
    age_label = item["age_label"]
    region_label = item.get("region_scope") or "춘천"
    eligibility = Eligibility(age=age_label, region=region_label)
    return PolicyDetail(
        plcy_no=item["plcy_no"],
        plcy_nm=item["plcy_nm"],
        category=item.get("category"),
        region=region_label,
        region_sido=["강원"],
        is_nationwide=False,
        keywords=[],
        age_label=age_label,
        is_always_open=item["is_always_open"],
        apply_start_date=item.get("apply_start_date"),
        apply_end_date=item.get("apply_end_date"),
        dday=item["status"],
        days=item.get("days"),
        is_active=True,
        sprvsn_inst_cd_nm=item.get("org"),
        aply_url_addr=item.get("aply_url_addr"),
        views=item["views"],
        eligibility=eligibility,
        target=f"• 연령: {age_label}\n• 거주지역: {region_label}",
        etc_notes=item.get("note"),
        oper_inst_nm=item.get("org"),
        plcy_expln_cn=item.get("summary"),
        plcy_sprt_cn=item.get("benefit"),
    )


@router.get("/get/policies", response_model=PolicyListResponse)
def list_chuncheon_policies(
    q: Optional[str] = Query(default=None, min_length=1, max_length=100),
    category: Optional[List[str]] = Query(default=None),
    sort: str = Query(default="deadline", pattern="^(popular|deadline|recent)$"),
    # policy.py의 /get/search·/get/policies와 동일한 의미론(생략=무필터, true=마감 제외)으로
    # 통일 — 기본값이 True였을 때 프론트의 "토글 ON 시 파라미터 생략 → 무필터" 패턴이
    # 이 엔드포인트에서만 깨져 마감 정책이 조회되지 않는 버그가 있었다.
    applicable: bool = Query(default=False),
    page: int = Query(default=1, ge=1),
    size: int = Query(default=20, ge=1, le=100),
):
    params = {
        "sort": sort,
        "applicable": applicable,
        "page": page,
        "size": size,
    }
    if q:
        params["q"] = q
    if category:
        params["category"] = category
    data = _get("/get/policies", params=params)
    return PolicyListResponse(
        total=data["total"],
        page=data["page"],
        size=data["size"],
        items=[_to_card(item) for item in data["items"]],
    )


@router.get("/get/policy/{plcy_no}", response_model=PolicyDetail)
def get_chuncheon_policy(plcy_no: str):
    data = _get(f"/get/policy/{plcy_no}")
    return _to_detail(data)
