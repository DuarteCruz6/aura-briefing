from sqlalchemy import create_engine, event, text
from sqlalchemy.orm import sessionmaker, Session

from app.config import settings, get_database_path

# Ensure SQLite DB directory exists before creating engine
if settings.database_url.startswith("sqlite"):
    get_database_path()

engine = create_engine(
    settings.database_url,
    connect_args={"check_same_thread": False} if "sqlite" in settings.database_url else {},
)

# SQLite: WAL mode allows concurrent reads while one writer is active, so /preferences/topics
# and other quick reads don't block behind long-running briefing generation.
# busy_timeout: wait up to 10s for lock instead of failing with "database is locked".
if "sqlite" in settings.database_url:

    @event.listens_for(engine, "connect")
    def _set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA busy_timeout=10000")
        cursor.close()

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
