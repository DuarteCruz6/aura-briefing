"""
Database models. ExtractedSummary is used by the summary API.
User, Source, Item, Run, RunItem, Summary, Audio are for future use (auth, scheduled runs, etc.).
"""
from app.models.database.base import Base
from app.models.database.user import User
from app.models.database.source import Source, SourceType, FetchFrequency
from app.models.database.item import Item
from app.models.database.run import Run, RunStatus
from app.models.database.run_item import RunItem
from app.models.database.summary import Summary
from app.models.database.audio import Audio
from app.models.database.extracted_summary import ExtractedSummary
from app.models.database.user_topic_preference import UserTopicPreference
from app.models.database.user_setting import UserSetting
from app.models.database.bookmark import Bookmark

__all__ = [
    "Base",
    "User",
    "Source",
    "SourceType",
    "FetchFrequency",
    "Item",
    "Run",
    "RunStatus",
    "RunItem",
    "Summary",
    "Audio",
    "ExtractedSummary",
    "UserTopicPreference",
    "UserSetting",
    "Bookmark",
]
