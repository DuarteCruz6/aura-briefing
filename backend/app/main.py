import asyncio
import json
import os
import traceback
from pathlib import Path

from contextlib import asynccontextmanager
from starlette.responses import FileResponse, JSONResponse
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


class MultiUrlRequest(BaseModel):
    urls: list[str]


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


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    """Return 500 with error details so we can debug (always include detail in body)."""
    tb = traceback.format_exc()
    return JSONResponse(
        status_code=500,
        content={
            "detail": str(exc),
            "type": type(exc).__name__,
            "traceback": tb if settings.environment == "development" else None,
        },
    )


def _get_table_names():
    """Return list of user table names (no sqlite_*)."""
    with engine.connect() as conn:
        result = conn.execute(
            text(
                "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
            )
        )
        return [row[0] for row in result]


@app.get("/tables")
def debug_tables():
    """List DB tables and row counts (handy for local/dev)."""
    tables = _get_table_names()
    out = {}
    with engine.connect() as conn:
        for name in tables:
            count = conn.execute(text(f"SELECT COUNT(*) FROM [{name}]")).scalar()
            out[name] = count
    return {"tables": out}


@app.get("/tables/{table_name}")
def debug_table_contents(table_name: str, limit: int = 100):
    """
    Return the contents of a table as a list of rows (dicts).
    Table name is whitelisted. Use query param limit (default 100, max 1000).
    """
    allowed = _get_table_names()
    if table_name not in allowed:
        raise HTTPException(
            status_code=404,
            detail=f"Unknown table. Allowed: {', '.join(allowed)}",
        )
    cap = min(max(1, limit), 1000)
    with engine.connect() as conn:
        result = conn.execute(
            text(f"SELECT * FROM [{table_name}] LIMIT :cap"),
            {"cap": cap},
        )
        keys = result.keys()
        rows = [dict(zip(keys, row)) for row in result]
    # Make values JSON-serializable (e.g. datetime -> isoformat)
    for row in rows:
        for k, v in row.items():
            if hasattr(v, "isoformat"):
                row[k] = v.isoformat()
    return {"table": table_name, "limit": cap, "rows": rows}


@app.post("/transcribe")
async def transcribe_youtube(body: TranscribeRequest, db: Session = Depends(get_db)):
    """
    Get summary for a YouTube URL: if already in the DB (same table as text URLs),
    return it; otherwise download, transcribe (ElevenLabs STT), store, and return.
    Requires ELEVENLABS_API_KEY in env for first-time extraction.
    """
    url = (body.url or "").strip()
    if not url:
        raise HTTPException(status_code=400, detail="url is required")

    # Same table as text extractor: return if already computed
    row = db.query(ExtractedSummary).filter(ExtractedSummary.source_url == url).first()
    if row:
        return _parse_summary_json(row.summary_json)

    if not os.getenv("ELEVENLABS_API_KEY"):
        raise HTTPException(
            status_code=503,
            detail="ELEVENLABS_API_KEY not set; transcription unavailable",
        )
    from app.models.transcription import youtube_url_to_text

    output_dir = "/tmp/transcribe"
    os.makedirs(output_dir, exist_ok=True)
    result = await asyncio.to_thread(
        youtube_url_to_text,
        url,
        output_dir,
    )
    if result is None:
        raise HTTPException(status_code=502, detail="Extraction or transcription failed")

    summary_json = json.dumps(result, ensure_ascii=False)
    db.add(ExtractedSummary(source_url=url, summary_json=summary_json))
    db.commit()

    return result


def _parse_summary_json(raw: str):
    """Parse stored summary JSON; raise HTTPException if invalid."""
    try:
        return json.loads(raw)
    except (json.JSONDecodeError, TypeError) as e:
        raise HTTPException(
            status_code=500,
            detail=f"Stored summary is invalid JSON: {e!s}",
        ) from e


@app.get("/summaries/by-url")
def get_summary_by_url(url: str, db: Session = Depends(get_db)):
    """
    Get stored summary for a given source URL. Returns only the summary object (no wrapper).
    404 if no summary exists.
    """
    row = db.query(ExtractedSummary).filter(ExtractedSummary.source_url == url).first()
    if not row:
        raise HTTPException(status_code=404, detail="No summary found for this URL")
    return _parse_summary_json(row.summary_json)


@app.post("/summaries/get-or-extract")
async def post_get_or_extract_summary(body: TranscribeRequest, db: Session = Depends(get_db)):
    """
    Get summary for a URL: if in DB return it; else extract (YouTube or text), save, return.
    Returns only the summary object (no wrapper).
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
    return result


@app.post("/summaries/multi-url")
async def post_multi_url_summary(body: MultiUrlRequest, db: Session = Depends(get_db)):
    """
    Get or extract content for each URL (same as get-or-extract per URL), then generate
    a single ~3-minute text summary of all content via Gemini.
    """
    from app.services.multi_url_summary import get_multi_url_summary

    if not body.urls:
        raise HTTPException(status_code=400, detail="urls must be a non-empty list")
    try:
        summary = await asyncio.to_thread(get_multi_url_summary, body.urls, db)
    except ValueError as e:
        raise HTTPException(status_code=503, detail=str(e))
    return {"summary": summary}


# Serve frontend static files when running in Docker (static dir present).
# Must be last so API routes (e.g. /summaries/by-url) are matched first.
if STATIC_DIR.is_dir():
    app.mount("/assets", StaticFiles(directory=STATIC_DIR / "assets"), name="assets")

    @app.get("/{full_path:path}")
    def serve_spa(full_path: str, request: Request):
        """Serve index.html for non-API GET requests (SPA fallback)."""
        if request.method != "GET":
            raise HTTPException(status_code=404, detail="Not found")
        path = STATIC_DIR / full_path
        if path.is_file():
            return FileResponse(path)
        return FileResponse(STATIC_DIR / "index.html")