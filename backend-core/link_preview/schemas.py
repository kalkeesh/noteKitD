from __future__ import annotations

from typing import Optional

from pydantic import BaseModel


class LinkPreviewOut(BaseModel):
    title: str = ""
    description: str = ""
    image: Optional[str] = None
    url: str
    domain: str
