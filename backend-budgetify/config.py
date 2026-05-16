from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv


BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")
load_dotenv(BASE_DIR.parent / "backend" / ".env")

LOCAL_MONGO_URI = "mongodb://localhost:27017"


def _getenv(name: str, default: str = "") -> str:
    return os.getenv(name) or default


@dataclass(frozen=True)
class Settings:
    mongo_uri: str = _getenv("MONGO_URI", LOCAL_MONGO_URI)
    mongo_db_name: str = _getenv("MONGO_DB_NAME", "notekit")
    mongo_server_selection_timeout_ms: int = int(os.getenv("MONGO_SERVER_SELECTION_TIMEOUT_MS", "5000"))
    mongo_connect_timeout_ms: int = int(os.getenv("MONGO_CONNECT_TIMEOUT_MS", "5000"))
    mongo_socket_timeout_ms: int = int(os.getenv("MONGO_SOCKET_TIMEOUT_MS", "10000"))
    jwt_secret: str = os.getenv("JWT_SECRET", "")
    jwt_algorithm: str = os.getenv("JWT_ALGORITHM", "HS256")
    access_token_expire_minutes: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", str(60 * 24 * 7)))
    app_env: str = os.getenv("APP_ENV", "development")
    require_db_on_startup: bool = os.getenv("REQUIRE_DB_ON_STARTUP", "").strip().lower() in {"1", "true", "yes"}

    def __post_init__(self) -> None:
        is_vercel = os.getenv("VERCEL", "").strip().lower() in {"1", "true", "yes"}
        is_production = self.app_env.lower() == "production"
        if (is_vercel or is_production) and self.mongo_uri == LOCAL_MONGO_URI:
            raise RuntimeError("MONGO_URI must be set to a cloud MongoDB connection string in production/Vercel.")
        if not self.require_db_on_startup:
            object.__setattr__(self, "require_db_on_startup", is_production and not is_vercel)
        if len(self.jwt_secret) < 32:
            raise RuntimeError("JWT_SECRET must be set to a secure value with at least 32 characters.")


settings = Settings()
