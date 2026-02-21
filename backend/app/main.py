import asyncio
import json
import os
import traceback
import uuid
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
from app.models.database import (
    ExtractedSummary,
    FetchFrequency,
    Source,
    SourceType,
    UserTopicPreference,
)

# Frontend static files (built and copied in Docker)
STATIC_DIR = Path(__file__).resolve().parent.parent / "static"


class TranscribeRequest(BaseModel):
    url: str


class MultiUrlRequest(BaseModel):
    urls: list[str]


class PodcastGenerateRequest(BaseModel):
    text: str
    voice_id: str | None = None
    model_id: str | None = None


class SourceCreateRequest(BaseModel):
    type: str  # "youtube", "x", "linkedin", "news", "podcast"
    url: str
    name: str | None = None
    frequency: str = "daily"


class PreferenceSourceRequest(BaseModel):
    """Save a platform + URL as a user preference (stored in sources)."""
    platform: str  # "youtube", "linkedin", "twitter", "news"
    url: str


class PreferenceTopicRequest(BaseModel):
    """Add a general topic preference (not URL-based)."""
    topic: str


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(
    title=settings.app_name,
    lifespan=lifespan,
)


@app.get("/")
def root():
    """Root route for backend-only deploy (no static SPA)."""
    return {
        "service": settings.app_name,
        "docs": "/docs",
        "health": "/health",
        "tables": "/tables",
    }


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
    """Return list of user table names (SQLite: exclude sqlite_*; Postgres: public schema)."""
    dialect = engine.dialect.name
    with engine.connect() as conn:
        if dialect == "sqlite":
            result = conn.execute(
                text(
                    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
                )
            )
        else:
            result = conn.execute(
                text(
                    "SELECT table_name FROM information_schema.tables "
                    "WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name"
                )
            )
        return [row[0] for row in result]


def _quote_table(name: str) -> str:
    """Quote table name for raw SQL (SQLite: [...], Postgres: "...")."""
    if engine.dialect.name == "postgresql":
        return '"' + name.replace('"', '""') + '"'
    return "[" + name.replace("]", "]]") + "]"


@app.get("/tables")
def debug_tables():
    """List DB tables and row counts (handy for local/dev)."""
    tables = _get_table_names()
    out = {}
    with engine.connect() as conn:
        for name in tables:
            quoted = _quote_table(name)
            count = conn.execute(text(f"SELECT COUNT(*) FROM {quoted}")).scalar()
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
    quoted = _quote_table(table_name)
    with engine.connect() as conn:
        result = conn.execute(
            text(f"SELECT * FROM {quoted} LIMIT :cap"),
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
    Get summary for a YouTube URL: if already in DB return it; else fetch metadata + transcript
    via YouTube Data API and youtube-transcript-api, store, and return. No audio download.
    """
    url = (body.url or "").strip()
    if not url:
        raise HTTPException(status_code=400, detail="url is required")

    # Same table as text extractor: return if already computed
    row = db.query(ExtractedSummary).filter(ExtractedSummary.source_url == url).first()
    if row:
        return _parse_summary_json(row.summary_json)
    
    if not os.getenv("ELEVENLABS_API_KEY_TTS"):
        raise HTTPException(
            status_code=503,
            detail="ELEVENLABS_API_KEY_TTS not set; transcription unavailable",
        )

    if not os.getenv("ELEVENLABS_API_KEY_STT"):
        raise HTTPException(
            status_code=503,
            detail="ELEVENLABS_API_KEY_STT not set; transcription unavailable",
        )
    from app.models.transcription import youtube_url_to_text

    output_dir = "/tmp/transcribe"
    os.makedirs(output_dir, exist_ok=True)
    try:
        result = await asyncio.to_thread(
            youtube_url_to_text,
            url,
            output_dir,
        )
    except ValueError as e:
        raise HTTPException(status_code=502, detail=str(e))
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
    Single entry for any URL: YouTube or text (articles, X, LinkedIn, etc.).
    If in DB returns cached summary; else extracts (YouTube: metadata + transcript via YouTube API;
    text: fetch page → Gemini), saves, and returns. Response is the summary JSON (e.g. title, text, channel).
    """
    url = (body.url or "").strip()
    if not url:
        raise HTTPException(status_code=400, detail="url is required")
    from app.services import get_or_extract_summary

    if _is_youtube_url(url) and not os.getenv("ELEVENLABS_API_KEY_STT"):
        raise HTTPException(
            status_code=503,
            detail="ELEVENLABS_API_KEY_STT not set; YouTube transcription unavailable",
        )
    result = await asyncio.to_thread(get_or_extract_summary, url, db)
    try:
        result = await asyncio.to_thread(get_or_extract_summary, url, db)
    except ValueError as e:
        raise HTTPException(status_code=502, detail=str(e))
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


## ─── Source CRUD ───────────────────────────────────────────────────────────

@app.get("/sources")
def list_sources(user_id: int = 1, db: Session = Depends(get_db)):
    """List all sources for a user (default user_id=1 until auth is wired)."""
    rows = db.query(Source).filter(Source.user_id == user_id).order_by(Source.created_at.desc()).all()
    return [
        {
            "id": s.id,
            "type": s.type.value,
            "name": s.name,
            "url": s.url,
            "frequency": s.frequency.value,
            "created_at": s.created_at.isoformat() if s.created_at else None,
        }
        for s in rows
    ]


@app.post("/sources", status_code=201)
def create_source(body: SourceCreateRequest, user_id: int = 1, db: Session = Depends(get_db)):
    """Add a new source (YouTube channel, X profile, LinkedIn page, etc.)."""
    try:
        source_type = SourceType(body.type)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid type: {body.type}. Must be one of: {[t.value for t in SourceType]}")
    try:
        freq = FetchFrequency(body.frequency)
    except ValueError:
        freq = FetchFrequency.DAILY

    # Prevent duplicate URL for same user
    existing = db.query(Source).filter(Source.user_id == user_id, Source.url == body.url).first()
    if existing:
        raise HTTPException(status_code=409, detail="You're already following this source")

    source = Source(user_id=user_id, type=source_type, url=body.url, name=body.name, frequency=freq)
    db.add(source)
    db.commit()
    db.refresh(source)
    return {
        "id": source.id,
        "type": source.type.value,
        "name": source.name,
        "url": source.url,
        "frequency": source.frequency.value,
        "created_at": source.created_at.isoformat() if source.created_at else None,
    }


@app.delete("/sources/{source_id}")
def delete_source(source_id: int, user_id: int = 1, db: Session = Depends(get_db)):
    """Remove a source."""
    source = db.query(Source).filter(Source.id == source_id, Source.user_id == user_id).first()
    if not source:
        raise HTTPException(status_code=404, detail="Source not found")
    db.delete(source)
    db.commit()
    return {"deleted": True}


# Platform name from API -> SourceType
_PREFERENCE_PLATFORM_MAP = {
    "youtube": SourceType.YOUTUBE,
    "linkedin": SourceType.LINKEDIN,
    "twitter": SourceType.X,
    "news": SourceType.NEWS,
}


@app.post("/preferences/sources", status_code=201)
def add_preference_source(
    body: PreferenceSourceRequest,
    user_id: int = 1,
    db: Session = Depends(get_db),
):
    """
    Save a platform + URL as a user preference (account or site to follow).
    Allowed platforms: youtube, linkedin, twitter, news.
    Stored in the user's sources with default frequency daily.
    """
    platform_key = (body.platform or "").strip().lower()
    if platform_key not in _PREFERENCE_PLATFORM_MAP:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid platform: {body.platform}. Must be one of: youtube, linkedin, twitter, news",
        )
    url = (body.url or "").strip()
    if not url:
        raise HTTPException(status_code=400, detail="url is required")

    source_type = _PREFERENCE_PLATFORM_MAP[platform_key]
    existing = db.query(Source).filter(Source.user_id == user_id, Source.url == url).first()
    if existing:
        raise HTTPException(status_code=409, detail="This URL is already in your preferences")

    source = Source(
        user_id=user_id,
        type=source_type,
        url=url,
        name=None,
        frequency=FetchFrequency.DAILY,
    )
    db.add(source)
    db.commit()
    db.refresh(source)
    return {
        "id": source.id,
        "platform": source.type.value,
        "url": source.url,
        "created_at": source.created_at.isoformat() if source.created_at else None,
    }


@app.get("/preferences/sources")
def list_preference_sources(user_id: int = 1, db: Session = Depends(get_db)):
    """List all saved preference sources for the user (same as /sources but keyed as preferences)."""
    rows = (
        db.query(Source)
        .filter(Source.user_id == user_id)
        .order_by(Source.created_at.desc())
        .all()
    )
    return [
        {
            "id": s.id,
            "platform": s.type.value,
            "url": s.url,
            "name": s.name,
            "frequency": s.frequency.value,
            "created_at": s.created_at.isoformat() if s.created_at else None,
        }
        for s in rows
    ]


@app.post("/preferences/topics", status_code=201)
def add_preference_topic(
    body: PreferenceTopicRequest,
    user_id: int = 1,
    db: Session = Depends(get_db),
):
    """
    Add a general topic to the user's preferences (e.g. "AI", "startups", "climate").
    Not URL-based; stored in user_topic_preferences. Duplicate topics are ignored (409).
    """
    topic = (body.topic or "").strip()
    if not topic:
        raise HTTPException(status_code=400, detail="topic is required")

    existing = (
        db.query(UserTopicPreference)
        .filter(UserTopicPreference.user_id == user_id, UserTopicPreference.topic == topic)
        .first()
    )
    if existing:
        raise HTTPException(status_code=409, detail="This topic is already in your preferences")

    pref = UserTopicPreference(user_id=user_id, topic=topic)
    db.add(pref)
    db.commit()
    db.refresh(pref)
    return {
        "id": pref.id,
        "topic": pref.topic,
        "created_at": pref.created_at.isoformat() if pref.created_at else None,
    }


@app.get("/preferences/topics")
def list_preference_topics(user_id: int = 1, db: Session = Depends(get_db)):
    """List all topic preferences for the user."""
    rows = (
        db.query(UserTopicPreference)
        .filter(UserTopicPreference.user_id == user_id)
        .order_by(UserTopicPreference.created_at.desc())
        .all()
    )
    return [
        {
            "id": p.id,
            "topic": p.topic,
            "created_at": p.created_at.isoformat() if p.created_at else None,
        }
        for p in rows
    ]


@app.delete("/preferences/topics/{topic_id}")
def delete_preference_topic(
    topic_id: int,
    user_id: int = 1,
    db: Session = Depends(get_db),
):
    """Remove a topic from the user's preferences."""
    pref = (
        db.query(UserTopicPreference)
        .filter(UserTopicPreference.id == topic_id, UserTopicPreference.user_id == user_id)
        .first()
    )
    if not pref:
        raise HTTPException(status_code=404, detail="Topic preference not found")
    db.delete(pref)
    db.commit()
    return {"deleted": True}


PODCAST_OUTPUT_DIR = Path("/tmp/podcast_audio")


@app.post("/podcast/generate")
async def generate_podcast(body: PodcastGenerateRequest):
    """
    Generate podcast audio from script text using Gemini TTS.
    Returns a WAV file. Requires GEMINI_API_KEY.
    """
    if not os.getenv("GEMINI_API_KEY"):
        raise HTTPException(
            status_code=503,
            detail="GEMINI_API_KEY not set; podcast generation unavailable",
        )
    from app.models.podcast_generation import text_to_audio
    from app.models.podcast_generation.tts_generator import (
        DEFAULT_MODEL_ID,
        DEFAULT_VOICE_ID,
    )

    text = (body.text or "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="text is required and cannot be empty")

    PODCAST_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    output_path = PODCAST_OUTPUT_DIR / f"{uuid.uuid4().hex}.wav"

    # Treat placeholder "string" (e.g. from OpenAPI/Swagger) as unset
    voice_id = body.voice_id if (body.voice_id and body.voice_id.strip().lower() != "string") else None
    model_id = body.model_id if (body.model_id and body.model_id.strip().lower() != "string") else None

    try:
        path_str, duration_seconds = await asyncio.to_thread(
            text_to_audio,
            text,
            output_path,
            voice_id=voice_id or DEFAULT_VOICE_ID,
            model_id=model_id or DEFAULT_MODEL_ID,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=str(e))

    # Gemini TTS outputs WAV
    is_wav = path_str.lower().endswith(".wav")
    media_type = "audio/wav" if is_wav else "audio/mpeg"
    filename = "podcast.wav" if is_wav else "podcast.mp3"

    return FileResponse(
        path_str,
        media_type=media_type,
        filename=filename,
        headers={
            "X-Duration-Seconds": str(duration_seconds) if duration_seconds is not None else "",
        },
    )


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