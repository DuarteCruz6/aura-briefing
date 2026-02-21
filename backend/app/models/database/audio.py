from datetime import datetime
from sqlalchemy import DateTime, Float, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.database.base import Base


class Audio(Base):
    """TTS-generated podcast audio for a summary (Gemini TTS output)."""

    __tablename__ = "audio"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    summary_id: Mapped[int] = mapped_column(
        ForeignKey("summaries.id", ondelete="CASCADE"), nullable=False, unique=True, index=True
    )
    storage_path: Mapped[str] = mapped_column(String(1024), nullable=False)  # File path or object key
    url: Mapped[str | None] = mapped_column(String(2048), nullable=True)  # Public URL if served via CDN
    duration_seconds: Mapped[float | None] = mapped_column(Float, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    # Relationships
    summary: Mapped["Summary"] = relationship("Summary", back_populates="audio")
