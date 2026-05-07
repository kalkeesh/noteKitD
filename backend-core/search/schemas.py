from __future__ import annotations

from datetime import datetime
from typing import List, Literal, Optional

from pydantic import BaseModel, Field


class SearchNoteResult(BaseModel):
    id: str
    type: Literal["note"] = "note"
    title: str
    preview: str = ""
    date: Optional[datetime] = None
    score: float = 0


class SearchTodoResult(BaseModel):
    id: str
    type: Literal["todo"] = "todo"
    task: str
    preview: str = ""
    date: Optional[str] = None
    score: float = 0


class GlobalSearchOut(BaseModel):
    notes: List[SearchNoteResult] = Field(default_factory=list)
    todos: List[SearchTodoResult] = Field(default_factory=list)
