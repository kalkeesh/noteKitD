from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv


BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")
load_dotenv(BASE_DIR.parent / "backend" / ".env")


@dataclass(frozen=True)
class Settings:
    mongo_uri: str = os.getenv("MONGO_URI", "mongodb://localhost:27017")
    mongo_db_name: str = os.getenv("MONGO_DB_NAME", "notekit")
    mongo_server_selection_timeout_ms: int = int(os.getenv("MONGO_SERVER_SELECTION_TIMEOUT_MS", "5000"))
    mongo_connect_timeout_ms: int = int(os.getenv("MONGO_CONNECT_TIMEOUT_MS", "5000"))
    mongo_socket_timeout_ms: int = int(os.getenv("MONGO_SOCKET_TIMEOUT_MS", "10000"))
    jwt_secret: str = os.getenv("JWT_SECRET", "")
    jwt_algorithm: str = os.getenv("JWT_ALGORITHM", "HS256")
    access_token_expire_minutes: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", str(60 * 24 * 7)))
    app_env: str = os.getenv("APP_ENV", "development")
    require_db_on_startup: bool = os.getenv("REQUIRE_DB_ON_STARTUP", "").strip().lower() in {"1", "true", "yes"}

    def __post_init__(self) -> None:
        if not self.require_db_on_startup:
            object.__setattr__(self, "require_db_on_startup", self.app_env.lower() == "production")
        if len(self.jwt_secret) < 32:
            raise RuntimeError("JWT_SECRET must be set to a secure value with at least 32 characters.")


settings = Settings()
