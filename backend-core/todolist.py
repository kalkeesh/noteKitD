from __future__ import annotations

from typing import List

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, Depends, HTTPException, status
from pymongo.errors import PyMongoError

from authent import get_current_user
from db import db, normalize_user_id, todos_collection, utcnow
from models import TodoBlock, TodoBlockIn


router = APIRouter(prefix="/api/todos", tags=["Todos"])


def todo_serializer(doc: dict) -> dict:
    return {
        "id": str(doc["_id"]),
        "title": doc.get("title", ""),
        "listType": doc.get("listType", "project"),
        "items": [
            {
                "id": int(item.get("id")),
                "text": item.get("text", ""),
                "done": bool(item.get("done", False)),
                "reminderDate": item.get("reminderDate", "") or "",
                "reminderTime": item.get("reminderTime", "") or "",
                "reminderEnabled": bool(item.get("reminderEnabled", False)),
                "notificationId": item.get("notificationId", "") or "",
            }
            for item in doc.get("items", [])
        ],
    }


def parse_object_id(todo_id: str) -> ObjectId:
    try:
        return ObjectId(todo_id)
    except (InvalidId, TypeError) as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid todo id: {todo_id}") from exc


def _assign_ids_to_items(items: List[dict], starting_id: int = 1) -> List[dict]:
    assigned: List[dict] = []
    current = starting_id
    for item in items:
        item = item or {}
        normalized = {
            "id": int(item["id"]) if item.get("id") is not None else current,
            "text": item.get("text", "") or "",
            "done": bool(item.get("done", False)),
            "reminderDate": item.get("reminderDate", "") or "",
            "reminderTime": item.get("reminderTime", "") or "",
            "reminderEnabled": bool(item.get("reminderEnabled", False)),
            "notificationId": item.get("notificationId", "") or "",
        }
        assigned.append(normalized)
        current = max(current, normalized["id"] + 1)
    return assigned


async def migrate_legacy_todos_if_needed(user_email: str) -> None:
    user_id = normalize_user_id(user_email)
    if await todos_collection.count_documents({"user_id": user_id}, limit=1):
        return

    legacy_collection = db[f"{user_id}_todos"]
    legacy_docs = [doc async for doc in legacy_collection.find()]
    if not legacy_docs:
        return

    docs_to_insert = []
    for doc in legacy_docs:
        docs_to_insert.append(
            {
                "user_id": user_id,
                "title": doc.get("title", "Untitled List"),
                "listType": doc.get("listType", "project"),
                "items": _assign_ids_to_items(doc.get("items", []) or [], starting_id=1),
                "created_at": doc.get("created_at") or utcnow(),
                "updated_at": doc.get("updated_at") or doc.get("created_at") or utcnow(),
                "legacy_collection": f"{user_id}_todos",
                "legacy_id": str(doc.get("_id", "")),
            }
        )
    if docs_to_insert:
        await todos_collection.insert_many(docs_to_insert, ordered=False)


@router.post("", response_model=TodoBlock, status_code=status.HTTP_201_CREATED)
async def create_todo_block(todo: TodoBlockIn, current_user=Depends(get_current_user)):
    user_id = normalize_user_id(current_user.get("email"))
    items_input = todo.items or []
    if not items_input:
        items_input = [{"id": 1, "text": "", "done": False, "reminderDate": "", "reminderTime": "", "reminderEnabled": False}]
    raw_items = [item.model_dump() if hasattr(item, "model_dump") else item for item in items_input]
    doc = {
        "user_id": user_id,
        "title": todo.title or "Untitled List",
        "items": _assign_ids_to_items(raw_items, starting_id=1),
        "listType": (todo.listType or "project"),
        "created_at": utcnow(),
        "updated_at": utcnow(),
    }
    try:
        result = await todos_collection.insert_one(doc)
        inserted = await todos_collection.find_one({"_id": result.inserted_id, "user_id": user_id})
    except PyMongoError as exc:
        raise HTTPException(status_code=503, detail="Database unavailable") from exc
    if not inserted:
        raise HTTPException(status_code=500, detail="Failed to create todo block")
    return todo_serializer(inserted)


@router.get("", response_model=List[TodoBlock])
async def get_all_todo_blocks(current_user=Depends(get_current_user)):
    user_id = normalize_user_id(current_user.get("email"))
    try:
        await migrate_legacy_todos_if_needed(user_id)
        blocks = [todo_serializer(doc) async for doc in todos_collection.find({"user_id": user_id}).sort([("_id", 1)])]
    except PyMongoError as exc:
        raise HTTPException(status_code=503, detail="Database unavailable") from exc
    return blocks


@router.get("/{id}", response_model=TodoBlock)
async def get_todo_block(id: str, current_user=Depends(get_current_user)):
    user_id = normalize_user_id(current_user.get("email"))
    todo_object_id = parse_object_id(id)
    try:
        doc = await todos_collection.find_one({"_id": todo_object_id, "user_id": user_id})
    except PyMongoError as exc:
        raise HTTPException(status_code=503, detail="Database unavailable") from exc
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Todo block not found with id {id}")
    return todo_serializer(doc)


@router.put("/{id}", response_model=TodoBlock)
async def update_todo_block(id: str, updated: TodoBlockIn, current_user=Depends(get_current_user)):
    user_id = normalize_user_id(current_user.get("email"))
    todo_object_id = parse_object_id(id)
    try:
        existing = await todos_collection.find_one({"_id": todo_object_id, "user_id": user_id})
    except PyMongoError as exc:
        raise HTTPException(status_code=503, detail="Database unavailable") from exc
    if not existing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Todo block not found with id {id}")

    existing_items = existing.get("items", []) or []
    existing_max_id = max([int(item.get("id", 0)) for item in existing_items] + [0])
    incoming = updated.items or []
    incoming_raw = [item.model_dump() if hasattr(item, "model_dump") else item for item in incoming]
    with_ids = [item for item in incoming_raw if item.get("id") is not None]
    without_ids = [item for item in incoming_raw if item.get("id") is None]

    normalized_with_ids = _assign_ids_to_items(with_ids, starting_id=1)
    next_id = max([item["id"] for item in normalized_with_ids] + [existing_max_id]) + 1
    final_items = sorted(normalized_with_ids + _assign_ids_to_items(without_ids, starting_id=next_id), key=lambda item: item["id"])

    update_doc = {
        "title": updated.title or existing.get("title", "Untitled List"),
        "items": final_items,
        "listType": updated.listType or existing.get("listType", "project"),
        "updated_at": utcnow(),
    }
    try:
        await todos_collection.update_one({"_id": todo_object_id, "user_id": user_id}, {"$set": update_doc})
        new_doc = await todos_collection.find_one({"_id": todo_object_id, "user_id": user_id})
    except PyMongoError as exc:
        raise HTTPException(status_code=503, detail="Database unavailable") from exc
    if not new_doc:
        raise HTTPException(status_code=500, detail="Failed to update todo block")
    return todo_serializer(new_doc)


@router.delete("/{id}", response_model=dict)
async def delete_todo_block(id: str, current_user=Depends(get_current_user)):
    user_id = normalize_user_id(current_user.get("email"))
    todo_object_id = parse_object_id(id)
    try:
        result = await todos_collection.delete_one({"_id": todo_object_id, "user_id": user_id})
    except PyMongoError as exc:
        raise HTTPException(status_code=503, detail="Database unavailable") from exc
    if result.deleted_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Todo block not found with id {id}")
    return {"message": f"Todo block {id} deleted successfully"}
