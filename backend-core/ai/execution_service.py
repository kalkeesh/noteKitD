from __future__ import annotations

import re
from difflib import SequenceMatcher
from datetime import date, datetime
from typing import Any, Dict, List

from fastapi import HTTPException
from pymongo.errors import PyMongoError

import asyncio
import requests

from config import settings
from db import normalize_user_id, notes_collection, todos_collection, utcnow
from models import Note
from notes import migrate_legacy_notes_if_needed, note_serializer, parse_object_id as parse_note_object_id
from todolist import migrate_legacy_todos_if_needed, parse_object_id as parse_todo_object_id, todo_serializer


def normalize_text(value: Any) -> str:
    return str(value or "").strip()


def collapse_spaces(value: Any) -> str:
    return " ".join(normalize_text(value).split())


def content_to_storage_text(content: Any) -> str:
    if isinstance(content, list):
        lines = [collapse_spaces(item) for item in content if collapse_spaces(item)]
        return "\n".join(f"- {line}" for line in lines)
    return normalize_text(content)


def split_iso_datetime(value: str | None) -> tuple[str, str]:
    raw = normalize_text(value)
    if not raw:
        return "", ""
    try:
        parsed = datetime.fromisoformat(raw)
        return parsed.date().isoformat(), parsed.strftime("%H:%M")
    except ValueError:
        if "T" in raw:
            date_part, time_part = raw.split("T", 1)
            return date_part[:10], time_part[:5]
    return "", ""


def normalize_task_query(value: Any) -> str:
    query = normalize_text(value).lower()
    query = re.sub(r"^(delete|remove|update|edit|change)(?:\s+the|\s+a)?\s+(task|todo)\s+", "", query)
    query = re.sub(r"^(saying|called|named)\s+", "", query)
    query = re.sub(r"^(that\s+is|that\s+says)\s+", "", query)
    return collapse_spaces(query)


class NoteExecutionService:
    async def create_note(self, current_user: Dict[str, Any], title: str, content: Any) -> Dict[str, Any]:
        user_id = normalize_user_id(current_user.get("email"))
        now = utcnow()
        note_dict = Note(
            title=collapse_spaces(title),
            content=content_to_storage_text(content),
        ).model_dump(exclude={"id"})
        note_dict["user_id"] = user_id
        note_dict["created_at"] = now
        note_dict["updated_at"] = now
        try:
            result = await notes_collection.insert_one(note_dict)
            saved = await notes_collection.find_one({"_id": result.inserted_id, "user_id": user_id})
        except PyMongoError as exc:
            raise HTTPException(status_code=503, detail="Database unavailable") from exc
        if not saved:
            raise HTTPException(status_code=500, detail="Failed to create note")
        return note_serializer(saved)

    async def list_notes(self, current_user: Dict[str, Any]) -> List[Dict[str, Any]]:
        user_id = normalize_user_id(current_user.get("email"))
        await migrate_legacy_notes_if_needed(user_id)
        try:
            return [note_serializer(note) async for note in notes_collection.find({"user_id": user_id})]
        except PyMongoError as exc:
            raise HTTPException(status_code=503, detail="Database unavailable") from exc

    async def find_note(self, current_user: Dict[str, Any], query: str) -> Dict[str, Any] | None:
        normalized_query = normalize_text(query).lower()
        if not normalized_query:
            return None

        notes = await self.list_notes(current_user)
        for note in notes:
            if str(note.get("id")) == normalized_query:
                return note

        exact_matches = [note for note in notes if normalize_text(note.get("title")).lower() == normalized_query]
        if len(exact_matches) == 1:
            return exact_matches[0]

        partial_matches = [note for note in notes if normalized_query in normalize_text(note.get("title")).lower()]
        if len(partial_matches) == 1:
            return partial_matches[0]

        fuzzy_matches = [
            note
            for note in notes
            if SequenceMatcher(None, normalize_text(note.get("title")).lower(), normalized_query).ratio() >= 0.7
        ]
        return fuzzy_matches[0] if len(fuzzy_matches) == 1 else None

    async def update_note(
        self,
        current_user: Dict[str, Any],
        note_id: str,
        *,
        title: str | None = None,
        content: Any = None,
    ) -> Dict[str, Any]:
        user_id = normalize_user_id(current_user.get("email"))
        object_id = parse_note_object_id(note_id)
        try:
            existing = await notes_collection.find_one({"_id": object_id, "user_id": user_id})
        except PyMongoError as exc:
            raise HTTPException(status_code=503, detail="Database unavailable") from exc
        if not existing:
            raise HTTPException(status_code=404, detail=f"Note not found with id {note_id}")

        updated_data = {
            "title": collapse_spaces(title) or existing.get("title", ""),
            "content": content_to_storage_text(content) if content not in (None, "") else existing.get("content", ""),
            "updated_at": utcnow(),
        }
        try:
            await notes_collection.update_one({"_id": object_id, "user_id": user_id}, {"$set": updated_data})
            saved = await notes_collection.find_one({"_id": object_id, "user_id": user_id})
        except PyMongoError as exc:
            raise HTTPException(status_code=503, detail="Database unavailable") from exc
        if not saved:
            raise HTTPException(status_code=500, detail="Failed to update note")
        return note_serializer(saved)

    async def delete_note(self, current_user: Dict[str, Any], note_id: str) -> None:
        user_id = normalize_user_id(current_user.get("email"))
        object_id = parse_note_object_id(note_id)
        try:
            result = await notes_collection.delete_one({"_id": object_id, "user_id": user_id})
        except PyMongoError as exc:
            raise HTTPException(status_code=503, detail="Database unavailable") from exc
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail=f"Note not found with id {note_id}")


class TaskExecutionService:
    async def list_todos(self, current_user: Dict[str, Any]) -> List[Dict[str, Any]]:
        user_id = normalize_user_id(current_user.get("email"))
        await migrate_legacy_todos_if_needed(user_id)
        try:
            return [todo_serializer(todo) async for todo in todos_collection.find({"user_id": user_id}).sort([("_id", 1)])]
        except PyMongoError as exc:
            raise HTTPException(status_code=503, detail="Database unavailable") from exc

    async def _find_project_by_name(self, current_user: Dict[str, Any], project_name: str) -> Dict[str, Any] | None:
        query = normalize_text(project_name).lower()
        if not query:
            return None
        todos = await self.list_todos(current_user)
        exact = [
            todo
            for todo in todos
            if todo.get("listType") == "project" and normalize_text(todo.get("title")).lower() == query
        ]
        if exact:
            return exact[0]
        partial = [
            todo
            for todo in todos
            if todo.get("listType") == "project" and query in normalize_text(todo.get("title")).lower()
        ]
        return partial[0] if len(partial) == 1 else None

    async def find_task(self, current_user: Dict[str, Any], query: str) -> Dict[str, Any] | None:
        normalized_query = normalize_task_query(query)
        if not normalized_query:
            return None
        todos = await self.list_todos(current_user)
        matches: List[Dict[str, Any]] = []

        for todo in todos:
            items = todo.get("items") or []
            title = normalize_text(todo.get("title")).lower()
            if todo.get("listType") == "task":
                item = items[0] if items else {}
                item_text = normalize_text(item.get("text")).lower()
                if normalized_query in {str(todo.get("id")), title, item_text} or normalized_query in title or normalized_query in item_text:
                    matches.append({"owner": todo, "item": item, "owner_type": "task"})
                continue

            for item in items:
                item_text = normalize_text(item.get("text")).lower()
                combined = f"{title} {item_text}".strip()
                if normalized_query == item_text or normalized_query == combined or normalized_query in item_text or normalized_query in combined:
                    matches.append({"owner": todo, "item": item, "owner_type": "project"})
        return matches[0] if len(matches) == 1 else None

    async def create_task(
        self,
        current_user: Dict[str, Any],
        *,
        title: str,
        datetime_iso: str | None,
        project: str | None,
    ) -> Dict[str, Any]:
        user_id = normalize_user_id(current_user.get("email"))
        reminder_date, reminder_time = split_iso_datetime(datetime_iso)
        task_item = {
            "id": 1,
            "text": collapse_spaces(title),
            "done": False,
            "reminderDate": reminder_date,
            "reminderTime": reminder_time,
            "reminderEnabled": bool(reminder_date and reminder_time),
            "notificationId": "",
        }

        if normalize_text(project):
            existing_project = await self._find_project_by_name(current_user, normalize_text(project))
            if existing_project:
                object_id = parse_todo_object_id(existing_project["id"])
                try:
                    existing_doc = await todos_collection.find_one({"_id": object_id, "user_id": user_id})
                except PyMongoError as exc:
                    raise HTTPException(status_code=503, detail="Database unavailable") from exc
                if not existing_doc:
                    raise HTTPException(status_code=404, detail="Project not found")
                items = list(existing_doc.get("items") or [])
                next_id = max([int(item.get("id", 0)) for item in items] + [0]) + 1
                task_item["id"] = next_id
                items.append(task_item)
                await todos_collection.update_one(
                    {"_id": object_id, "user_id": user_id},
                    {"$set": {"title": existing_doc.get("title") or collapse_spaces(project), "listType": "project", "items": items, "updated_at": utcnow()}},
                )
                updated = await todos_collection.find_one({"_id": object_id, "user_id": user_id})
                if not updated:
                    raise HTTPException(status_code=500, detail="Failed to create task")
                return todo_serializer(updated)

            doc = {
                "user_id": user_id,
                "title": collapse_spaces(project),
                "listType": "project",
                "items": [task_item],
                "created_at": utcnow(),
                "updated_at": utcnow(),
            }
            result = await todos_collection.insert_one(doc)
            saved = await todos_collection.find_one({"_id": result.inserted_id, "user_id": user_id})
            if not saved:
                raise HTTPException(status_code=500, detail="Failed to create task")
            return todo_serializer(saved)

        doc = {
            "user_id": user_id,
            "title": collapse_spaces(title) or "Standalone Task",
            "listType": "task",
            "items": [task_item],
            "created_at": utcnow(),
            "updated_at": utcnow(),
        }
        result = await todos_collection.insert_one(doc)
        saved = await todos_collection.find_one({"_id": result.inserted_id, "user_id": user_id})
        if not saved:
            raise HTTPException(status_code=500, detail="Failed to create task")
        return todo_serializer(saved)

    async def update_task(
        self,
        current_user: Dict[str, Any],
        *,
        query: str,
        title: str | None = None,
        datetime_iso: str | None = None,
        project: str | None = None,
    ) -> Dict[str, Any]:
        user_id = normalize_user_id(current_user.get("email"))
        found = await self.find_task(current_user, query)
        if not found:
            raise HTTPException(status_code=404, detail="Task not found")

        try:
            owner_doc = await todos_collection.find_one({"_id": parse_todo_object_id(found["owner"]["id"]), "user_id": user_id})
        except PyMongoError as exc:
            raise HTTPException(status_code=503, detail="Database unavailable") from exc
        if not owner_doc:
            raise HTTPException(status_code=404, detail="Task owner not found")

        reminder_date, reminder_time = split_iso_datetime(datetime_iso)
        target_item_id = int(found["item"].get("id") or 1)
        items = list(owner_doc.get("items") or [])
        for item in items:
            if int(item.get("id") or 0) != target_item_id:
                continue
            if collapse_spaces(title):
                item["text"] = collapse_spaces(title)
                if owner_doc.get("listType") == "task":
                    owner_doc["title"] = collapse_spaces(title)
            if reminder_date:
                item["reminderDate"] = reminder_date
                item["reminderTime"] = reminder_time or item.get("reminderTime", "")
                item["reminderEnabled"] = bool(item.get("reminderDate") and item.get("reminderTime"))

        next_title = owner_doc.get("title") or "Untitled Project"
        if normalize_text(project) and owner_doc.get("listType") == "project":
            next_title = collapse_spaces(project)

        await todos_collection.update_one(
            {"_id": owner_doc["_id"], "user_id": user_id},
            {"$set": {"title": next_title, "listType": owner_doc.get("listType") or "task", "items": items, "updated_at": utcnow()}},
        )
        saved = await todos_collection.find_one({"_id": owner_doc["_id"], "user_id": user_id})
        if not saved:
            raise HTTPException(status_code=500, detail="Failed to update task")
        return todo_serializer(saved)

    async def delete_task(self, current_user: Dict[str, Any], *, query: str) -> Dict[str, Any]:
        user_id = normalize_user_id(current_user.get("email"))
        found = await self.find_task(current_user, query)
        if not found:
            raise HTTPException(status_code=404, detail="Task not found")

        owner_doc = await todos_collection.find_one({"_id": parse_todo_object_id(found["owner"]["id"]), "user_id": user_id})
        if not owner_doc:
            raise HTTPException(status_code=404, detail="Task owner not found")

        if owner_doc.get("listType") == "task":
            await todos_collection.delete_one({"_id": owner_doc["_id"], "user_id": user_id})
            return {"id": found["owner"]["id"], "title": found["owner"].get("title", "")}

        target_item_id = int(found["item"].get("id") or 1)
        next_items = [item for item in owner_doc.get("items") or [] if int(item.get("id") or 0) != target_item_id]
        await todos_collection.update_one(
            {"_id": owner_doc["_id"], "user_id": user_id},
            {"$set": {"items": next_items, "updated_at": utcnow()}},
        )
        updated = await todos_collection.find_one({"_id": owner_doc["_id"], "user_id": user_id})
        if not updated:
            raise HTTPException(status_code=500, detail="Failed to delete task")
        return todo_serializer(updated)


class BudgetExecutionService:
    async def add_expense(
        self,
        current_user: Dict[str, Any],
        *,
        title: str,
        amount: float,
        category: str,
        spend_date: date,
    ) -> Dict[str, Any]:
        user_email = normalize_user_id(current_user.get("email"))
        token = normalize_text(current_user.get("_access_token"))
        if not token:
            raise HTTPException(status_code=401, detail="Not authenticated")

        payload = {
            "amount": float(amount),
            "category": normalize_text(category) or "general",
            "note": collapse_spaces(title),
            "date": spend_date.isoformat(),
        }

        def _request() -> Dict[str, Any]:
            response = requests.post(
                f"{settings.budgetify_api_base_url}/budget/spend",
                headers={
                    "Authorization": f"Bearer {token}",
                    "Content-Type": "application/json",
                },
                json=payload,
                timeout=settings.ai_timeout_seconds,
            )
            response.raise_for_status()
            data = response.json()
            return data if isinstance(data, dict) else {}

        try:
            return await asyncio.to_thread(_request)
        except requests.HTTPError as exc:
            status_code = exc.response.status_code if exc.response is not None else 502
            detail = "Budgetify service request failed"
            try:
                detail = exc.response.json().get("detail", detail) if exc.response is not None else detail
            except Exception:
                pass
            raise HTTPException(status_code=status_code, detail=detail) from exc
        except requests.RequestException as exc:
            raise HTTPException(status_code=503, detail="Budgetify service unavailable") from exc
