"""
Fetch one recent X (Twitter) post per topic via Nitter search RSS.
Uses the same topic preferences as the article feed. No API key; requires a working Nitter instance (NITTER_BASE_URL).
"""
from __future__ import annotations

from urllib.parse import quote_plus

try:
    import feedparser
except ImportError:
    feedparser = None

try:
    from app.config import settings
except Exception:
    settings = None

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; rv:109.0) Gecko/20100101 Firefox/119.0"
)


def _get_nitter_base() -> str:
    base = (getattr(settings, "nitter_base_url", None) or "").strip().rstrip("/") if settings else ""
    return base or "https://nitter.net"


def fetch_post_for_topic(topic: str) -> tuple[dict | None, str | None]:
    """
    Fetch one recent X/Twitter post for a topic via Nitter search RSS.
    Returns ({"url", "title", "published_at"} or None, error_message).
    """
    topic = (topic or "").strip()
    if not topic:
        return (None, None)
    if feedparser is None:
        return (None, "feedparser not installed")
    base = _get_nitter_base()
    q = quote_plus(topic)
    # Nitter search RSS: /search/rss?f=tweets&q=...
    feed_url = f"{base}/search/rss?f=tweets&q={q}"
    try:
        parsed = feedparser.parse(
            feed_url,
            request_headers={"User-Agent": USER_AGENT},
        )
    except Exception as e:
        return (None, f"Nitter search failed: {e}")
    entries = getattr(parsed, "entries", [])
    if not entries:
        return (None, None)
    entry = entries[0]
    link = entry.get("link") or entry.get("href")
    if not link:
        return (None, None)
    title = entry.get("title") or ""
    published = None
    for key in ("published", "updated", "created"):
        if key in entry and entry[key]:
            published = entry[key]
            break
    if hasattr(published, "isoformat"):
        published = published.isoformat()
    elif published is not None:
        published = str(published)
    return (
        {"url": link, "title": title, "published_at": published},
        None,
    )


def fetch_posts_by_topics(topics: list[str]) -> list[dict]:
    """
    Fetch one recent X post per topic. Returns list of {topic, post: {url, title, published_at}}.
    Skips topics that return no post; no error surface (Nitter may be down or search RSS disabled).
    """
    if not topics:
        return []
    result = []
    for topic in topics:
        topic = (topic or "").strip()
        if not topic:
            continue
        post, _ = fetch_post_for_topic(topic)
        result.append({"topic": topic, "post": post})
    return result
