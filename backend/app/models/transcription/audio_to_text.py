"""
Convert audio file to text using ElevenLabs Speech-to-Text (Scribe).
Optional: get audio from a YouTube URL then transcribe in one call.

Requires ELEVENLABS_API_KEY_STT in env or pass api_key=.
"""

import os


def audio_to_text(
    audio_path: str,
    *,
    api_key: str | None = None,
    model_id: str = "scribe_v2",
    language_code: str = "eng",
) -> str:
    """
    Transcribe an audio file to text using ElevenLabs Speech-to-Text.

    Args:
        audio_path: Path to the audio file (MP3, WAV, etc. – see ElevenLabs docs).
        api_key: ElevenLabs API key. Defaults to ELEVENLABS_API_KEY_STT env var.
        model_id: STT model (default: scribe_v2).
        language_code: Language code (default: eng).

    Returns:
        Transcribed text.

    Raises:
        ImportError: If elevenlabs package is not installed.
        ValueError: If api_key is missing.
        Exception: On API or file errors.
    """
    try:
        from elevenlabs.client import ElevenLabs
    except ImportError as e:
        raise ImportError("elevenlabs is required. Install with: pip install elevenlabs") from e

    key = api_key or os.getenv("ELEVENLABS_API_KEY_STT")
    if not key:
        raise ValueError("ELEVENLABS_API_KEY_STT not set and no api_key provided")

    client = ElevenLabs(api_key=key)

    with open(audio_path, "rb") as f:
        result = client.speech_to_text.convert(
            file=f,
            model_id=model_id,
            language_code=language_code,
        )

    # SDK may return object with .text or a string
    if hasattr(result, "text"):
        return result.text or ""
    if isinstance(result, str):
        return result
    return str(result)


def youtube_url_to_text(
    youtube_url: str,
    output_dir: str = ".",
    *,
    api_key: str | None = None,
    model_id: str = "scribe_v2",
    language_code: str = "eng",
) -> dict | None:
    """
    Get audio from a YouTube URL and convert it to text.
    Uses youtube_audio_extractor then ElevenLabs STT.

    Args:
        youtube_url: YouTube video URL.
        output_dir: Directory to save the downloaded audio file.
        api_key: ElevenLabs API key (optional).
        model_id: ElevenLabs STT model (default: scribe_v2).
        language_code: Language code (default: eng).

    Returns:
        Dict with keys: channel, title, description, text (transcript). No audio path.
        None if extraction or transcription fails.
    """
    from app.models.scrapper.youtube_audio_extractor import extract_audio

    metadata, audio_path = extract_audio(youtube_url, output_dir)
    if not metadata or not audio_path:
        return None
    try:
        text = audio_to_text(
            audio_path,
            api_key=api_key,
            model_id=model_id,
            language_code=language_code,
        )
        return {
            "channel": metadata.get("channel", ""),
            "title": metadata.get("title", ""),
            "description": metadata.get("description", ""),
            "text": text,
        }
    except Exception:
        return None
    finally:
        try:
            if audio_path and os.path.isfile(audio_path):
                os.remove(audio_path)
        except OSError:
            pass
