from __future__ import annotations

import base64
import hashlib
import hmac
import secrets
from datetime import timedelta
from typing import Any

import jwt
from fastapi import HTTPException, status

from config import settings
from db import utcnow


PBKDF2_PREFIX = "pbkdf2_sha256"
PBKDF2_ITERATIONS = 390000
PBKDF2_SALT_BYTES = 16


def is_strong_password(password: str) -> bool:
    value = password or ""
    has_length = 8 <= len(value) <= 128
    has_letter = any(ch.isalpha() for ch in value)
    has_digit = any(ch.isdigit() for ch in value)
    return has_length and has_letter and has_digit


def _pbkdf2_hash(password: str, *, salt: bytes | None = None, iterations: int = PBKDF2_ITERATIONS) -> str:
    salt = salt or secrets.token_bytes(PBKDF2_SALT_BYTES)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, iterations)
    salt_b64 = base64.b64encode(salt).decode("ascii")
    digest_b64 = base64.b64encode(digest).decode("ascii")
    return f"{PBKDF2_PREFIX}${iterations}${salt_b64}${digest_b64}"


def hash_password(password: str) -> str:
    return _pbkdf2_hash(password)


def is_password_hash(value: str | None) -> bool:
    text = value or ""
    return text.startswith(f"{PBKDF2_PREFIX}$") or text.startswith("$2a$") or text.startswith("$2b$") or text.startswith("$2y$")


def _verify_pbkdf2_password(password: str, stored_value: str) -> bool:
    try:
        _, iteration_str, salt_b64, digest_b64 = stored_value.split("$", 3)
        iterations = int(iteration_str)
        salt = base64.b64decode(salt_b64.encode("ascii"))
        expected = _pbkdf2_hash(password, salt=salt, iterations=iterations)
        return hmac.compare_digest(expected, stored_value)
    except Exception:
        return False


def verify_password(password: str, stored_value: str | None) -> bool:
    if not stored_value:
        return False
    if stored_value.startswith(f"{PBKDF2_PREFIX}$"):
        return _verify_pbkdf2_password(password, stored_value)
    return secrets.compare_digest(password, stored_value)


def create_access_token(subject: str, expires_delta: timedelta | None = None) -> str:
    expire_at = utcnow() + (expires_delta or timedelta(minutes=settings.access_token_expire_minutes))
    payload = {"sub": subject, "exp": expire_at}
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> dict[str, Any]:
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except jwt.ExpiredSignatureError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expired") from exc
    except jwt.PyJWTError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token") from exc
    if not payload.get("sub"):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid authentication credentials")
    return payload


def generate_otp() -> str:
    return f"{secrets.randbelow(900000) + 100000:06d}"


def hash_otp(otp: str) -> str:
    return hash_password(otp)


def generate_reset_token() -> str:
    return secrets.token_urlsafe(32)
