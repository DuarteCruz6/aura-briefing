"""
Store summary JSON by the URL it was extracted from.
Not limited to YouTube; works for any source URL (podcast, article, etc.).
"""
from datetime import datetime
from sqlalchemy import DateTime, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.database.base import Base


class ExtractedSummary(Base):
    """
    One summary (as JSON) per source URL.
    Keyed by URL so you can look up or update the summary for a given video/article/etc.
    """

    __tablename__ = "extracted_summaries"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    source_url: Mapped[str] = mapped_column(
        String(2048), nullable=False, unique=True, index=True
    )
    summary_json: Mapped[str] = mapped_column(Text, nullable=False)  # JSON string
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow
    )
