from __future__ import annotations

import re
from typing import Dict, List

from pymongo.errors import OperationFailure, PyMongoError

from config import settings
from db import normalize_user_id, notes_collection, todos_collection
from notes import migrate_legacy_notes_if_needed
from todolist import migrate_legacy_todos_if_needed


DEFAULT_LIMIT = 10


def escape_regex(value: str) -> str:
    return re.escape(value or "")


class SearchRepository:
    def __init__(self):
        self._notes_collection = notes_collection
        self._todos_collection = todos_collection
        self._notes_index = settings.atlas_search_notes_index
        self._todos_index = settings.atlas_search_todos_index

    async def search_notes(self, user_email: str, query: str, limit: int = DEFAULT_LIMIT) -> List[Dict]:
        user_id = normalize_user_id(user_email)
        await migrate_legacy_notes_if_needed(user_id)
        pipeline = [
            {
                "$search": {
                    "index": self._notes_index,
                    "text": {
                        "query": query,
                        "path": ["title", "content"],
                        "fuzzy": {"maxEdits": 2},
                    },
                }
            },
            {"$match": {"user_id": user_id}},
            {
                "$project": {
                    "title": 1,
                    "content": 1,
                    "created_at": 1,
                    "updated_at": 1,
                    "score": {"$meta": "searchScore"},
                }
            },
            {"$sort": {"score": -1, "updated_at": -1}},
            {"$limit": int(limit)},
        ]

        try:
            return [doc async for doc in self._notes_collection.aggregate(pipeline)]
        except OperationFailure as exc:
            if "$search" not in str(exc):
                raise
        except PyMongoError:
            raise

        regex = {"$regex": escape_regex(query), "$options": "i"}
        cursor = self._notes_collection.find(
            {
                "user_id": user_id,
                "$or": [{"title": regex}, {"content": regex}],
            },
            {"title": 1, "content": 1, "created_at": 1, "updated_at": 1},
        ).sort([("updated_at", -1)]).limit(int(limit))
        docs = [doc async for doc in cursor]
        for doc in docs:
            doc["score"] = 0
        return docs

    async def search_todos(self, user_email: str, query: str, limit: int = DEFAULT_LIMIT) -> List[Dict]:
        user_id = normalize_user_id(user_email)
        await migrate_legacy_todos_if_needed(user_id)
        pipeline = [
            {
                "$search": {
                    "index": self._todos_index,
                    "text": {
                        "query": query,
                        "path": ["title", "items.text"],
                        "fuzzy": {"maxEdits": 2},
                    },
                }
            },
            {"$match": {"user_id": user_id}},
            {
                "$project": {
                    "title": 1,
                    "listType": 1,
                    "items": 1,
                    "created_at": 1,
                    "updated_at": 1,
                    "score": {"$meta": "searchScore"},
                }
            },
            {"$sort": {"score": -1, "updated_at": -1}},
            {"$limit": int(limit)},
        ]

        try:
            return [doc async for doc in self._todos_collection.aggregate(pipeline)]
        except OperationFailure as exc:
            if "$search" not in str(exc):
                raise
        except PyMongoError:
            raise

        regex = {"$regex": escape_regex(query), "$options": "i"}
        cursor = self._todos_collection.find(
            {
                "user_id": user_id,
                "$or": [{"title": regex}, {"items.text": regex}],
            },
            {"title": 1, "listType": 1, "items": 1, "created_at": 1, "updated_at": 1},
        ).sort([("updated_at", -1)]).limit(int(limit))
        docs = [doc async for doc in cursor]
        for doc in docs:
            doc["score"] = 0
        return docs
