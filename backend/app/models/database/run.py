import enum
from datetime import datetime
from sqlalchemy import DateTime, Enum, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.database.base import Base


class RunStatus(str, enum.Enum):
    PENDING = "pending"
    FETCHING = "fetching"
    SUMMARIZING = "summarizing"
    GENERATING_AUDIO = "generating_audio"
    COMPLETED = "completed"
    FAILED = "failed"


class Run(Base):
    """One digest run: fetch new items for a user, then summarize and generate TTS."""

    __tablename__ = "runs"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    status: Mapped[RunStatus] = mapped_column(
        Enum(RunStatus), nullable=False, default=RunStatus.PENDING, index=True
    )
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    error_message: Mapped[str | None] = mapped_column(String(1024), nullable=True)

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="runs")
    run_items: Mapped[list["RunItem"]] = relationship(
        "RunItem", back_populates="run", cascade="all, delete-orphan"
    )
    summary: Mapped["Summary | None"] = relationship(
        "Summary", back_populates="run", uselist=False, cascade="all, delete-orphan"
    )
