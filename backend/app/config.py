import os
from pathlib import Path

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "Unscrolling"
    environment: str = "development"

    # CORS (comma-separated origins; include your frontend origin to avoid OPTIONS 400)
    cors_origins: str = "http://localhost:8080,http://127.0.0.1:8080,http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000,http://127.0.0.1:3000"

    # Database
    database_url: str = "sqlite:///./data/newsletter.db"

    # LLM (Gemini)
    gemini_api_key: str = ""
    gemini_model: str = "gemini-2.5-flash"  # Override via GEMINI_MODEL if your API expects a different name

    # ElevenLabs
    elevenlabs_api_key_stt: str = ""
    elevenlabs_api_key_tts: str = ""

    # YouTube Data API v3 (metadata for YouTube; get key at https://console.cloud.google.com/apis/credentials)
    youtube_api_key: str = ""

    # Nitter instance for X/Twitter RSS (e.g. https://nitter.net or https://nitter.mint.lgbt)
    nitter_base_url: str = "https://nitter.net"

    # Apify (e.g. for LinkedIn profile posts). Get token at https://console.apify.com/account/integrations
    apify_api_token: str = ""

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
