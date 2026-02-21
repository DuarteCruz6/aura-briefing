"""
Generate podcast audio from text using ElevenLabs Text-to-Speech.

Requires ELEVENLABS_API_KEY_TTS in env or pass api_key=.
"""

import os
from pathlib import Path


# Default voice: ElevenLabs "Rachel" (clear, conversational)
DEFAULT_VOICE_ID = "21m00Tcm4TlvDq8ikWAM"
# Multilingual v2 is good for mixed-language content
DEFAULT_MODEL_ID = "eleven_multilingual_v2"
DEFAULT_OUTPUT_FORMAT = "mp3_44100_128"


def text_to_audio(
    text: str,
    output_path: str | Path,
    *,
    api_key: str | None = None,
    voice_id: str = DEFAULT_VOICE_ID,
    model_id: str = DEFAULT_MODEL_ID,
    output_format: str = DEFAULT_OUTPUT_FORMAT,
) -> tuple[str, float | None]:
    """
    Convert script text to podcast audio using ElevenLabs TTS and save to file.

    Args:
        text: Podcast script (plain text).
        output_path: Path where the MP3 file will be written.
        api_key: ElevenLabs API key. Defaults to ELEVENLABS_API_KEY_TTS env var.
        voice_id: ElevenLabs voice ID (default: Rachel).
        model_id: TTS model (default: eleven_multilingual_v2).
        output_format: Output format, e.g. mp3_44100_128.

    Returns:
        Tuple of (absolute output path, duration_seconds or None if unknown).

    Raises:
        ImportError: If elevenlabs package is not installed.
        ValueError: If api_key is missing or text is empty.
        Exception: On API or file errors.
    """
    try:
        from elevenlabs.client import ElevenLabs
    except ImportError as e:
        raise ImportError("elevenlabs is required. Install with: pip install elevenlabs") from e

    key = api_key or os.getenv("ELEVENLABS_API_KEY_TTS")
    if not key:
        raise ValueError("ELEVENLABS_API_KEY_TTS not set and no api_key provided")

    text = (text or "").strip()
    if not text:
        raise ValueError("text is required and cannot be empty")

    output_path = Path(output_path).resolve()
    output_path.parent.mkdir(parents=True, exist_ok=True)

    client = ElevenLabs(api_key=key)
    audio_bytes = client.text_to_speech.convert(
        text=text,
        voice_id=voice_id,
        model_id=model_id,
        output_format=output_format,
    )

    # SDK returns bytes (or generator in some versions; consume to bytes if needed)
    if hasattr(audio_bytes, "read"):
        audio_bytes = audio_bytes.read()
    elif not isinstance(audio_bytes, bytes):
        audio_bytes = b"".join(audio_bytes) if hasattr(audio_bytes, "__iter__") else bytes(audio_bytes)

    with open(output_path, "wb") as f:
        f.write(audio_bytes)

    duration_seconds = _get_mp3_duration(output_path)
    return str(output_path), duration_seconds


def _get_mp3_duration(path: Path) -> float | None:
    """Return duration in seconds of an MP3 file if detectable, else None."""
    try:
        from mutagen.mp3 import MP3
        audio = MP3(path)
        return float(audio.info.length)
    except Exception:
        return None
