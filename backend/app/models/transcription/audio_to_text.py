"""
Convert audio file to text using Google Gemini (audio understanding).
Optional: get audio from a YouTube URL then transcribe in one call.

Requires GEMINI_API_KEY in env or pass api_key=.
"""

import os


# Model that supports audio (e.g. gemini-2.5-flash or gemini-2.0-flash-exp)
DEFAULT_MODEL_ID = "gemini-2.5-flash"


def audio_to_text(
    audio_path: str,
    *,
    api_key: str | None = None,
    model_id: str | None = None,
    language_code: str = "eng",
) -> str:
    """
    Transcribe an audio file to text using Gemini.

    Args:
        audio_path: Path to the audio file (MP3, WAV, FLAC, etc.).
        api_key: Gemini API key. Defaults to GEMINI_API_KEY env var.
        model_id: Model id (default: gemini-2.5-flash). Ignored if not supported.
        language_code: Hint for language (e.g. eng). Optional; Gemini detects language.

    Returns:
        Transcribed text.

    Raises:
        ImportError: If google.genai is not installed.
        ValueError: If api_key is missing.
        Exception: On API or file errors.
    """
    try:
        from google import genai
        from google.genai import types
    except ImportError as e:
        raise ImportError(
            "google-genai is required for STT. Install with: pip install google-genai"
        ) from e

    key = api_key or os.getenv("GEMINI_API_KEY")
    if not key:
        raise ValueError("GEMINI_API_KEY not set and no api_key provided")

    model = model_id or os.getenv("GEMINI_MODEL") or DEFAULT_MODEL_ID
    prompt = "Generate a transcript of the speech. Output only the transcribed text, no timestamps or labels."

    client = genai.Client(api_key=key)

    # Use file upload for reliability (works for larger files; inline has 20 MB limit)
    with open(audio_path, "rb") as f:
        file_size = f.seek(0, 2)
        f.seek(0)

    if file_size > 20 * 1024 * 1024:  # 20 MB
        # Upload via Files API for large files
        uploaded = client.files.upload(file=audio_path)
        contents = [prompt, uploaded]
    else:
        # Inline for smaller files
        with open(audio_path, "rb") as f:
            audio_bytes = f.read()
        mime = _mime_for_path(audio_path)
        contents = [
            prompt,
            types.Part.from_bytes(data=audio_bytes, mime_type=mime),
        ]

    response = client.models.generate_content(
        model=model,
        contents=contents,
    )

    text = getattr(response, "text", None)
    if text is not None:
        return (text or "").strip()
    # Fallback: extract from candidates
    try:
        part = response.candidates[0].content.parts[0]
        return (getattr(part, "text", None) or str(part)).strip()
    except (IndexError, AttributeError):
        return str(response).strip()


def _mime_for_path(path: str) -> str:
    ext = (path or "").rsplit(".", 1)[-1].lower()
    mime_map = {
        "mp3": "audio/mp3",
        "wav": "audio/wav",
        "flac": "audio/flac",
        "ogg": "audio/ogg",
        "aac": "audio/aac",
        "aiff": "audio/aiff",
    }
    return mime_map.get(ext, "audio/mp3")


def youtube_url_to_text(
    youtube_url: str,
    output_dir: str = ".",
    *,
    api_key: str | None = None,
    model_id: str | None = None,
    language_code: str = "eng",
) -> dict | None:
    """
    Get metadata and transcript for a YouTube URL.
    Uses youtube_audio_extractor (YouTube Data API + youtube-transcript-api); no audio download.

    Args:
        youtube_url: YouTube video URL.
        output_dir: Unused; kept for compatibility.
        api_key: Unused (Gemini not used for YouTube transcript); kept for compatibility.
        model_id: Unused; kept for compatibility.
        language_code: Unused; kept for compatibility.

    Returns:
        Dict with keys: channel, title, text (transcript).
        None if metadata or transcript is unavailable.
    """
    from app.models.scrapper.youtube_audio_extractor import extract_audio

    metadata, transcript, error = extract_audio(youtube_url, output_dir)
    if error:
        raise ValueError(error)
    if not metadata or transcript is None:
        raise ValueError("Could not get video metadata or transcript")
    return {
        "channel": metadata.get("channel", ""),
        "title": metadata.get("title", ""),
        "text": transcript,
    }
