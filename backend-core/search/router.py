from __future__ import annotations

from fastapi import APIRouter, Depends, Query

from authent import get_current_user

from .repository import SearchRepository
from .schemas import GlobalSearchOut
from .service import SearchService


router = APIRouter(prefix="/search", tags=["Search"])
service = SearchService(SearchRepository())


@router.get("/global", response_model=GlobalSearchOut)
async def global_search(
    query: str = Query(..., min_length=1, max_length=120),
    current_user=Depends(get_current_user),
):
    return await service.global_search(current_user["email"], query)
