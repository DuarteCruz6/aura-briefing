import os
from pathlib import Path

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "Pastel de Data"
    environment: str = "development"

    # CORS (comma-separated origins; e.g. http://localhost:8080 for frontend dev server)
    cors_origins: str = "http://localhost:8080,http://127.0.0.1:8080"

    # Database
    database_url: str = "sqlite:///./data/newsletter.db"

    # LLM (Gemini)
    gemini_api_key: str = ""
    gemini_model: str = "gemini-2.5-flash"  # Override via GEMINI_MODEL if your API expects a different name

    # ElevenLabs (STT for non-YouTube or fallback; not used for YouTube when transcript API is used)
    elevenlabs_api_key: str = ""

    # YouTube Data API v3 (metadata for YouTube; get key at https://console.cloud.google.com/apis/credentials)
    youtube_api_key: str = ""

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


def get_database_path() -> Path:
    """Ensure database directory exists for SQLite."""
    url = settings.database_url
    if url.startswith("sqlite:///"):
        raw = url.replace("sqlite:///", "").lstrip("/")
        path = Path(raw)
        path.parent.mkdir(parents=True, exist_ok=True)
        return path
    return Path(".")


settings = Settings()
