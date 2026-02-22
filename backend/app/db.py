from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, Session

from app.config import settings, get_database_path

# Ensure SQLite DB directory exists before creating engine
if settings.database_url.startswith("sqlite"):
    get_database_path()

engine = create_engine(
    settings.database_url,
    connect_args={"check_same_thread": False} if "sqlite" in settings.database_url else {},
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _add_cached_briefing_audio_transcript_if_missing():
    """Add transcript column to cached_briefing_audio if it does not exist (one-off migration)."""
    with engine.connect() as conn:
        dialect = engine.dialect.name
        if dialect == "postgresql":
            conn.execute(text("ALTER TABLE cached_briefing_audio ADD COLUMN IF NOT EXISTS transcript TEXT"))
        elif dialect == "sqlite":
            r = conn.execute(
                text("SELECT COUNT(*) FROM pragma_table_info('cached_briefing_audio') WHERE name = 'transcript'")
            ).scalar()
            if r == 0:
                conn.execute(text("ALTER TABLE cached_briefing_audio ADD COLUMN transcript TEXT"))
        conn.commit()


def init_db():
    from app.models.database import (  # noqa: F401 - register models
        Base,
        Bookmark,
        CachedBriefingAudio,
        ExtractedSummary,
        UserSetting,
        UserTopicPreference,
    )
    Base.metadata.create_all(bind=engine)
    _add_cached_briefing_audio_transcript_if_missing()
