from sqlalchemy import ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.database.base import Base


class RunItem(Base):
    """Association: which items were included in a given run (for one digest)."""

    __tablename__ = "run_items"
    __table_args__ = (UniqueConstraint("run_id", "item_id", name="uq_run_item"),)

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    run_id: Mapped[int] = mapped_column(ForeignKey("runs.id", ondelete="CASCADE"), nullable=False, index=True)
    item_id: Mapped[int] = mapped_column(ForeignKey("items.id", ondelete="CASCADE"), nullable=False, index=True)

    # Relationships
    run: Mapped["Run"] = relationship("Run", back_populates="run_items")
    item: Mapped["Item"] = relationship("Item", back_populates="run_items")
