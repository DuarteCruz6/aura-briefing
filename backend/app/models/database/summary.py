from datetime import datetime
from sqlalchemy import DateTime, ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.database.base import Base


class Summary(Base):
    """Generated summary text for a run (input for TTS)."""

    __tablename__ = "summaries"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    run_id: Mapped[int] = mapped_column(
        ForeignKey("runs.id", ondelete="CASCADE"), nullable=False, unique=True, index=True
    )
    content: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    # Relationships
    run: Mapped["Run"] = relationship("Run", back_populates="summary")
    audio: Mapped["Audio | None"] = relationship(
        "Audio", back_populates="summary", uselist=False, cascade="all, delete-orphan"
    )
