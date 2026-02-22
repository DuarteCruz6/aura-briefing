"""
Fetch one recent X (Twitter) post per topic.
Uses Apify (scraper_one/x-posts-search) when APIFY_API_TOKEN is set; otherwise falls back to Nitter search RSS.
"""
from __future__ import annotations

from datetime import datetime, timezone
from urllib.parse import quote_plus

try:
    import feedparser
except ImportError:
    feedparser = None

try:
    import httpx
except ImportError:
    httpx = None

try:
    from app.config import settings
except Exception:
    settings = None

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; rv:109.0) Gecko/20100101 Firefox/119.0"
)

# Apify actor: X (Twitter) Posts Search – search by keyword/hashtag
APIFY_X_POSTS_SEARCH_ACTOR_ID = "scraper_one~x-posts-search"


def _get_nitter_base() -> str:
    base = (getattr(settings, "nitter_base_url", None) or "").strip().rstrip("/") if settings else ""
    return base or "https://nitter.net"


def _fetch_post_for_topic_apify(topic: str, api_token: str) -> tuple[dict | None, str | None]:
    """
    Fetch one recent X post for a topic via Apify (scraper_one/x-posts-search).
    Returns ({"url", "title", "published_at"} or None, error_message).
    """
    topic = (topic or "").strip()
    if not topic or not api_token:
        return (None, None)
    if httpx is None:
        return (None, "httpx not installed")
    api_url = (
        f"https://api.apify.com/v2/acts/{APIFY_X_POSTS_SEARCH_ACTOR_ID}/run-sync-get-dataset-items"
        f"?token={api_token}&timeout=60&limit=1"
    )
    payload = {"query": topic, "resultsCount": 1, "searchType": "latest"}
    try:
        with httpx.Client(timeout=75.0) as client:
            r = client.post(api_url, json=payload)
            r.raise_for_status()
            data = r.json()
    except httpx.HTTPStatusError as e:
        body = e.response.text
        if e.response.status_code == 401:
            return (None, "Apify API token invalid or missing (set APIFY_API_TOKEN)")
        if e.response.status_code in (400, 402, 408):
            return (None, f"Apify: {body[:200]}" if body else str(e))
        return (None, f"Apify returned {e.response.status_code}: {body[:200]}")
    except Exception as e:
        return (None, f"Apify request failed: {e}")

    if not isinstance(data, list) or len(data) == 0:
        return (None, None)
    item = data[0]
    url = item.get("postUrl") or item.get("url")
    if not url:
        return (None, None)
    title = (item.get("postText") or item.get("text") or "")[:500].strip() or None
    published = None
    ts = item.get("timestamp")
    if isinstance(ts, (int, float)):
        try:
            published = datetime.fromtimestamp(ts / 1000.0, tz=timezone.utc).isoformat()
        except Exception:
            published = str(ts)
    elif item.get("created_at"):
        published = item.get("created_at")
    return ({"url": url, "title": title or "", "published_at": published}, None)


def _fetch_post_for_topic_nitter(topic: str) -> tuple[dict | None, str | None]:
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


def fetch_post_for_topic(topic: str) -> tuple[dict | None, str | None]:
    """
    Fetch one recent X/Twitter post for a topic.
    Tries Apify first if APIFY_API_TOKEN is set; otherwise uses Nitter search RSS.
    Returns ({"url", "title", "published_at"} or None, error_message).
    """
    topic = (topic or "").strip()
    if not topic:
        return (None, None)
    token = (getattr(settings, "apify_api_token", None) or "").strip() if settings else ""
    if token:
        post, err = _fetch_post_for_topic_apify(topic, token)
        if err is None and post is not None:
            return (post, None)
        # Apify failed or no results; fall back to Nitter
    return _fetch_post_for_topic_nitter(topic)


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
