from sqlalchemy import create_engine
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


def init_db():
    from app.models.database import Base, ExtractedSummary  # noqa: F401 - register model

    Base.metadata.create_all(bind=engine)
