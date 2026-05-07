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


def normalize_user_id(user_email: str) -> str:
    value = (user_email or "").strip().lower()
    if not value:
        raise HTTPException(status_code=400, detail="Authenticated user email is required.")
    return value


def utcnow() -> datetime:
    return datetime.utcnow()


async def verify_database_connection() -> None:
    try:
        await db.command("ping")
    except PyMongoError as exc:
        raise RuntimeError(f"MongoDB connection failed: {exc}") from exc
