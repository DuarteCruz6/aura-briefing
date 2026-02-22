"""Cache for generated briefing audio so we don't regenerate on every play."""
from datetime import datetime
from sqlalchemy import DateTime, Float, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.database.base import Base


class CachedBriefingAudio(Base):
    """
    Stores generated briefing audio per user and cache key.
    - Personal briefing: cache_key = "personal"
    - Per-URL briefing: cache_key = "urls:" + stable hash of sorted URLs
    """

    __tablename__ = "cached_briefing_audio"
    __table_args__ = (UniqueConstraint("user_id", "cache_key", name="uq_cached_briefing_audio_user_key"),)

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    cache_key: Mapped[str] = mapped_column(String(512), nullable=False, index=True)
    storage_path: Mapped[str] = mapped_column(String(1024), nullable=False)
    duration_seconds: Mapped[float | None] = mapped_column(Float, nullable=True)
    transcript: Mapped[str | None] = mapped_column(Text, nullable=True)  # Script read for TTS
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    user: Mapped["User"] = relationship("User", back_populates="cached_briefing_audios")
