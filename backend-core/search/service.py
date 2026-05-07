from __future__ import annotations

import asyncio
import re
from html import unescape
from datetime import datetime
from typing import Dict, List

from .repository import SearchRepository


def strip_html(value: str) -> str:
    text = str(value or "")
    text = re.sub(r"<style[\s\S]*?</style>", " ", text, flags=re.IGNORECASE)
    text = re.sub(r"<script[\s\S]*?</script>", " ", text, flags=re.IGNORECASE)
    text = re.sub(r"<[^>]+>", " ", text)
    return unescape(text)


def trim_preview(value: str, limit: int = 120) -> str:
    text = " ".join(strip_html(value).split())
    if len(text) <= limit:
        return text
    return f"{text[: limit - 3].rstrip()}..."


def note_preview(doc: Dict) -> str:
    return trim_preview(doc.get("content") or "")


def todo_preview(doc: Dict) -> str:
    items = doc.get("items") or []
    non_empty = [str(item.get("text") or "").strip() for item in items if str(item.get("text") or "").strip()]
    if non_empty:
        return trim_preview(" | ".join(non_empty[:3]))
    return "No task details"


def todo_date(doc: Dict) -> str | None:
    items = doc.get("items") or []
    for item in items:
        reminder_date = item.get("reminderDate")
        if reminder_date:
            return reminder_date
    created_at = doc.get("created_at")
    if isinstance(created_at, datetime):
        return created_at.date().isoformat()
    return None


class SearchService:
    def __init__(self, repo: SearchRepository):
        self.repo = repo

    async def global_search(self, user_email: str, query: str) -> Dict[str, List[Dict]]:
        text = (query or "").strip()
        if len(text) < 3:
            return {"notes": [], "todos": []}

        notes_docs, todo_docs = await asyncio.gather(
            self.repo.search_notes(user_email, text, limit=10),
            self.repo.search_todos(user_email, text, limit=10),
        )

        notes = [
            {
                "id": str(doc["_id"]),
                "type": "note",
                "title": doc.get("title") or "Untitled Note",
                "preview": note_preview(doc),
                "date": doc.get("updated_at") or doc.get("created_at"),
                "score": float(doc.get("score") or 0),
            }
            for doc in notes_docs
        ]
        todos = [
            {
                "id": str(doc["_id"]),
                "type": "todo",
                "task": doc.get("title") or "Untitled Task List",
                "preview": todo_preview(doc),
                "date": todo_date(doc),
                "score": float(doc.get("score") or 0),
            }
            for doc in todo_docs
        ]

        return {"notes": notes, "todos": todos}
