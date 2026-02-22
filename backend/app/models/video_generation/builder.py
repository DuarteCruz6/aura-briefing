"""
Build a short video from briefing title + summary: podcast audio (or TTS) + slideshow of images.
Uses transcript (from DB or summary) split into slides synced to audio duration.
When cached_audio_path is provided, uses that file (same as podcast); otherwise generates TTS.
Requires GEMINI_API_KEY (for TTS and image gen), moviepy, and Pillow.
"""

import re
import shutil
from pathlib import Path
from typing import Callable

# Video dimensions (16:9)
VIDEO_WIDTH = 1280
VIDEO_HEIGHT = 720
VIDEO_FPS = 30

# Slide segmentation: fewer, longer segments so slides stay on screen longer
MAX_CHARS_PER_LINE = 52
MAX_LINES_PER_SLIDE = 6
TARGET_SEGMENT_CHARS = 900   # large chunks = fewer slides (each 10–30+ seconds)
MIN_SLIDE_DURATION = 8.0     # seconds; no slide shorter than this


def _split_into_slides(text: str) -> list[str]:
    """Split transcript/summary into slide-sized segments (by sentences, then by length)."""
    text = (text or "").strip()
    if not text:
        return []
    # Split on sentence boundaries (., !, ? followed by space or end)
    raw = re.split(r"(?<=[.!?])\s+", text)
    sentences = [s.strip() for s in raw if s.strip()]
    if not sentences:
        return [text] if text else []

    segments: list[str] = []
    current: list[str] = []
    current_len = 0

    for sent in sentences:
        sent_len = len(sent) + (1 if current else 0)
        if current and current_len + sent_len > TARGET_SEGMENT_CHARS:
            segments.append(" ".join(current))
            current = []
            current_len = 0
        current.append(sent)
        current_len += sent_len
    if current:
        segments.append(" ".join(current))

    return segments if segments else [text]


def _merge_segments_to_fit_duration(segments: list[str], total_duration: float) -> list[str]:
    """Merge segments so we have at most total_duration/MIN_SLIDE_DURATION slides."""
    if not segments or total_duration <= 0:
        return segments
    max_slides = max(1, int(total_duration / MIN_SLIDE_DURATION))
    if len(segments) <= max_slides:
        return segments
    merged: list[str] = []
    chunk_size = (len(segments) + max_slides - 1) // max_slides
    for i in range(0, len(segments), chunk_size):
        chunk = segments[i : i + chunk_size]
        merged.append(" ".join(chunk))
    return merged


def _wrap_text(lines: list[str], font, draw, max_width: int) -> list[str]:
    """Wrap a list of lines to fit max_width; returns flat list of wrapped lines."""
    out: list[str] = []
    for line in lines:
        words = line.split()
        current: list[str] = []
        for w in words:
            current.append(w)
            test = " ".join(current)
            if hasattr(draw, "textbbox"):
                bbox = draw.textbbox((0, 0), test, font=font)
            elif hasattr(font, "getbbox"):
                bbox = font.getbbox(test)
            else:
                bbox = (0, 0, len(test) * 10, 20)
            w_pt = bbox[2] - bbox[0]
            if w_pt > max_width and len(current) > 1:
                out.append(" ".join(current[:-1]))
                current = [current[-1]]
        if current:
            out.append(" ".join(current))
    return out


def _make_gradient_frame(output_path: Path, title: str) -> None:
    """Create a single frame: gradient background + title text. Saved as PNG."""
    _make_slide_frame(output_path, title, "")


def _make_slide_frame(
    output_path: Path,
    title_line: str,
    body_text: str,
    *,
    is_first: bool = False,
) -> None:
    """Create a slide frame: gradient + optional title at top + body text. Saved as PNG."""
    try:
        from PIL import Image, ImageDraw, ImageFont
    except ImportError as e:
        raise ImportError("Pillow is required for video generation. Install with: pip install Pillow") from e

    img = Image.new("RGB", (VIDEO_WIDTH, VIDEO_HEIGHT))
    draw = ImageDraw.Draw(img)

    # Gradient: dark blue/purple to darker (brand-friendly)
    for y in range(VIDEO_HEIGHT):
        t = y / VIDEO_HEIGHT
        r = int(15 + 20 * (1 - t))
        g = int(20 + 25 * (1 - t))
        b = int(45 + 35 * (1 - t))
        draw.line([(0, y), (VIDEO_WIDTH, y)], fill=(r, g, b))

    def _font(size: int, bold: bool = False):
        names = [
            "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
            "/System/Library/Fonts/Helvetica.ttc",
        ]
        for p in names:
            try:
                return ImageFont.truetype(p, size)
            except OSError:
                continue
        return ImageFont.load_default()

    font_title = _font(42, bold=True)
    font_body = _font(36, bold=False)
    margin_x = 80
    max_line_width = VIDEO_WIDTH - 2 * margin_x

    y_offset = 60

    def _text_width(line: str, fnt) -> int:
        if hasattr(draw, "textbbox"):
            bbox = draw.textbbox((0, 0), line, font=fnt)
        elif hasattr(fnt, "getbbox"):
            bbox = fnt.getbbox(line)
        else:
            return len(line) * 12
        return bbox[2] - bbox[0]

    # Optional title at top (first slide or when provided)
    if is_first and title_line:
        title_lines = _wrap_text([title_line], font_title, draw, max_line_width)
        for line in title_lines[:2]:  # at most 2 lines for title
            tw = _text_width(line, font_title)
            x = (VIDEO_WIDTH - tw) // 2
            draw.text((x, y_offset), line, fill=(255, 255, 255), font=font_title)
            y_offset += 48
        y_offset += 24

    # Body text (slide content)
    if body_text:
        body_lines = _wrap_text([body_text], font_body, draw, max_line_width)
        for line in body_lines[:MAX_LINES_PER_SLIDE]:
            draw.text((margin_x, y_offset), line, fill=(240, 240, 245), font=font_body)
            y_offset += 44
    elif title_line and not is_first:
        # Fallback: only title line (e.g. single-slide)
        draw.text((margin_x, y_offset), title_line, fill=(240, 240, 245), font=font_body)

    img.save(str(output_path), "PNG")


def build_briefing_video(
    title: str,
    summary: str,
    output_path: str | Path,
    *,
    transcript_for_slides: str | None = None,
    cached_audio_path: str | Path | None = None,
    voice_id: str | None = None,
    model_id: str | None = None,
    progress_callback: Callable[[int], None] | None = None,
) -> str:
    """
    Create a slideshow of images synced to audio, mux to MP4.
    Uses cached podcast audio when provided (same as podcast); otherwise generates TTS from summary.

    Args:
        title: Briefing title (used for first slide image prompt).
        summary: Script/summary text (used for TTS when no cached audio).
        output_path: Where to write the final MP4.
        transcript_for_slides: Optional transcript (e.g. from DB) to split into slides; else summary is used.
        cached_audio_path: Optional path to existing WAV (e.g. cached podcast); if set, no TTS is run.
        voice_id: Optional TTS voice (default from tts_generator).
        model_id: Optional TTS model (default from tts_generator).
        progress_callback: Optional callback(percent: int) called with 0-100 during generation.

    Returns:
        Absolute path to the generated MP4 file.
    """
    from app.models.podcast_generation import text_to_audio
    from app.models.podcast_generation.tts_generator import DEFAULT_MODEL_ID, DEFAULT_VOICE_ID

    def report(pct: int) -> None:
        if progress_callback:
            progress_callback(min(100, max(0, pct)))

    summary = (summary or "").strip()
    if not summary:
        raise ValueError("summary is required and cannot be empty")

    # Slide content: transcript from DB if provided, otherwise summary
    slide_text = (transcript_for_slides or "").strip() or summary
    segments = _split_into_slides(slide_text)
    if not segments:
        segments = [summary[:500] if len(summary) > 500 else summary]

    output_path = Path(output_path).resolve()
    output_path.parent.mkdir(parents=True, exist_ok=True)
    if output_path.suffix.lower() != ".mp4":
        output_path = output_path.with_suffix(".mp4")

    tmp_dir = output_path.parent / f"_video_{output_path.stem}"
    tmp_dir.mkdir(parents=True, exist_ok=True)
    wav_path = tmp_dir / "audio.wav"
    frame_paths: list[Path] = []

    try:
        try:
            from moviepy.editor import AudioFileClip, ImageClip, concatenate_videoclips
        except ImportError:
            try:
                from moviepy import AudioFileClip, ImageClip, concatenate_videoclips
            except ImportError as e:
                raise ImportError(
                    "moviepy is required for video generation. Install with: pip install moviepy"
                ) from e

        report(0)
        # 1) Audio: use cached podcast WAV if provided, else TTS (0 -> 25%)
        cached_path = Path(cached_audio_path).resolve() if cached_audio_path else None
        if cached_path and cached_path.is_file():
            shutil.copy2(cached_path, wav_path)
            report(25)
        else:
            tts_cb = (lambda p: report((p * 25) // 100)) if progress_callback else None
            text_to_audio(
                summary,
                wav_path,
                voice_id=voice_id or DEFAULT_VOICE_ID,
                model_id=model_id or DEFAULT_MODEL_ID,
                progress_callback=tts_cb,
            )
            report(25)

        if not wav_path.is_file():
            raise ValueError("Audio file not available (TTS or cached)")
        audio_clip = AudioFileClip(str(wav_path))
        total_duration = float(audio_clip.duration)
        segments = _merge_segments_to_fit_duration(segments, total_duration)

        # 2) Per-segment duration by character ratio (approximate sync to what’s being said)
        total_chars = sum(len(s) for s in segments)
        raw_durations = [
            (len(s) / total_chars) * total_duration if total_chars else total_duration / len(segments)
            for s in segments
        ]
        # Enforce minimum duration per slide, then re-normalize so total still matches audio
        segment_durations = [max(d, MIN_SLIDE_DURATION) for d in raw_durations]
        seg_sum = sum(segment_durations)
        if seg_sum > 0:
            segment_durations = [(d / seg_sum) * total_duration for d in segment_durations]

        # 3) One image per segment: generate image; on failure use gradient placeholder (no text)
        from app.models.video_generation.image_generator import generate_slide_image

        n_seg = len(segments)
        for i, (seg, dur) in enumerate(zip(segments, segment_durations)):
            path = tmp_dir / f"frame_{i:03d}.png"
            frame_paths.append(path)
            is_first = i == 0
            if not generate_slide_image(
                seg,
                path,
                title=title or None,
                is_first=is_first,
            ):
                _make_gradient_frame(path, "")  # placeholder: no text, image-only
            if n_seg:
                report(25 + 50 * (i + 1) // n_seg)

        # 4) Build clip per slide and concatenate
        clips = []
        for path, dur in zip(frame_paths, segment_durations):
            if dur <= 0:
                continue
            ic = ImageClip(str(path), duration=dur)
            if hasattr(ic, "with_fps"):
                ic = ic.with_fps(VIDEO_FPS)
            else:
                ic.fps = VIDEO_FPS
            clips.append(ic)

        if not clips:
            # Fallback: single frame (no text)
            single = tmp_dir / "frame.png"
            _make_gradient_frame(single, "")
            frame_paths.append(single)
            ic = ImageClip(str(single), duration=total_duration)
            if hasattr(ic, "with_fps"):
                ic = ic.with_fps(VIDEO_FPS)
            else:
                ic.fps = VIDEO_FPS
            clips = [ic]

        report(85)
        video_clip = concatenate_videoclips(clips, method="compose")
        video_clip = video_clip.with_audio(audio_clip) if hasattr(video_clip, "with_audio") else video_clip.set_audio(audio_clip)

        video_clip.write_videofile(
            str(output_path),
            codec="libx264",
            audio_codec="aac",
            fps=VIDEO_FPS,
            logger=None,
        )
        report(100)

        video_clip.close()
        audio_clip.close()
        for c in clips:
            c.close()

        return str(output_path)
    finally:
        for p in [wav_path] + frame_paths:
            if p and p.exists():
                try:
                    p.unlink()
                except OSError:
                    pass
        if tmp_dir.exists():
            try:
                for f in tmp_dir.iterdir():
                    try:
                        f.unlink()
                    except OSError:
                        pass
                tmp_dir.rmdir()
            except OSError:
                pass
