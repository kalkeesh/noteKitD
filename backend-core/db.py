from __future__ import annotations

from datetime import datetime

from fastapi import HTTPException
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorCollection, AsyncIOMotorDatabase
from pymongo.errors import PyMongoError

from config import settings


mongo_client = AsyncIOMotorClient(
    settings.mongo_uri,
    serverSelectionTimeoutMS=settings.mongo_server_selection_timeout_ms,
    connectTimeoutMS=settings.mongo_connect_timeout_ms,
    socketTimeoutMS=settings.mongo_socket_timeout_ms,
    maxPoolSize=50,
)
db: AsyncIOMotorDatabase = mongo_client[settings.mongo_db_name]

users_collection: AsyncIOMotorCollection = db["user_credentials"]
notes_collection: AsyncIOMotorCollection = db["notes"]
todos_collection: AsyncIOMotorCollection = db["todo_blocks"]


def normalize_user_id(user_email: str) -> str:
    value = (user_email or "").strip().lower()
    if not value:
        raise HTTPException(status_code=400, detail="Authenticated user email is required.")
    return value


def utcnow() -> datetime:
    return datetime.utcnow()


async def ensure_core_indexes() -> None:
    try:
        await users_collection.create_index("email", unique=True)
        await users_collection.create_index("password_reset.expires_at")
        await notes_collection.create_index([("user_id", 1), ("updated_at", -1)])
        await notes_collection.create_index([("user_id", 1), ("title", 1)])
        await todos_collection.create_index([("user_id", 1), ("updated_at", -1)])
        await todos_collection.create_index([("user_id", 1), ("title", 1)])
        await todos_collection.create_index([("user_id", 1), ("listType", 1)])
    except PyMongoError as exc:
        raise RuntimeError(f"Failed to create MongoDB indexes: {exc}") from exc


async def verify_database_connection() -> None:
    try:
        await db.command("ping")
    except PyMongoError as exc:
        raise RuntimeError(f"MongoDB connection failed: {exc}") from exc
