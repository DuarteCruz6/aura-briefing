"""
Generate podcast audio from text using Google Gemini TTS.

Requires GEMINI_API_KEY in env or pass api_key=.
Long scripts are split into chunks to avoid API truncation; chunks are concatenated into one WAV.
"""

import os
import wave
from pathlib import Path
from typing import Callable


# Gemini TTS model (single- and multi-speaker)
DEFAULT_MODEL_ID = "gemini-2.5-flash-preview-tts"
# Prebuilt voice name (e.g. Kore, Puck, Charon – see Gemini TTS docs)
DEFAULT_VOICE_NAME = "Kore"
DEFAULT_VOICE_ID = DEFAULT_VOICE_NAME  # alias for API compatibility
# PCM from Gemini: 24 kHz, mono, 16-bit
GEMINI_TTS_SAMPLE_RATE = 24000
GEMINI_TTS_CHANNELS = 1
GEMINI_TTS_SAMPLE_WIDTH = 2

# Chunk size to avoid TTS API truncation (conservative; some APIs limit ~5k bytes per request)
TTS_CHUNK_MAX_CHARS = 4000


def _split_into_chunks(text: str, max_chars: int = TTS_CHUNK_MAX_CHARS) -> list[str]:
    """Split text into chunks at sentence/paragraph boundaries, each <= max_chars."""
    text = (text or "").strip()
    if not text:
        return []
    if len(text) <= max_chars:
        return [text]

    chunks: list[str] = []
    rest = text
    while rest:
        if len(rest) <= max_chars:
            chunks.append(rest.strip())
            break
        block = rest[: max_chars + 1]
        # Prefer break at paragraph, then sentence, then space
        break_at = -1
        for sep in ("\n\n", "\n", ". ", "! ", "? ", "; ", ", ", " "):
            idx = block.rfind(sep)
            if idx > max_chars // 2:
                break_at = idx + len(sep)
                break
        if break_at <= 0:
            break_at = max_chars
        chunk = rest[:break_at].strip()
        if chunk:
            chunks.append(chunk)
        rest = rest[break_at:].lstrip()
    return chunks


def _tts_single_chunk(
    client,
    text: str,
    voice_name: str,
    model_id: str,
) -> bytes:
    """Call Gemini TTS for one chunk; return raw PCM bytes."""
    from google.genai import types

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
    return data


def text_to_audio(
    text: str,
    output_path: str | Path,
    *,
    api_key: str | None = None,
    voice_id: str = DEFAULT_VOICE_NAME,
    model_id: str = DEFAULT_MODEL_ID,
    output_format: str | None = None,
    progress_callback: Callable[[int], None] | None = None,
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
        progress_callback: Optional callback(percent: int) called with 0-100 during generation.

    Returns:
        Tuple of (absolute output path, duration_seconds or None if unknown).

    Raises:
        ImportError: If google.genai is not installed.
        ValueError: If api_key is missing or text is empty.
        Exception: On API or file errors.
    """
    try:
        from google import genai
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
    model_id = model_id or DEFAULT_MODEL_ID

    chunks = _split_into_chunks(text, TTS_CHUNK_MAX_CHARS)
    if not chunks:
        raise ValueError("text is required and cannot be empty")

    def report(pct: int) -> None:
        if progress_callback:
            progress_callback(pct)

    report(0)
    if len(chunks) == 1:
        # Single chunk: one API call, write directly
        data = _tts_single_chunk(client, chunks[0], voice_name, model_id)
        report(50)
        with wave.open(str(output_path), "wb") as wf:
            wf.setnchannels(GEMINI_TTS_CHANNELS)
            wf.setsampwidth(GEMINI_TTS_SAMPLE_WIDTH)
            wf.setframerate(GEMINI_TTS_SAMPLE_RATE)
            wf.writeframes(data)
        report(100)
    else:
        # Multiple chunks: TTS each, concatenate PCM, write one WAV
        all_frames = b""
        n = len(chunks)
        for i, chunk in enumerate(chunks):
            if not chunk.strip():
                continue
            data = _tts_single_chunk(client, chunk, voice_name, model_id)
            all_frames += data
            report(min(90, (i + 1) * 90 // n))
        if not all_frames:
            raise ValueError("Gemini TTS returned no audio")
        with wave.open(str(output_path), "wb") as wf:
            wf.setnchannels(GEMINI_TTS_CHANNELS)
            wf.setsampwidth(GEMINI_TTS_SAMPLE_WIDTH)
            wf.setframerate(GEMINI_TTS_SAMPLE_RATE)
            wf.writeframes(all_frames)
        report(100)

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
