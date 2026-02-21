import asyncio
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from sqlalchemy import text

from app.config import settings
from app.db import engine, init_db


class TranscribeRequest(BaseModel):
    url: str


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(
    title=settings.app_name,
    lifespan=lifespan,
)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/tables")
def debug_tables():
    """List DB tables and row counts (handy for local/dev)."""
    with engine.connect() as conn:
        result = conn.execute(
            text(
                "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
            )
        )
        tables = [row[0] for row in result]
    out = {}
    with engine.connect() as conn:
        for name in tables:
            count = conn.execute(text(f"SELECT COUNT(*) FROM [{name}]")).scalar()
            out[name] = count
    return {"tables": out}

@app.post("/transcribe")
async def transcribe_youtube(body: TranscribeRequest):
    """
    Download audio from a YouTube URL and return transcript (ElevenLabs STT).
    Requires ELEVENLABS_API_KEY in env.
    """
    url = (body.url or "").strip()
    if not url:
        raise HTTPException(status_code=400, detail="url is required")
    if not os.getenv("ELEVENLABS_API_KEY"):
        raise HTTPException(
            status_code=503,
            detail="ELEVENLABS_API_KEY not set; transcription unavailable",
        )
    from app.models.transcription import youtube_url_to_text

    # Run blocking download + transcription in a thread
    output_dir = "/tmp/transcribe"
    os.makedirs(output_dir, exist_ok=True)
    result = await asyncio.to_thread(
        youtube_url_to_text,
        url,
        output_dir,
    )
    if result is None:
        raise HTTPException(status_code=502, detail="Extraction or transcription failed")
    return result