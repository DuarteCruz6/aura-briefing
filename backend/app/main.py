import asyncio
import json
import os
from pathlib import Path

from contextlib import asynccontextmanager
from starlette.responses import FileResponse
from starlette.staticfiles import StaticFiles

from fastapi import Depends, FastAPI, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session

from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.db import engine, get_db, init_db
from app.models.database import ExtractedSummary

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

# CORS so frontend (e.g. Vite on port 8080) can call the API
origins = [o.strip() for o in settings.cors_origins.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


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
async def transcribe_youtube(body: TranscribeRequest, db: Session = Depends(get_db)):
    """
    Download audio from a YouTube URL, transcribe (ElevenLabs STT), and store
    the summary JSON in the database keyed by URL.
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

    # Store summary JSON by URL (upsert: update if same URL already exists)
    summary_json = json.dumps(result, ensure_ascii=False)
    existing = db.query(ExtractedSummary).filter(ExtractedSummary.source_url == url).first()
    if existing:
        existing.summary_json = summary_json
    else:
        db.add(ExtractedSummary(source_url=url, summary_json=summary_json))
    db.commit()

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


@app.get("/summaries/by-url")
def get_summary_by_url(url: str, db: Session = Depends(get_db)):
    """
    Get stored summary JSON for a given source URL (YouTube, podcast, article, etc.).
    Returns 404 if no summary exists for that URL.
    """
    row = db.query(ExtractedSummary).filter(ExtractedSummary.source_url == url).first()
    if not row:
        raise HTTPException(status_code=404, detail="No summary found for this URL")
    return {"source_url": row.source_url, "summary": json.loads(row.summary_json)}


@app.post("/summaries/get-or-extract")
async def post_get_or_extract_summary(body: TranscribeRequest, db: Session = Depends(get_db)):
    """
    Get summary for a URL: if already in the DB return it; otherwise extract (YouTube
    via existing transcription, other URLs via placeholder), save, and return.
    YouTube requires ELEVENLABS_API_KEY. Returns 502 if extraction fails.
    """
    url = (body.url or "").strip()
    if not url:
        raise HTTPException(status_code=400, detail="url is required")
    from app.services import get_or_extract_summary, _is_youtube_url

    if _is_youtube_url(url) and not os.getenv("ELEVENLABS_API_KEY"):
        raise HTTPException(
            status_code=503,
            detail="ELEVENLABS_API_KEY not set; YouTube transcription unavailable",
        )
    result = await asyncio.to_thread(get_or_extract_summary, url, db)
    if result is None:
        raise HTTPException(
            status_code=502,
            detail="Extraction failed or URL type not supported yet",
        )
    return {"source_url": url, "summary": result}