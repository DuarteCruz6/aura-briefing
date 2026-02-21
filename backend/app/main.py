import asyncio
import os
from pathlib import Path

from contextlib import asynccontextmanager
from starlette.responses import FileResponse
from starlette.staticfiles import StaticFiles

from fastapi import FastAPI, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import text

from app.config import settings
from app.db import engine, init_db

# Frontend static files (built and copied in Docker)
STATIC_DIR = Path(__file__).resolve().parent.parent / "static"


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


# Serve frontend static files when running in Docker (static dir present)
if STATIC_DIR.is_dir():
    app.mount("/assets", StaticFiles(directory=STATIC_DIR / "assets"), name="assets")

    @app.get("/{full_path:path}")
    def serve_spa(full_path: str, request: Request):
        """Serve index.html for non-API GET requests (SPA fallback)."""
        if request.method != "GET":
            raise HTTPException(status_code=404, detail="Not found")
        # If it looks like a static file, try to serve it (e.g. favicon, source maps)
        path = STATIC_DIR / full_path
        if path.is_file():
            return FileResponse(path)
        return FileResponse(STATIC_DIR / "index.html")