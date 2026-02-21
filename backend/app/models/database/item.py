from datetime import datetime
from sqlalchemy import DateTime, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.database.base import Base


class Item(Base):
    """A single fetched piece of content (video, post, article, episode)."""

    __tablename__ = "items"
    __table_args__ = (UniqueConstraint("source_id", "external_id", name="uq_item_source_external_id"),)

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    source_id: Mapped[int] = mapped_column(ForeignKey("sources.id", ondelete="CASCADE"), nullable=False, index=True)
    external_id: Mapped[str] = mapped_column(String(512), nullable=False, index=True)  # Video ID, GUID, etc.
    title: Mapped[str] = mapped_column(String(1024), nullable=False)
    link: Mapped[str] = mapped_column(String(2048), nullable=False)
    content: Mapped[str | None] = mapped_column(Text, nullable=True)  # Description, transcript, or snippet for LLM
    published_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    # Relationships
    source: Mapped["Source"] = relationship("Source", back_populates="items")
    run_items: Mapped[list["RunItem"]] = relationship("RunItem", back_populates="item", cascade="all, delete-orphan")
