"""
Fetch one recent and popular X (Twitter) post per topic.
Tries Nitter search RSS first (free, often unavailable); falls back to Apify X search when APIFY_API_TOKEN is set.
"""
from __future__ import annotations

from urllib.parse import quote_plus

import httpx

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

# Apify actor: Search X By Keywords (paid per result; use when Nitter is down)
APIFY_X_SEARCH_ACTOR_ID = "watcher.data~search-x-by-keywords"


def _get_nitter_base() -> str:
    base = (getattr(settings, "nitter_base_url", None) or "").strip().rstrip("/") if settings else ""
    return base or "https://nitter.net"


def _get_apify_token() -> str:
    return (getattr(settings, "apify_api_token", None) or "").strip() if settings else ""


def _fetch_post_nitter(topic: str) -> tuple[dict | None, str | None]:
    """Try Nitter search RSS. Returns (post_dict or None, error or None)."""
    if feedparser is None:
        return (None, None)
    base = _get_nitter_base()
    q = quote_plus(topic)
    for path in (
        f"/search/rss?f=tweets&q={q}",
        f"/search/rss?q={q}",
    ):
        feed_url = f"{base}{path}"
        try:
            parsed = feedparser.parse(
                feed_url,
                request_headers={"User-Agent": USER_AGENT},
            )
        except Exception:
            continue
        entries = getattr(parsed, "entries", [])
        if not entries:
            continue
        entry = entries[0]
        link = entry.get("link") or entry.get("href")
        if not link:
            continue
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
        return ({"url": link, "title": title, "published_at": published}, None)
    return (None, None)


def _fetch_post_apify(topic: str, api_token: str) -> tuple[dict | None, str | None]:
    """Fetch one popular X post for topic via Apify (Search X By Keywords). Returns (post_dict or None, error or None)."""
    api_url = f"https://api.apify.com/v2/acts/{APIFY_X_SEARCH_ACTOR_ID}/run-sync-get-dataset-items"
    params = {"token": api_token, "timeout": 90}
    payload = {
        "searchType": "tweets",
        "keywords": [topic],
        "maxItemsPerKeyword": 1,
        "sortBy": "popular",
    }
    try:
        with httpx.Client(timeout=95.0) as client:
            r = client.post(api_url, params=params, json=payload)
            r.raise_for_status()
            data = r.json()
    except httpx.HTTPStatusError as e:
        body = (e.response.text or "")[:300]
        if e.response.status_code == 401:
            return (None, "Apify API token invalid (check APIFY_API_TOKEN)")
        return (None, f"Apify X search: {e.response.status_code} {body}")
    except Exception as e:
        return (None, f"Apify X search failed: {e}")
    if not isinstance(data, list) or len(data) == 0:
        return (None, None)
    item = data[0]
    url = item.get("url") or ""
    if not url:
        return (None, None)
    title = (item.get("text") or "").strip() or ""
    published = item.get("created_at")
    if published is not None:
        published = str(published)
    return ({"url": url, "title": title, "published_at": published}, None)


def fetch_post_for_topic(topic: str) -> tuple[dict | None, str | None]:
    """
    Fetch one recent/popular X post for a topic. Tries Nitter first; if null, uses Apify when APIFY_API_TOKEN is set.
    Returns ({"url", "title", "published_at"} or None, error_message).
    """
    topic = (topic or "").strip()
    if not topic:
        return (None, None)
    post, err = _fetch_post_nitter(topic)
    if post is not None:
        return (post, None)
    token = _get_apify_token()
    if token:
        post, err = _fetch_post_apify(topic, token)
        if post is not None:
            return (post, None)
    return (None, err)


def fetch_posts_by_topics(topics: list[str]) -> tuple[list[dict], str | None]:
    """
    Fetch one recent/popular X post per topic. Returns (list of {topic, post}, error_message).
    When Nitter returns nothing, uses Apify if APIFY_API_TOKEN is set (pay-per-result).
    """
    if not topics:
        return ([], None)
    result = []
    first_error: str | None = None
    for topic in topics:
        topic = (topic or "").strip()
        if not topic:
            continue
        post, err = fetch_post_for_topic(topic)
        if err and first_error is None:
            first_error = err
        result.append({"topic": topic, "post": post})
    return (result, first_error)
