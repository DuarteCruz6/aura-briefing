"""
Fetch recent YouTube videos from YouTube Data API v3 search based on topic keywords.
One video per topic, with a minimum view count. Uses the same topic preferences as the article feed.
Requires GOOGLE_API_KEY (YouTube Data API v3 uses the same key).
"""
from __future__ import annotations

import os
import httpx

try:
    from app.config import settings
except Exception:
    settings = None

# Minimum view count to consider a video "reasonable"; fallback to highest-viewed candidate if none pass
MIN_VIEWS_DEFAULT = 10000
# How many recent candidates to fetch before filtering by views
SEARCH_CANDIDATES = 15


def _get_youtube_api_key() -> str:
    key = os.getenv("YOUTUBE_API_KEY") or os.getenv("GOOGLE_API_KEY")
    if key:
        return key
    if settings:
        return getattr(settings, "youtube_api_key", "") or ""
    return ""


def _parse_int(s: str | None, default: int = 0) -> int:
    if s is None:
        return default
    try:
        return int(s)
    except (ValueError, TypeError):
        return default


def fetch_videos_for_topic(
    topic: str,
    min_views: int = MIN_VIEWS_DEFAULT,
) -> tuple[list[dict], str | None]:
    """
    Fetch one recent YouTube video for a topic with at least min_views.
    Returns (list of 0 or 1 item {url, title, published_at, channel_title, view_count}, error_message).
    If no video has enough views, returns the single most recent video.
    """
    topic = (topic or "").strip()
    if not topic:
        return ([], None)
    api_key = _get_youtube_api_key()
    if not api_key:
        return ([], "GOOGLE_API_KEY not set")
    url_search = "https://www.googleapis.com/youtube/v3/search"
    params = {
        "part": "snippet",
        "type": "video",
        "q": topic,
        "order": "date",
        "maxResults": min(SEARCH_CANDIDATES, 50),
        "key": api_key,
    }
    try:
        with httpx.Client(timeout=15.0) as client:
            r = client.get(url_search, params=params)
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
    video_ids = []
    id_to_snippet: dict[str, dict] = {}
    for item in items:
        vid = item.get("id") if isinstance(item.get("id"), dict) else {}
        video_id = (vid.get("videoId") or "").strip() if vid else None
        if not video_id:
            continue
        video_ids.append(video_id)
        id_to_snippet[video_id] = item.get("snippet") or {}
    if not video_ids:
        return ([], None)

    # Get view counts (videos.list allows up to 50 ids)
    url_videos = "https://www.googleapis.com/youtube/v3/videos"
    try:
        with httpx.Client(timeout=15.0) as client:
            r2 = client.get(
                url_videos,
                params={"part": "statistics", "id": ",".join(video_ids), "key": api_key},
            )
            data2 = r2.json()
    except Exception:
        # Fallback: return most recent without view count
        vid_id = video_ids[0]
        sn = id_to_snippet.get(vid_id) or {}
        return ([{
            "url": f"https://www.youtube.com/watch?v={vid_id}",
            "title": sn.get("title") or "",
            "published_at": sn.get("publishedAt") or "",
            "channel_title": sn.get("channelTitle") or "",
            "view_count": None,
        }], None)

    stats_by_id: dict[str, int] = {}
    for item in (data2.get("items") or []):
        vid = item.get("id")
        if not vid:
            continue
        stat = item.get("statistics") or {}
        stats_by_id[vid] = _parse_int(stat.get("viewCount"))

    # Pick first (most recent) with >= min_views; else pick the one with highest view count
    chosen = None
    for vid_id in video_ids:
        views = stats_by_id.get(vid_id, 0)
        if views >= min_views:
            sn = id_to_snippet.get(vid_id) or {}
            chosen = {
                "url": f"https://www.youtube.com/watch?v={vid_id}",
                "title": sn.get("title") or "",
                "published_at": sn.get("publishedAt") or "",
                "channel_title": sn.get("channelTitle") or "",
                "view_count": views,
            }
            break
    if chosen is None:
        vid_id = max(video_ids, key=lambda vid: stats_by_id.get(vid, 0))
        sn = id_to_snippet.get(vid_id) or {}
        chosen = {
            "url": f"https://www.youtube.com/watch?v={vid_id}",
            "title": sn.get("title") or "",
            "published_at": sn.get("publishedAt") or "",
            "channel_title": sn.get("channelTitle") or "",
            "view_count": stats_by_id.get(vid_id),
        }
    return ([chosen], None)


def fetch_single_best_video_by_topics(
    topics: list[str],
    min_views: int = MIN_VIEWS_DEFAULT,
) -> tuple[dict | None, str | None]:
    """
    Fetch one video per topic (recent, with at least min_views when possible), then return
    only the single video with the highest view count across all topics.
    Returns ({"topic": str, "video": {...}} or None, error_message).
    Requires GOOGLE_API_KEY.
    """
    if not topics:
        return (None, None)
    candidates: list[tuple[str, dict]] = []
    first_error: str | None = None
    for topic in topics:
        topic = (topic or "").strip()
        if not topic:
            continue
        videos, err = fetch_videos_for_topic(topic, min_views=min_views)
        if err and first_error is None:
            first_error = err
        if videos:
            candidates.append((topic, videos[0]))
    if not candidates:
        return (None, first_error)
    # Pick the one with highest view_count (treat None as 0)
    best_topic, best_video = max(
        candidates,
        key=lambda t_v: t_v[1].get("view_count") or 0,
    )
    return ({"topic": best_topic, "video": best_video}, first_error)
