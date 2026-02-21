from collections.abc import Generator
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.config import get_database_path, settings
from app.models.database.base import Base


def get_engine():
    """Create engine; for SQLite, ensure path exists and use check_same_thread=False for FastAPI."""
    url = settings.database_url
    connect_args = {}
    if url.startswith("sqlite"):
        get_database_path()
        connect_args["check_same_thread"] = False
    return create_engine(url, connect_args=connect_args, echo=settings.environment == "development")


engine = get_engine()
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def init_db() -> None:
    """Create all tables. Safe to call on startup (existing tables are left as-is)."""
    Base.metadata.create_all(bind=engine)


def get_db() -> Generator[Session, None, None]:
    """Dependency that yields a DB session and closes it after the request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
