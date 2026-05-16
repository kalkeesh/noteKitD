from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv


BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")
load_dotenv(BASE_DIR.parent / "backend" / ".env")

LOCAL_MONGO_URI = "mongodb://localhost:27017"


def _split_csv(value: str | None) -> list[str]:
    if not value:
        return []
    return [item.strip() for item in value.split(",") if item.strip()]


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
    email_user: str = os.getenv("EMAIL_USER", "")
    email_pass: str = (os.getenv("EMAIL_PASS", "") or "").replace(" ", "")
    email_enabled: bool = os.getenv("EMAIL_ENABLED", "").strip().lower() in {"1", "true", "yes"}
    smtp_host: str = os.getenv("SMTP_HOST", "smtp.gmail.com")
    smtp_port: int = int(os.getenv("SMTP_PORT", "465"))
    smtp_timeout_seconds: int = int(os.getenv("SMTP_TIMEOUT_SECONDS", "10"))
    otp_expire_minutes: int = int(os.getenv("OTP_EXPIRE_MINUTES", "10"))
    password_reset_window_minutes: int = int(os.getenv("PASSWORD_RESET_WINDOW_MINUTES", "15"))
    cors_allowed_origins: list[str] = None  # type: ignore[assignment]
    cors_allow_origin_regex: str | None = os.getenv("CORS_ALLOW_ORIGIN_REGEX")
    atlas_search_notes_index: str = os.getenv("ATLAS_SEARCH_NOTES_INDEX", "default")
    atlas_search_todos_index: str = os.getenv("ATLAS_SEARCH_TODOS_INDEX", "default")
    gemini_api_key: str = os.getenv("GEMINI_API_KEY", "")
    gemini_model: str = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")
    groq_api_key: str = os.getenv("GROQ_API_KEY") or os.getenv("AI_API_KEY", "")
    groq_model: str = os.getenv("GROQ_MODEL") or os.getenv("AI_CHAT_MODEL", "llama-3.3-70b-versatile")
    groq_transcribe_model: str = os.getenv("GROQ_TRANSCRIBE_MODEL") or os.getenv(
        "AI_TRANSCRIBE_MODEL", "whisper-large-v3-turbo"
    )
    ai_timeout_seconds: int = int(os.getenv("AI_TIMEOUT_SECONDS", "20"))
    ai_api_base_url: str = (os.getenv("AI_API_BASE_URL", "https://api.groq.com/openai/v1")).rstrip("/")
    budgetify_api_base_url: str = os.getenv("BUDGETIFY_API_BASE_URL", "http://localhost:8001").rstrip("/")
    app_env: str = os.getenv("APP_ENV", "development")
    require_db_on_startup: bool = os.getenv("REQUIRE_DB_ON_STARTUP", "").strip().lower() in {"1", "true", "yes"}

    def __post_init__(self) -> None:
        is_vercel = os.getenv("VERCEL", "").strip().lower() in {"1", "true", "yes"}
        is_production = self.app_env.lower() == "production"
        default_origins = ",".join(
            [
                "http://localhost:3000",
                "http://127.0.0.1:3000",
                "http://localhost:8081",
                "http://127.0.0.1:8081",
                "http://localhost:19006",
                "http://127.0.0.1:19006",
            ]
        )
        origins = _split_csv(os.getenv("CORS_ALLOWED_ORIGINS", default_origins))
        object.__setattr__(self, "cors_allowed_origins", origins)
        if (is_vercel or is_production) and self.mongo_uri == LOCAL_MONGO_URI:
            raise RuntimeError("MONGO_URI must be set to a cloud MongoDB connection string in production/Vercel.")
        if not self.email_enabled:
            object.__setattr__(self, "email_enabled", bool(self.email_user and self.email_pass))
        if not self.require_db_on_startup:
            object.__setattr__(self, "require_db_on_startup", is_production and not is_vercel)

        if len(self.jwt_secret) < 32:
            raise RuntimeError("JWT_SECRET must be set to a secure value with at least 32 characters.")


settings = Settings()
