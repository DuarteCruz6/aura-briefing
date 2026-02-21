"""
Fetch the latest post / video / article URL for each source a user follows.
Dispatches by source type: YouTube (channel → latest video), RSS (news/podcast → latest item),
LinkedIn/X return not_supported for now.
"""
from __future__ import annotations

from dataclasses import dataclass

from app.models.database.source import Source, SourceType


@dataclass
class LatestItem:
    url: str
    title: str | None
    published_at: str | None


@dataclass
class SourceLatestResult:
    source_id: int
    source_type: str
    source_url: str
    source_name: str | None
    latest: LatestItem | None
    error: str | None


def _is_rss_url(url: str) -> bool:
    url_lower = (url or "").strip().lower()
    return (
        "rss" in url_lower
        or "feed" in url_lower
        or url_lower.endswith(".xml")
        or "/feed/" in url_lower
    )


def _fetch_latest_from_rss(feed_url: str) -> tuple[LatestItem | None, str | None]:
    """Parse RSS/Atom feed and return latest entry link and title."""
    try:
        import feedparser
    except ImportError:
        return (None, "feedparser not installed")

    feed_url = (feed_url or "").strip()
    if not feed_url:
        return (None, "Feed URL is required")

    try:
        parsed = feedparser.parse(
            feed_url,
            request_headers={"User-Agent": "AuraBriefing/1.0"},
        )
    except Exception as e:
        return (None, f"Failed to fetch feed: {e}")

    entries = getattr(parsed, "entries", [])
    if not entries:
        return (None, "Feed has no entries")

    entry = entries[0]
    link = entry.get("link") or entry.get("href")
    if not link:
        return (None, "Latest entry has no link")
    title = entry.get("title") or None
    published = None
    for key in ("published", "updated", "created"):
        if key in entry and entry[key]:
            published = entry[key]
            break
    if hasattr(published, "isoformat"):
        published = published.isoformat()

    return (LatestItem(url=link, title=title, published_at=published), None)


def _fetch_latest_youtube(channel_url: str) -> tuple[LatestItem | None, str | None]:
    from app.models.scrapper.youtube_audio_extractor import get_latest_video_from_channel

    result, err = get_latest_video_from_channel(channel_url)
    if err:
        return (None, err)
    if not result:
        return (None, "No latest video")
    return (
        LatestItem(
            url=result["url"],
            title=result.get("title"),
            published_at=result.get("published_at"),
        ),
        None,
    )


def fetch_latest_for_source(source: Source) -> SourceLatestResult:
    """
    For a single Source, fetch the latest item URL (and optional title/published).
    Returns a SourceLatestResult with either latest or error set.
    """
    st = source.type
    url = (source.url or "").strip()

    if st == SourceType.YOUTUBE:
        # Channel URL → latest video
        latest, err = _fetch_latest_youtube(url)
        return SourceLatestResult(
            source_id=source.id,
            source_type=st.value,
            source_url=url,
            source_name=source.name,
            latest=latest,
            error=err,
        )

    if st == SourceType.NEWS or st == SourceType.PODCAST:
        # Treat as RSS if URL looks like a feed; otherwise we don't scrape arbitrary news homepages
        if _is_rss_url(url):
            latest, err = _fetch_latest_from_rss(url)
            return SourceLatestResult(
                source_id=source.id,
                source_type=st.value,
                source_url=url,
                source_name=source.name,
                latest=latest,
                error=err,
            )
        return SourceLatestResult(
            source_id=source.id,
            source_type=st.value,
            source_url=url,
            source_name=source.name,
            latest=None,
            error="News source URL should be an RSS/feed URL (e.g. .../feed or .../rss) to fetch latest article",
        )

    if st == SourceType.X or st == SourceType.LINKEDIN:
        return SourceLatestResult(
            source_id=source.id,
            source_type=st.value,
            source_url=url,
            source_name=source.name,
            latest=None,
            error="Latest post from X/LinkedIn not supported yet (API or scraping required)",
        )

    return SourceLatestResult(
        source_id=source.id,
        source_type=st.value,
        source_url=url,
        source_name=source.name,
        latest=None,
        error=f"Unsupported source type: {st.value}",
    )


def fetch_latest_for_sources(sources: list[Source]) -> list[dict]:
    """
    For each source, fetch latest item. Returns a list of dicts suitable for JSON response.
    """
    results = []
    for source in sources:
        r = fetch_latest_for_source(source)
        latest_dict = None
        if r.latest:
            latest_dict = {
                "url": r.latest.url,
                "title": r.latest.title,
                "published_at": r.latest.published_at,
            }
        results.append(
            {
                "source_id": r.source_id,
                "source_type": r.source_type,
                "source_url": r.source_url,
                "source_name": r.source_name,
                "latest": latest_dict,
                "error": r.error,
            }
        )
    return results
