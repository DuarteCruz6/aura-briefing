from __future__ import annotations

from datetime import datetime
from sqlalchemy import DateTime, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.database.base import Base


class UserTopicPreference(Base):
    """A general topic preference for a user (not URL-based)."""

    __tablename__ = "user_topic_preferences"
    __table_args__ = (UniqueConstraint("user_id", "topic", name="uq_user_topic"),)

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    topic: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow
    )

    user: Mapped["User"] = relationship("User", back_populates="topic_preferences")
