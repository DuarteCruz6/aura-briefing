#!/usr/bin/env python3
"""
YouTube metadata + transcript via YouTube Data API v3 and youtube-transcript-api.
No yt-dlp or FFmpeg. Requires YOUTUBE_API_KEY for metadata; transcript needs no key.

Import: from app.models.scrapper.youtube_audio_extractor import extract_audio
CLI: python -m app.models.scrapper.youtube_audio_extractor <youtube_url>
"""

import json
import os
import re
import sys

import httpx


def _video_id_from_url(url: str) -> str | None:
    """Extract YouTube video ID from common URL forms."""
    url = (url or "").strip()
    if not url:
        return None
    # youtube.com/watch?v=ID, youtube.com/v/ID, youtu.be/ID, youtube.com/embed/ID
    patterns = [
        r"(?:youtube\.com/watch\?v=)([a-zA-Z0-9_-]{11})",
        r"(?:youtube\.com/v/)([a-zA-Z0-9_-]{11})",
        r"(?:youtube\.com/embed/)([a-zA-Z0-9_-]{11})",
        r"(?:youtu\.be/)([a-zA-Z0-9_-]{11})",
    ]
    for p in patterns:
        m = re.search(p, url)
        if m:
            return m.group(1)
    return None


def _get_youtube_api_key() -> str:
    key = os.getenv("YOUTUBE_API_KEY") or os.getenv("GOOGLE_API_KEY")
    if key:
        return key
    try:
        from app.config import settings
        return getattr(settings, "youtube_api_key", "") or ""
    except Exception:
        return ""


def _fetch_metadata(video_id: str, api_key: str) -> dict | None:
    """Fetch video snippet (title, description, channelTitle) from YouTube Data API v3."""
    if not api_key:
        return None
    url = "https://www.googleapis.com/youtube/v3/videos"
    params = {"id": video_id, "part": "snippet", "key": api_key}
    try:
        with httpx.Client(timeout=15.0) as client:
            r = client.get(url, params=params)
            r.raise_for_status()
            data = r.json()
    except Exception:
        return None
    items = data.get("items") or []
    if not items:
        return None
    snippet = items[0].get("snippet") or {}
    return {
        "title": snippet.get("title") or "",
        "description": snippet.get("description") or "",
        "channel": snippet.get("channelTitle") or snippet.get("channelId") or "",
    }


def _fetch_transcript(video_id: str) -> tuple[str | None, str | None]:
    """
    Fetch transcript (captions) using youtube-transcript-api. No API key needed.
    Returns (transcript_text, error_message). error_message is set when transcript is unavailable.
    """
    try:
        from youtube_transcript_api import YouTubeTranscriptApi
    except ImportError:
        return (None, "youtube-transcript-api not installed")
    try:
        segments = YouTubeTranscriptApi.get_transcript(video_id)
    except Exception as e:
        err = str(e).strip() or "Transcript unavailable"
        # Common cases: captions disabled, private video, region block
        if "disabled" in err.lower() or "not available" in err.lower():
            return (None, "Captions are disabled or not available for this video")
        if "private" in err.lower() or "sign in" in err.lower():
            return (None, "Video is private or requires sign-in")
        if "too many requests" in err.lower() or "429" in err:
            return (None, "Too many requests; try again later")
        return (None, err[:200])
    if not segments:
        return ("", None)
    # segments are list of dicts with "text", "start", "duration"
    text = " ".join((s.get("text") or "").strip() for s in segments).strip()
    return (text, None)


def extract_audio(
    url: str, output_dir: str = "."
) -> tuple[dict | None, str | None, str | None]:
    """
    Get YouTube video metadata and transcript using YouTube Data API + transcript API.
    No audio file is written; second value is the transcript text (or None).

    Args:
        url: YouTube video URL (youtube.com or youtu.be).
        output_dir: Unused; kept for backward compatibility with callers.

    Returns:
        Tuple of (metadata_dict, transcript_text, error_message).
        On success: (metadata, transcript, None). On failure: (None, None, error_message).
    """
    video_id = _video_id_from_url(url)
    if not video_id:
        return (None, None, "Invalid or unsupported YouTube URL (could not extract video ID)")

    api_key = _get_youtube_api_key()
    metadata = _fetch_metadata(video_id, api_key)
    transcript, transcript_error = _fetch_transcript(video_id)

    # If we have transcript (including empty string), success
    if transcript_error is None:
        if not metadata:
            metadata = {"title": "", "description": "", "channel": ""}
        return (metadata, transcript, None)

    # No transcript
    if metadata:
        return (None, None, transcript_error or "Transcript not available for this video")
    return (None, None, transcript_error or "Could not get video metadata or transcript")


def main() -> None:
    if len(sys.argv) > 1:
        url = sys.argv[1].strip()
    else:
        url = input("Enter YouTube URL: ").strip()

    if not url:
        print("No URL provided.", file=sys.stderr)
        sys.exit(1)

    print(f"Fetching metadata and transcript for: {url}", file=sys.stderr)
    try:
        metadata, transcript, err = extract_audio(url)
    except Exception as e:
        print(json.dumps({"error": str(e)}), file=sys.stderr)
        sys.exit(1)

    if metadata is None or err:
        print(json.dumps({"error": err or "Could not get video metadata or transcript."}), file=sys.stderr)
        sys.exit(1)

    out = {**metadata, "text": transcript or ""}
    print(json.dumps(out, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
