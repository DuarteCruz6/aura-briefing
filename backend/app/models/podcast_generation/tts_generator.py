"""
Generate podcast audio from text using Google Gemini TTS.

Requires GEMINI_API_KEY in env or pass api_key=.
"""

import os
import wave
from pathlib import Path


# Gemini TTS model (single- and multi-speaker)
DEFAULT_MODEL_ID = "gemini-2.5-flash-preview-tts"
# Prebuilt voice name (e.g. Kore, Puck, Charon – see Gemini TTS docs)
DEFAULT_VOICE_NAME = "Kore"
DEFAULT_VOICE_ID = DEFAULT_VOICE_NAME  # alias for API compatibility
# PCM from Gemini: 24 kHz, mono, 16-bit
GEMINI_TTS_SAMPLE_RATE = 24000
GEMINI_TTS_CHANNELS = 1
GEMINI_TTS_SAMPLE_WIDTH = 2


def text_to_audio(
    text: str,
    output_path: str | Path,
    *,
    api_key: str | None = None,
    voice_id: str = DEFAULT_VOICE_NAME,
    model_id: str = DEFAULT_MODEL_ID,
    output_format: str | None = None,
) -> tuple[str, float | None]:
    """
    Convert script text to podcast audio using Gemini TTS and save to WAV.

    Args:
        text: Podcast script (plain text).
        output_path: Path where the WAV file will be written.
        api_key: Gemini API key. Defaults to GEMINI_API_KEY env var.
        voice_id: Ignored (kept for API compatibility). Use voice_name via model_id overload if needed.
        model_id: TTS model (default: gemini-2.5-flash-preview-tts).
        output_format: Ignored; Gemini TTS outputs WAV.

    Returns:
        Tuple of (absolute output path, duration_seconds or None if unknown).

    Raises:
        ImportError: If google.genai is not installed.
        ValueError: If api_key is missing or text is empty.
        Exception: On API or file errors.
    """
    try:
        from google import genai
        from google.genai import types
    except ImportError as e:
        raise ImportError(
            "google-genai is required for TTS. Install with: pip install google-genai"
        ) from e

    key = api_key or os.getenv("GEMINI_API_KEY")
    if not key:
        raise ValueError("GEMINI_API_KEY not set and no api_key provided")

    text = (text or "").strip()
    if not text:
        raise ValueError("text is required and cannot be empty")

    output_path = Path(output_path).resolve()
    # Gemini TTS outputs PCM -> we write WAV; ensure .wav extension
    if output_path.suffix.lower() != ".wav":
        output_path = output_path.with_suffix(".wav")
    output_path.parent.mkdir(parents=True, exist_ok=True)

    client = genai.Client(api_key=key)
    voice_name = (voice_id or DEFAULT_VOICE_NAME).strip() or DEFAULT_VOICE_NAME

    response = client.models.generate_content(
        model=model_id or DEFAULT_MODEL_ID,
        contents=text,
        config=types.GenerateContentConfig(
            response_modalities=["AUDIO"],
            speech_config=types.SpeechConfig(
                voice_config=types.VoiceConfig(
                    prebuilt_voice_config=types.PrebuiltVoiceConfig(
                        voice_name=voice_name,
                    )
                )
            ),
        ),
    )

    # Extract PCM from response
    try:
        part = response.candidates[0].content.parts[0]
        data = part.inline_data.data
    except (IndexError, AttributeError) as e:
        raise ValueError("Gemini TTS returned no audio") from e

    if isinstance(data, str):
        import base64
        data = base64.b64decode(data)
    if not data:
        raise ValueError("Gemini TTS returned empty audio")

    with wave.open(str(output_path), "wb") as wf:
        wf.setnchannels(GEMINI_TTS_CHANNELS)
        wf.setsampwidth(GEMINI_TTS_SAMPLE_WIDTH)
        wf.setframerate(GEMINI_TTS_SAMPLE_RATE)
        wf.writeframes(data)

    duration_seconds = _get_wav_duration(output_path)
    return str(output_path), duration_seconds


def _get_wav_duration(path: Path) -> float | None:
    """Return duration in seconds of a WAV file if detectable, else None."""
    try:
        with wave.open(str(path), "rb") as wf:
            frames = wf.getnframes()
            rate = wf.getframerate()
            return float(frames) / float(rate) if rate else None
    except Exception:
        return None
