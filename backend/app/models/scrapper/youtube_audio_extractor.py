#!/usr/bin/env python3
"""
YouTube audio extraction. Server use (FFmpeg + yt-dlp required).

Import: from youtube_audio_extractor import extract_audio
CLI: python youtube_audio_extractor.py <youtube_url> [output_directory]
"""

import json
import os
import sys


def extract_audio(url: str, output_dir: str = ".") -> tuple[dict | None, str | None]:
    """
    Download YouTube video and extract audio as MP3.
    Call from other modules; assumes server has yt-dlp and FFmpeg.

    Args:
        url: YouTube video URL
        output_dir: Directory to save the audio file (default: current directory)

    Returns:
        Tuple of (metadata_dict, audio_path). metadata_dict has "channel", "title", "description" (no path).
        On failure returns (None, None).
    """
    try:
        import yt_dlp
    except ImportError as e:
        raise ImportError("yt-dlp is required. Install with: pip install yt-dlp") from e

    os.makedirs(output_dir, exist_ok=True)
    out_template = os.path.join(output_dir, "%(title)s.%(ext)s")

    ydl_opts = {
        "format": "bestaudio/best",
        "postprocessors": [
            {
                "key": "FFmpegExtractAudio",
                "preferredcodec": "mp3",
                "preferredquality": "192",
            }
        ],
        "outtmpl": out_template,
        "quiet": False,
        "postprocessor_args": ["-ar", "44100"],
        'cookiesfrombrowser': ('chrome', None, None, None), 
    }

    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(url, download=True)
        if info is None:
            return (None, None)
        title = info.get("title", "audio")
        description = info.get("description") or ""
        channel = info.get("channel") or info.get("uploader") or ""
        path = os.path.join(output_dir, f"{title}.mp3")
        if not os.path.isfile(path):
            for f in os.listdir(output_dir):
                if title in f and f.endswith(".mp3"):
                    path = os.path.join(output_dir, f)
                    break
        audio_path = os.path.abspath(path) if os.path.isfile(path) else ""
        if not audio_path:
            return (None, None)
        metadata = {
            "title": title,
            "description": description,
            "channel": channel,
        }
        return (metadata, audio_path)


def main():
    if len(sys.argv) > 1:
        url = sys.argv[1].strip()
        output_dir = sys.argv[2] if len(sys.argv) > 2 else "."
    else:
        url = input("Enter YouTube URL: ").strip()
        output_dir = "."

    if not url:
        print("No URL provided.", file=sys.stderr)
        sys.exit(1)

    print(f"Extracting audio from: {url}", file=sys.stderr)
    try:
        metadata, _ = extract_audio(url, output_dir)
    except ImportError as e:
        print(str(e), file=sys.stderr)
        sys.exit(1)
    if metadata:
        print(json.dumps(metadata, ensure_ascii=False, indent=2))
    else:
        print(json.dumps({"error": "Extraction failed."}), file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
