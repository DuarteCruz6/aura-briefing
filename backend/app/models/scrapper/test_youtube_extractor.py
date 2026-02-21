#!/usr/bin/env python3
"""
Quick tests for youtube_audio_extractor.

Run from backend directory:
  python test_youtube_extractor.py "https://www.youtube.com/watch?v=..."

Or as CLI: python -m app.models.scrapper.youtube_audio_extractor "https://..." [output_dir]
"""

import json
import sys

sys.path.insert(0, ".")


def test_extract_audio(url: str, output_dir: str = "."):
    from app.models.scrapper.youtube_audio_extractor import extract_audio
    print(f"Testing extract_audio: {url}")
    metadata, _ = extract_audio(url, output_dir)
    if metadata:
        print(json.dumps(metadata, ensure_ascii=False, indent=2))
        return True
    return False


if __name__ == "__main__":
    if len(sys.argv) > 1:
        url = sys.argv[1].strip()
        try:
            ok = test_extract_audio(url)
            sys.exit(0 if ok else 1)
        except Exception as e:
            print(f"extract_audio failed: {e}")
            sys.exit(1)
    else:
        print("\nTo test audio extraction, run: python test_youtube_extractor.py <youtube_url>")
