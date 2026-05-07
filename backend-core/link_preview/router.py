from __future__ import annotations

import asyncio

from fastapi import APIRouter, Query

from .schemas import LinkPreviewOut
from .service import fetch_link_preview


router = APIRouter(tags=["Link Preview"])


@router.get("/link-preview", response_model=LinkPreviewOut)
async def get_link_preview(url: str = Query(..., min_length=1, max_length=2000)):
    return await asyncio.to_thread(fetch_link_preview, url.strip())
