import asyncio
import json
import logging
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
from sqlalchemy.orm import Session, joinedload

from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.db import engine, get_db, init_db
from app.models.database import (
    Bookmark,
    ExtractedSummary,
    FetchFrequency,
    Run,
    RunStatus,
    Source,
    SourceType,
    Summary,
    User,
    UserSetting,
    UserTopicPreference,
)

# Frontend static files (built and copied in Docker)
STATIC_DIR = Path(__file__).resolve().parent.parent / "static"

logger = logging.getLogger(__name__)


class TranscribeRequest(BaseModel):
    url: str


class MultiUrlRequest(BaseModel):
    urls: list[str]


class PodcastGenerateRequest(BaseModel):
    text: str
    voice_id: str | None = None
    model_id: str | None = None


class PodcastFromUrlsRequest(BaseModel):
    urls: list[str]
    voice_id: str | None = None
    model_id: str | None = None


class ChatMessage(BaseModel):
    role: str  # "user" | "assistant"
    content: str


class ChatRequest(BaseModel):
    messages: list[ChatMessage]


class VideoGenerateRequest(BaseModel):
    """Generate a video briefing: TTS from summary + simple visual (gradient + title). Premium only."""
    title: str
    summary: str
    topics: list[str] | None = None


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


class UserCreateRequest(BaseModel):
    """Create a new user (e.g. from OAuth or signup)."""
    google_id: str
    email: str
    name: str | None = None
    avatar_url: str | None = None


class AuthMeRequest(BaseModel):
    """Identify or create user by email (used by frontend signup)."""
    email: str
    name: str | None = None


class AuthLoginRequest(BaseModel):
    """Login: email only; user must already exist."""
    email: str


class SettingsUpdateRequest(BaseModel):
    """Update user settings (e.g. briefing_frequency, briefing_length, voice_style)."""
    briefing_frequency: str | None = None
    briefing_length: int | None = None  # minutes: 3, 7, 12
    voice_style: str | None = None  # professional, conversational, energetic, minimal


class BookmarkCreateRequest(BaseModel):
    """Create a bookmark (saved briefing card)."""
    title: str
    description: str | None = None
    duration: str | None = None
    topics: list[str] | None = None
    summary: str | None = None
    audio_url: str | None = None


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

# CORS: set CORS_ORIGINS to your frontend URL(s), or "*" to allow any origin (e.g. for demos).
_origins = [o.strip() for o in settings.cors_origins.split(",") if o.strip()]
_allow_any_origin = _origins == ["*"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=[] if _allow_any_origin else _origins,
    allow_origin_regex=".*" if _allow_any_origin else None,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_current_user_id(request: Request, db: Session = Depends(get_db)) -> int:
    """Resolve user from X-User-Email header; default to user_id=1 if missing (backward compat)."""
    raw = (request.headers.get("X-User-Email") or "").strip()
    if not raw:
        return 1
    email = raw.lower()  # match auth/me: users are stored with lowercased email
    user = db.query(User).filter(User.email == email).first()
    if user:
        return user.id
    return 1


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
def debug_table_contents(table_name: str, limit: int = 100, db: Session = Depends(get_db)):
    """
    Return the contents of a table as a list of rows (dicts).
    Table name is whitelisted. Use query param limit (default 100, max 1000).
    For user_topic_preferences, rows are enriched with user_email and user_name so you can see which user prefers what.
    """
    allowed = _get_table_names()
    if table_name not in allowed:
        raise HTTPException(
            status_code=404,
            detail=f"Unknown table. Allowed: {', '.join(allowed)}",
        )
    cap = min(max(1, limit), 1000)

    if table_name == "user_topic_preferences":
        # Enrich with user identity so the table shows which user prefers what
        prefs = (
            db.query(UserTopicPreference, User.email, User.name)
            .join(User, UserTopicPreference.user_id == User.id)
            .order_by(UserTopicPreference.created_at.desc())
            .limit(cap)
            .all()
        )
        rows = []
        for pref, email, name in prefs:
            row = {
                "id": pref.id,
                "user_id": pref.user_id,
                "user_email": email,
                "user_name": name,
                "topic": pref.topic,
                "created_at": pref.created_at.isoformat() if pref.created_at else None,
            }
            rows.append(row)
        return {"table": table_name, "limit": cap, "rows": rows}

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
    
    if not os.getenv("GEMINI_API_KEY"):
        raise HTTPException(
            status_code=503,
            detail="GEMINI_API_KEY not set; transcription unavailable",
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
    from app.services import get_or_extract_summary, _is_youtube_url

    if _is_youtube_url(url) and not os.getenv("GEMINI_API_KEY"):
        raise HTTPException(
            status_code=503,
            detail="GEMINI_API_KEY not set; YouTube transcription unavailable",
        )
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
    Get or extract content for each URL, generate a single ~3-minute text summary via Gemini,
    then convert it to podcast audio (Gemini TTS) and return the WAV file.
    Requires GEMINI_API_KEY.
    """
    from app.models.podcast_generation import text_to_audio
    from app.models.podcast_generation.tts_generator import (
        DEFAULT_MODEL_ID,
        DEFAULT_VOICE_ID,
    )
    from app.services.multi_url_summary import get_multi_url_summary

    if not body.urls:
        raise HTTPException(status_code=400, detail="urls must be a non-empty list")
    if not os.getenv("GEMINI_API_KEY"):
        raise HTTPException(
            status_code=503,
            detail="GEMINI_API_KEY not set; summary + podcast generation unavailable",
        )

    try:
        summary = await asyncio.to_thread(get_multi_url_summary, body.urls, db)
    except ValueError as e:
        raise HTTPException(status_code=503, detail=str(e))

    if not (summary or "").strip():
        raise HTTPException(status_code=503, detail="No summary generated")

    PODCAST_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    output_path = PODCAST_OUTPUT_DIR / f"{uuid.uuid4().hex}.wav"

    try:
        path_str, duration_seconds = await asyncio.to_thread(
            text_to_audio,
            summary,
            output_path,
            voice_id=DEFAULT_VOICE_ID,
            model_id=DEFAULT_MODEL_ID,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=str(e))

    return FileResponse(
        path_str,
        media_type="audio/wav",
        filename="podcast.wav",
        headers={
            "X-Duration-Seconds": str(duration_seconds) if duration_seconds is not None else "",
        },
    )


## ─── User CRUD ─────────────────────────────────────────────────────────────

@app.post("/users", status_code=201)
def create_user(body: UserCreateRequest, db: Session = Depends(get_db)):
    """Create a new user. Requires google_id and email (e.g. from OAuth or signup)."""
    google_id = (body.google_id or "").strip()
    email = (body.email or "").strip()
    if not google_id:
        raise HTTPException(status_code=400, detail="google_id is required")
    if not email:
        raise HTTPException(status_code=400, detail="email is required")

    existing = db.query(User).filter(User.google_id == google_id).first()
    if existing:
        raise HTTPException(
            status_code=409,
            detail="A user with this google_id already exists",
        )

    user = User(
        google_id=google_id,
        email=email,
        name=body.name.strip() if body.name else None,
        avatar_url=body.avatar_url.strip() if body.avatar_url else None,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return {
        "id": user.id,
        "google_id": user.google_id,
        "email": user.email,
        "name": user.name,
        "avatar_url": user.avatar_url,
        "created_at": user.created_at.isoformat() if user.created_at else None,
    }


@app.get("/users")
def list_users(db: Session = Depends(get_db)):
    """List all users (e.g. for admin or debugging)."""
    rows = db.query(User).order_by(User.created_at.desc()).all()
    return [
        {
            "id": u.id,
            "google_id": u.google_id,
            "email": u.email,
            "name": u.name,
            "avatar_url": u.avatar_url,
            "created_at": u.created_at.isoformat() if u.created_at else None,
        }
        for u in rows
    ]


@app.get("/users/{user_id}")
def get_user(user_id: int, db: Session = Depends(get_db)):
    """Get a single user by id."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {
        "id": user.id,
        "google_id": user.google_id,
        "email": user.email,
        "name": user.name,
        "avatar_url": user.avatar_url,
        "created_at": user.created_at.isoformat() if user.created_at else None,
        "updated_at": user.updated_at.isoformat() if user.updated_at else None,
    }


## ─── Auth ─────────────────────────────────────────────────────────────────

@app.options("/auth/login")
def auth_login_options(request: Request):
    """CORS preflight for POST /auth/login."""
    origin = request.headers.get("origin", "*")
    return JSONResponse(
        status_code=200,
        content={},
        headers={
            "Access-Control-Allow-Origin": origin,
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, X-User-Email",
            "Access-Control-Max-Age": "600",
        },
    )


@app.post("/auth/login")
def auth_login(body: AuthLoginRequest, db: Session = Depends(get_db)):
    """Log in: return user only if they exist. Does not create users. Use /auth/me for signup."""
    email = (body.email or "").strip().lower()
    if not email:
        raise HTTPException(status_code=400, detail="email is required")
    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(status_code=401, detail="No account found with this email. Sign up first.")
    return {
        "id": user.id,
        "email": user.email,
        "name": user.name,
        "created_at": user.created_at.isoformat() if user.created_at else None,
    }


@app.options("/auth/me")
def auth_me_options(request: Request):
    """CORS preflight for POST /auth/me."""
    origin = request.headers.get("origin", "*")
    return JSONResponse(
        status_code=200,
        content={},
        headers={
            "Access-Control-Allow-Origin": origin,
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, X-User-Email",
            "Access-Control-Max-Age": "600",
        },
    )


@app.post("/auth/me")
def auth_me(body: AuthMeRequest, db: Session = Depends(get_db)):
    """Get or create user by email. Frontend calls this after login/signup; use X-User-Email header on subsequent requests."""
    email = (body.email or "").strip().lower()
    if not email:
        raise HTTPException(status_code=400, detail="email is required")
    name = (body.name or "").strip() or None
    user = db.query(User).filter(User.email == email).first()
    if user:
        if name is not None and user.name != name:
            user.name = name
            db.commit()
            db.refresh(user)
        return {
            "id": user.id,
            "email": user.email,
            "name": user.name,
            "created_at": user.created_at.isoformat() if user.created_at else None,
        }
    # Create with email as google_id so we have a unique key
    user = User(google_id=email, email=email, name=name)
    db.add(user)
    db.commit()
    db.refresh(user)
    return {
        "id": user.id,
        "email": user.email,
        "name": user.name,
        "created_at": user.created_at.isoformat() if user.created_at else None,
    }


## ─── User settings ─────────────────────────────────────────────────────────

@app.get("/users/me/settings")
def get_my_settings(
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Get current user settings (briefing_frequency, briefing_length, voice_style)."""
    rows = db.query(UserSetting).filter(UserSetting.user_id == user_id).all()
    out = {"briefing_frequency": "daily", "briefing_length": "7", "voice_style": "professional"}
    for r in rows:
        out[r.key] = r.value
    return out


def _upsert_setting(db: Session, user_id: int, key: str, value: str) -> None:
    existing = (
        db.query(UserSetting)
        .filter(UserSetting.user_id == user_id, UserSetting.key == key)
        .first()
    )
    if existing:
        existing.value = value
    else:
        db.add(UserSetting(user_id=user_id, key=key, value=value))


@app.patch("/users/me/settings")
def update_my_settings(
    body: SettingsUpdateRequest,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Update current user settings."""
    if body.briefing_frequency is not None:
        val = (body.briefing_frequency or "").strip() or "daily"
        _upsert_setting(db, user_id, "briefing_frequency", val)
    if body.briefing_length is not None:
        val = str(int(body.briefing_length))
        _upsert_setting(db, user_id, "briefing_length", val)
    if body.voice_style is not None:
        val = (body.voice_style or "").strip() or "professional"
        _upsert_setting(db, user_id, "voice_style", val)
    db.commit()
    rows = db.query(UserSetting).filter(UserSetting.user_id == user_id).all()
    out = {"briefing_frequency": "daily", "briefing_length": "7", "voice_style": "professional"}
    for r in rows:
        out[r.key] = r.value
    return out


## ─── Bookmarks ────────────────────────────────────────────────────────────

@app.get("/bookmarks")
def list_bookmarks(
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """List current user's bookmarks (saved briefings)."""
    rows = (
        db.query(Bookmark)
        .filter(Bookmark.user_id == user_id)
        .order_by(Bookmark.created_at.desc())
        .all()
    )
    out = []
    for r in rows:
        topics = []
        if r.topics:
            try:
                topics = json.loads(r.topics)
            except Exception:
                pass
        out.append({
            "id": r.id,
            "title": r.title,
            "description": r.description,
            "duration": r.duration,
            "topics": topics,
            "summary": r.summary,
            "audio_url": r.audio_url,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        })
    return out


@app.post("/bookmarks", status_code=201)
def create_bookmark(
    body: BookmarkCreateRequest,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Create a bookmark (save a briefing card)."""
    title = (body.title or "").strip()
    if not title:
        raise HTTPException(status_code=400, detail="title is required")
    topics_json = json.dumps(body.topics or []) if body.topics is not None else None
    b = Bookmark(
        user_id=user_id,
        title=title,
        description=body.description,
        duration=body.duration,
        topics=topics_json,
        summary=body.summary,
        audio_url=body.audio_url,
    )
    db.add(b)
    db.commit()
    db.refresh(b)
    topics = body.topics or []
    return {
        "id": b.id,
        "title": b.title,
        "description": b.description,
        "duration": b.duration,
        "topics": topics,
        "summary": b.summary,
        "audio_url": b.audio_url,
        "created_at": b.created_at.isoformat() if b.created_at else None,
    }


@app.delete("/bookmarks/{bookmark_id}")
def delete_bookmark(
    bookmark_id: int,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Remove a bookmark."""
    b = db.query(Bookmark).filter(Bookmark.id == bookmark_id, Bookmark.user_id == user_id).first()
    if not b:
        raise HTTPException(status_code=404, detail="Bookmark not found")
    db.delete(b)
    db.commit()
    return {"deleted": True}


## ─── Source CRUD ───────────────────────────────────────────────────────────

@app.get("/sources")
def list_sources(
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
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
def create_source(
    body: SourceCreateRequest,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
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
def delete_source(
    source_id: int,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Remove a source."""
    source = db.query(Source).filter(Source.id == source_id, Source.user_id == user_id).first()
    if not source:
        raise HTTPException(status_code=404, detail="Source not found")
    db.delete(source)
    db.commit()
    return {"deleted": True}


@app.get("/sources/latest")
def get_sources_latest(
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """
    For each source the user follows, fetch the latest post / video / article URL.
    YouTube: latest video from channel. News/Podcast: latest item from RSS feed.
    LinkedIn/X: not supported yet (returns error per source).
    """
    from app.services.latest_from_sources import fetch_latest_for_sources

    sources = (
        db.query(Source)
        .filter(Source.user_id == user_id)
        .order_by(Source.created_at.desc())
        .all()
    )
    if not sources:
        return {"sources": [], "message": "No sources to fetch. Add sources first."}
    results = fetch_latest_for_sources(sources)
    return {"sources": results}


@app.get("/briefings")
def get_briefings(
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """
    Latest content from user's followed sources (same data as /sources/latest).
    Frontend can show these as briefing cards; when no sources, returns empty list.
    """
    from app.services.latest_from_sources import fetch_latest_for_sources

    sources = (
        db.query(Source)
        .filter(Source.user_id == user_id)
        .order_by(Source.created_at.desc())
        .all()
    )
    if not sources:
        return {"briefings": []}
    results = fetch_latest_for_sources(sources)
    # Shape for frontend: list of { title, url, source_type, source_url, published_at?, error? }
    briefings = []
    for r in results:
        latest = r.get("latest") or {}
        briefings.append({
            "id": r.get("source_id"),
            "title": latest.get("title") or "Latest update",
            "url": latest.get("url") or r.get("source_url"),
            "source_type": r.get("source_type"),
            "source_url": r.get("source_url"),
            "published_at": latest.get("published_at"),
            "error": r.get("error"),
        })
    return {"briefings": briefings}


@app.post("/chat")
def post_chat(
    body: ChatRequest,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """
    AI assistant chat using Gemini. Send conversation history; returns the assistant reply.
    Optional context: recent briefings from the user's sources are injected so the assistant
    can answer questions about "today's stories".
    """
    if not getattr(settings, "gemini_api_key", None) or not settings.gemini_api_key:
        raise HTTPException(
            status_code=503,
            detail="GEMINI_API_KEY is not set; AI assistant unavailable",
        )
    if not body.messages:
        raise HTTPException(status_code=400, detail="messages is required")
    last = body.messages[-1]
    if last.role != "user":
        raise HTTPException(status_code=400, detail="Last message must be from the user")

    # Load user (name)
    user = db.query(User).filter(User.id == user_id).first()
    user_name = (user.name or "").strip() or None if user else None

    # Load user's topic interests
    topic_prefs = (
        db.query(UserTopicPreference).filter(UserTopicPreference.user_id == user_id).all()
    )
    user_topics = [p.topic for p in topic_prefs if p.topic]

    # Load user's sources (people/channels they follow)
    sources = (
        db.query(Source)
        .filter(Source.user_id == user_id)
        .order_by(Source.created_at.desc())
        .all()
    )
    user_sources: list[dict] = [
        {"name": s.name or s.url, "url": s.url, "type": s.type.value}
        for s in sources
    ]

    # Newest briefcast: most recent Run that has a Summary (content stored in DB)
    latest_briefing_summary: str | None = None
    runs_with_summary = (
        db.query(Run)
        .options(joinedload(Run.summary))
        .filter(Run.user_id == user_id)
        .order_by(Run.started_at.desc())
        .limit(20)
        .all()
    )
    for run in runs_with_summary:
        if run.summary and (run.summary.content or "").strip():
            latest_briefing_summary = run.summary.content.strip()
            break

    # Recent briefings from sources (titles) for extra context
    context_briefings: list[dict] = []
    if sources:
        from app.services.latest_from_sources import fetch_latest_for_sources

        results = fetch_latest_for_sources(sources)
        for r in results:
            latest = r.get("latest") or {}
            context_briefings.append({
                "title": latest.get("title") or "Latest update",
                "error": r.get("error"),
            })

    messages = [{"role": m.role, "content": m.content or ""} for m in body.messages]
    try:
        from app.services.assistant_chat import chat as assistant_chat

        content = assistant_chat(
            messages,
            context_briefings=context_briefings,
            user_name=user_name,
            user_topics=user_topics,
            user_sources=user_sources,
            latest_briefing_summary=latest_briefing_summary,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return {"content": content}


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
    user_id: int = Depends(get_current_user_id),
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
def list_preference_sources(
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
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
    user_id: int = Depends(get_current_user_id),
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
def list_preference_topics(
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
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
    user_id: int = Depends(get_current_user_id),
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


@app.post("/briefing/generate")
async def generate_personal_briefing(
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
    max_per_topic: int = 1,
    hl: str = "en-US",
    gl: str = "US",
):
    """
    Generate a personal briefing by gathering URLs from sources and topics,
    then forwarding them to the /summaries/multi-url endpoint.
    """
    from app.services.feed_by_topics import fetch_articles_for_topic
    from app.services.latest_from_sources import fetch_latest_for_sources

    urls: list[str] = []

    # 1) Latest from followed accounts
    logger.info("Briefing: phase 1 - fetching latest from sources")
    sources = db.query(Source).filter(Source.user_id == user_id).order_by(Source.created_at.desc()).all()
    if sources:
        results = fetch_latest_for_sources(sources)
        for r in results:
            latest = r.get("latest")
            if latest and latest.get("url"):
                u = latest["url"].strip()
                if u and u not in urls:
                    urls.append(u)

    # 2) One article per topic interest
    logger.info("Briefing: phase 2 - fetching articles by topics")
    topics = [p.topic for p in db.query(UserTopicPreference).filter(UserTopicPreference.user_id == user_id).all()]
    if topics:
        per_topic = min(max(1, max_per_topic), 5)
        for topic in topics:
            topic = (topic or "").strip()
            if not topic:
                continue
            articles = fetch_articles_for_topic(topic, max_articles=5, hl=hl, gl=gl)
            for art in articles[:per_topic]:
                u = (art.get("url") or "").strip()
                if u and u not in urls:
                    urls.append(u)
                    break  # one per topic

    if not urls:
        raise HTTPException(
            status_code=400,
            detail="No content to summarize. Add followed sources and/or topic preferences.",
        )

    logger.info("Briefing: forwarding %s urls to multi-url summary", len(urls))
    
    # 3) Forward directly to your existing endpoint logic
    return await post_multi_url_summary(MultiUrlRequest(urls=urls), db)

@app.get("/feed/by-topics")
def get_feed_by_topics(
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
    max_per_topic: int = 5,
    hl: str = "en-US",
    gl: str = "US",
):
    """
    Get articles from Google News RSS based on the user's topic preferences (e.g. cars, ireland).
    Uses the free Google News RSS search - no API key needed.
    Each topic fetches recent articles from thousands of publishers.
    """
    from app.services.feed_by_topics import fetch_articles_by_topics

    topics = [
        p.topic
        for p in db.query(UserTopicPreference)
        .filter(UserTopicPreference.user_id == user_id)
        .order_by(UserTopicPreference.created_at.desc())
        .all()
    ]
    if not topics:
        return {"topics": [], "message": "Add topic preferences first (e.g. cars, ireland) via POST /preferences/topics"}
    max_per_topic = min(max(1, max_per_topic), 20)
    results = fetch_articles_by_topics(topics, max_per_topic=max_per_topic, hl=hl, gl=gl)
    return {"topics": results}


PODCAST_OUTPUT_DIR = Path("/tmp/podcast_audio")


def _normalize_voice_and_model(voice_id: str | None, model_id: str | None) -> tuple[str | None, str | None]:
    """Treat placeholder 'string' as unset."""
    v = voice_id if (voice_id and voice_id.strip().lower() != "string") else None
    m = model_id if (model_id and model_id.strip().lower() != "string") else None
    return v, m


@app.post("/podcast/generate-from-urls")
async def generate_podcast_from_urls(body: PodcastFromUrlsRequest, db: Session = Depends(get_db)):
    """
    Generate podcast audio from multiple URLs: fetch/summarize content from each URL,
    then turn the combined summary into speech via Gemini TTS. Returns a WAV file.
    Requires GEMINI_API_KEY.
    """
    from app.models.podcast_generation import text_to_audio
    from app.models.podcast_generation.tts_generator import (
        DEFAULT_MODEL_ID,
        DEFAULT_VOICE_ID,
    )
    from app.services.multi_url_summary import get_multi_url_summary

    if not body.urls:
        raise HTTPException(status_code=400, detail="urls must be a non-empty list")
    if not os.getenv("GEMINI_API_KEY"):
        raise HTTPException(
            status_code=503,
            detail="GEMINI_API_KEY not set; summary + podcast generation unavailable",
        )

    try:
        summary = await asyncio.to_thread(get_multi_url_summary, body.urls, db)
    except ValueError as e:
        raise HTTPException(status_code=503, detail=str(e))

    if not (summary or "").strip():
        raise HTTPException(status_code=503, detail="No summary generated")

    PODCAST_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    output_path = PODCAST_OUTPUT_DIR / f"{uuid.uuid4().hex}.wav"

    try:
        path_str, duration_seconds = await asyncio.to_thread(
            text_to_audio,
            summary,
            output_path,
            voice_id=DEFAULT_VOICE_ID,
            model_id=DEFAULT_MODEL_ID,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=str(e))

    return FileResponse(
        path_str,
        media_type="audio/wav",
        filename="podcast.wav",
        headers={
            "X-Duration-Seconds": str(duration_seconds) if duration_seconds is not None else "",
        },
    )


PODCAST_OUTPUT_DIR = Path("/tmp/podcast_audio")
VIDEO_OUTPUT_DIR = Path("/tmp/video_briefings")

# Header expected for premium-only video generation
PREMIUM_HEADER = "x-premium"


@app.post("/video/generate")
async def generate_video(
    body: VideoGenerateRequest,
    request: Request,
):
    """
    Generate a video briefing: TTS from summary + gradient frame with title.
    Premium only (requires header X-Premium: true). Returns MP4.
    """
    if request.headers.get(PREMIUM_HEADER, "").strip().lower() != "true":
        raise HTTPException(
            status_code=403,
            detail="Premium subscription required to generate video briefings",
        )
    if not os.getenv("GEMINI_API_KEY"):
        raise HTTPException(
            status_code=503,
            detail="GEMINI_API_KEY not set; video generation unavailable",
        )

    title = (body.title or "").strip()
    summary = (body.summary or "").strip()
    if not title:
        raise HTTPException(status_code=400, detail="title is required")
    if not summary:
        raise HTTPException(status_code=400, detail="summary is required")

    VIDEO_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    output_path = VIDEO_OUTPUT_DIR / f"{uuid.uuid4().hex}.mp4"

    try:
        from app.models.video_generation import build_briefing_video

        path_str = await asyncio.to_thread(
            build_briefing_video,
            title,
            summary,
            output_path,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=str(e))

    return FileResponse(
        path_str,
        media_type="video/mp4",
        filename="briefing.mp4",
    )


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