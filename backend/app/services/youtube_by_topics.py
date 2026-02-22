"""
Fetch recent YouTube videos from YouTube Data API v3 search based on topic keywords.
Uses the same topic preferences as the article feed (e.g. cars, ireland).
Requires YOUTUBE_API_KEY.
"""
from __future__ import annotations

import os
import httpx

try:
    from app.config import settings
except Exception:
    settings = None


def _get_youtube_api_key() -> str:
    key = os.getenv("YOUTUBE_API_KEY") or os.getenv("GOOGLE_API_KEY")
    if key:
        return key
    if settings:
        return getattr(settings, "youtube_api_key", "") or ""
    return ""


def fetch_videos_for_topic(
    topic: str,
    max_videos: int = 5,
) -> tuple[list[dict], str | None]:
    """
    Fetch recent YouTube videos for a single topic via search API.
    Returns (list of {url, title, published_at, channel_title}, error_message).
    If API key is missing or request fails, returns ([], error_message).
    """
    topic = (topic or "").strip()
    if not topic:
        return ([], None)
    api_key = _get_youtube_api_key()
    if not api_key:
        return ([], "YOUTUBE_API_KEY not set")
    max_videos = min(max(1, max_videos), 25)
    url = "https://www.googleapis.com/youtube/v3/search"
    params = {
        "part": "snippet",
        "type": "video",
        "q": topic,
        "order": "date",
        "maxResults": max_videos,
        "key": api_key,
    }
    try:
        with httpx.Client(timeout=15.0) as client:
            r = client.get(url, params=params)
            r.raise_for_status()
            data = r.json()
    except httpx.HTTPStatusError as e:
        return ([], f"YouTube API error: {e.response.status_code}")
    except Exception as e:
        return ([], f"YouTube API request failed: {e}")
    items = data.get("items") or []
    results = []
    for item in items:
        vid = item.get("id") or {}
        video_id = vid.get("videoId")
        if not video_id:
            continue
        snippet = item.get("snippet") or {}
        results.append({
            "url": f"https://www.youtube.com/watch?v={video_id}",
            "title": snippet.get("title") or "",
            "published_at": snippet.get("publishedAt") or "",
            "channel_title": snippet.get("channelTitle") or "",
        })
    return (results, None)


def fetch_videos_by_topics(
    topics: list[str],
    max_per_topic: int = 5,
) -> list[dict]:
    """
    Fetch recent videos for each topic. Returns list of {topic, videos: [{url, title, published_at, channel_title}]}.
    Deduplicates by URL across topics. Requires YOUTUBE_API_KEY.
    """
    if not topics:
        return []
    result = []
    seen_urls: set[str] = set()
    for topic in topics:
        topic = (topic or "").strip()
        if not topic:
            continue
        videos, _ = fetch_videos_for_topic(topic, max_videos=max_per_topic)
        deduped = []
        for v in videos:
            u = (v.get("url") or "").strip()
            if u and u not in seen_urls:
                seen_urls.add(u)
                deduped.append(v)
        result.append({"topic": topic, "videos": deduped})
    return result
