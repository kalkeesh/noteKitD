from __future__ import annotations

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pymongo.errors import PyMongoError

from db import normalize_user_id, users_collection
from security import decode_access_token


security = HTTPBearer(auto_error=False)


async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    if not credentials or credentials.scheme.lower() != "bearer":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    payload = decode_access_token(credentials.credentials)
    email = normalize_user_id(payload["sub"])
    try:
        user = await users_collection.find_one({"email": email})
    except PyMongoError as exc:
        raise HTTPException(status_code=503, detail="Database unavailable") from exc
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user
