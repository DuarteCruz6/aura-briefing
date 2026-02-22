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
            data = r.json()
    except httpx.HTTPStatusError as e:
        err_detail = ""
        try:
            body = e.response.json()
            err_body = body.get("error") if isinstance(body, dict) else None
            if err_body:
                err_detail = err_body.get("message", "")
                errors = err_body.get("errors") or []
                if errors and isinstance(errors[0], dict):
                    reason = errors[0].get("reason", "")
                    if reason:
                        err_detail = f"{reason} - {err_detail}"
        except Exception:
            pass
        msg = err_detail or str(e.response.status_code)
        return ([], f"YouTube API error: {msg}")
    except Exception as e:
        return ([], f"YouTube API request failed: {e}")

    # Error in successful HTTP response body (e.g. quota, disabled API)
    err_body = data.get("error") if isinstance(data, dict) else None
    if err_body:
        msg = err_body.get("message", "Unknown API error")
        errors = err_body.get("errors") or []
        if errors and isinstance(errors[0], dict):
            reason = errors[0].get("reason", "")
            if reason:
                msg = f"{reason}: {msg}"
        return ([], f"YouTube API: {msg}")
    if r.status_code >= 400:
        return ([], f"YouTube API error: {r.status_code}")

    items = data.get("items") or []
    results = []
    for item in items:
        # Search list returns id: { kind: "youtube#video", videoId: "..." }
        vid = item.get("id") if isinstance(item.get("id"), dict) else {}
        video_id = (vid.get("videoId") or "").strip() if vid else None
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
) -> tuple[list[dict], str | None]:
    """
    Fetch recent videos for each topic. Returns (list of {topic, videos: [...]}, error_message).
    Deduplicates by URL across topics. Requires YOUTUBE_API_KEY.
    If any topic fails (e.g. API key missing, 403), returns first error so caller can surface it.
    """
    if not topics:
        return ([], None)
    result = []
    seen_urls: set[str] = set()
    first_error: str | None = None
    for topic in topics:
        topic = (topic or "").strip()
        if not topic:
            continue
        videos, err = fetch_videos_for_topic(topic, max_videos=max_per_topic)
        if err and first_error is None:
            first_error = err
        deduped = []
        for v in videos:
            u = (v.get("url") or "").strip()
            if u and u not in seen_urls:
                seen_urls.add(u)
                deduped.append(v)
        result.append({"topic": topic, "videos": deduped})
    return (result, first_error)
