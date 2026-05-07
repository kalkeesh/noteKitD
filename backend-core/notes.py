from __future__ import annotations

from typing import List

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, Depends, HTTPException, status
from pymongo.errors import PyMongoError

from authent import get_current_user
from db import db, normalize_user_id, notes_collection, utcnow
from models import HealthResponse, Note


router = APIRouter(prefix="/api/notes", tags=["Notes"])


def note_serializer(note: dict) -> dict:
    return {
        "id": str(note["_id"]),
        "title": note.get("title", ""),
        "content": note.get("content", ""),
        "created_at": note.get("created_at"),
        "updated_at": note.get("updated_at"),
    }


def parse_object_id(note_id: str) -> ObjectId:
    try:
        return ObjectId(note_id)
    except (InvalidId, TypeError) as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid note id: {note_id}") from exc


async def migrate_legacy_notes_if_needed(user_email: str) -> None:
    user_id = normalize_user_id(user_email)
    if await notes_collection.count_documents({"user_id": user_id}, limit=1):
        return

    legacy_collection = db[user_id]
    legacy_docs = [doc async for doc in legacy_collection.find()]
    if not legacy_docs:
        return

    docs_to_insert = []
    for doc in legacy_docs:
        docs_to_insert.append(
            {
                "user_id": user_id,
                "title": doc.get("title", ""),
                "content": doc.get("content", ""),
                "created_at": doc.get("created_at") or utcnow(),
                "updated_at": doc.get("updated_at") or doc.get("created_at") or utcnow(),
                "legacy_collection": user_id,
                "legacy_id": str(doc.get("_id", "")),
            }
        )
    if docs_to_insert:
        await notes_collection.insert_many(docs_to_insert, ordered=False)


@router.post("", response_model=Note, status_code=status.HTTP_201_CREATED)
async def create_note(note: Note, current_user=Depends(get_current_user)):
    user_id = normalize_user_id(current_user.get("email"))
    now = utcnow()
    note_dict = note.model_dump(exclude={"id"})
    note_dict["user_id"] = user_id
    note_dict["created_at"] = now
    note_dict["updated_at"] = now
    try:
        result = await notes_collection.insert_one(note_dict)
        new_note = await notes_collection.find_one({"_id": result.inserted_id, "user_id": user_id})
    except PyMongoError as exc:
        raise HTTPException(status_code=503, detail="Database unavailable") from exc
    if not new_note:
        raise HTTPException(status_code=500, detail="Failed to create note")
    return note_serializer(new_note)


@router.get("", response_model=List[Note])
async def get_all_notes(current_user=Depends(get_current_user)):
    user_id = normalize_user_id(current_user.get("email"))
    try:
        await migrate_legacy_notes_if_needed(user_id)
        notes = [note_serializer(note) async for note in notes_collection.find({"user_id": user_id}).sort([("updated_at", -1)])]
    except PyMongoError as exc:
        raise HTTPException(status_code=503, detail="Database unavailable") from exc
    return notes


@router.put("/{id}", response_model=Note)
async def update_note(id: str, updated_note: Note, current_user=Depends(get_current_user)):
    user_id = normalize_user_id(current_user.get("email"))
    note_object_id = parse_object_id(id)
    updated_data = updated_note.model_dump(exclude={"id", "created_at", "updated_at"})
    updated_data["updated_at"] = utcnow()
    try:
        result = await notes_collection.update_one(
            {"_id": note_object_id, "user_id": user_id},
            {"$set": updated_data},
        )
        if result.matched_count == 0:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Note not found with id {id}")
        updated = await notes_collection.find_one({"_id": note_object_id, "user_id": user_id})
    except HTTPException:
        raise
    except PyMongoError as exc:
        raise HTTPException(status_code=503, detail="Database unavailable") from exc
    if not updated:
        raise HTTPException(status_code=500, detail="Failed to update note")
    return note_serializer(updated)


@router.delete("/{id}", response_model=dict)
async def delete_note(id: str, current_user=Depends(get_current_user)):
    user_id = normalize_user_id(current_user.get("email"))
    note_object_id = parse_object_id(id)
    try:
        result = await notes_collection.delete_one({"_id": note_object_id, "user_id": user_id})
    except PyMongoError as exc:
        raise HTTPException(status_code=503, detail="Database unavailable") from exc
    if result.deleted_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Note not found with id {id}")
    return {"message": f"Note {id} deleted successfully"}


@router.get("/health", response_model=HealthResponse)
async def health_check():
    return HealthResponse(status="healthy", message="Notes service is healthy")
