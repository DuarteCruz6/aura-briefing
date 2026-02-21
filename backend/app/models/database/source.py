import enum
from datetime import datetime
from sqlalchemy import DateTime, Enum, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.database.base import Base


class SourceType(str, enum.Enum):
    YOUTUBE = "youtube"
    X = "x"
    LINKEDIN = "linkedin"
    NEWS = "news"
    PODCAST = "podcast"


class FetchFrequency(str, enum.Enum):
    DAILY = "daily"
    EVERY_3_DAYS = "every_3_days"
    WEEKLY = "weekly"
    BIWEEKLY = "biweekly"
    MANUAL = "manual"


class Source(Base):
    """A single tracked source (channel, profile, feed, etc.) belonging to a user."""

    __tablename__ = "sources"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    type: Mapped[SourceType] = mapped_column(Enum(SourceType), nullable=False, index=True)
    name: Mapped[str | None] = mapped_column(String(255), nullable=True)  # User-defined label
    url: Mapped[str] = mapped_column(String(2048), nullable=False)  # Channel URL, RSS URL, profile URL, etc.
    frequency: Mapped[FetchFrequency] = mapped_column(
        Enum(FetchFrequency), nullable=False, default=FetchFrequency.DAILY
    )
    last_fetched_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow
    )

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="sources")
    items: Mapped[list["Item"]] = relationship(
        "Item", back_populates="source", cascade="all, delete-orphan"
    )
