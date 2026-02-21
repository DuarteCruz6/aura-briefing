"""
Build a short video from briefing title + summary: TTS audio + gradient frame with title overlay.
Requires GEMINI_API_KEY (for TTS), moviepy, and Pillow.
"""

from pathlib import Path

# Video dimensions (16:9)
VIDEO_WIDTH = 1280
VIDEO_HEIGHT = 720
VIDEO_FPS = 30


def _make_gradient_frame(output_path: Path, title: str) -> None:
    """Create a single frame: gradient background + title text. Saved as PNG."""
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

    # Title text (centered, large)
    try:
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 52)
    except OSError:
        try:
            font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 52)
        except OSError:
            font = ImageFont.load_default()

    # Wrap long titles
    words = title.split()
    lines = []
    current = []
    for w in words:
        current.append(w)
        # Approximate line length (rough)
        if len(" ".join(current)) > 35:
            if len(current) > 1:
                lines.append(" ".join(current[:-1]))
                current = [current[-1]]
            else:
                lines.append(" ".join(current))
                current = []
    if current:
        lines.append(" ".join(current))

    y_offset = (VIDEO_HEIGHT - len(lines) * 60) // 2
    for line in lines:
        bbox = draw.textbbox((0, 0), line, font=font)
        tw = bbox[2] - bbox[0]
        x = (VIDEO_WIDTH - tw) // 2
        draw.text((x, y_offset), line, fill=(240, 240, 245), font=font)
        y_offset += 58

    img.save(str(output_path), "PNG")


def build_briefing_video(
    title: str,
    summary: str,
    output_path: str | Path,
    *,
    voice_id: str | None = None,
    model_id: str | None = None,
) -> str:
    """
    Generate TTS from summary, create a gradient frame with title, and mux to MP4.

    Args:
        title: Briefing title (drawn on the frame).
        summary: Script/summary text (used for TTS).
        output_path: Where to write the final MP4.
        voice_id: Optional TTS voice (default from tts_generator).
        model_id: Optional TTS model (default from tts_generator).

    Returns:
        Absolute path to the generated MP4 file.

    Raises:
        ValueError: If summary is empty or TTS fails.
        ImportError: If moviepy or Pillow is missing.
    """
    from app.models.podcast_generation import text_to_audio
    from app.models.podcast_generation.tts_generator import DEFAULT_MODEL_ID, DEFAULT_VOICE_ID

    summary = (summary or "").strip()
    if not summary:
        raise ValueError("summary is required and cannot be empty")

    output_path = Path(output_path).resolve()
    output_path.parent.mkdir(parents=True, exist_ok=True)
    if output_path.suffix.lower() != ".mp4":
        output_path = output_path.with_suffix(".mp4")

    tmp_dir = output_path.parent / f"_video_{output_path.stem}"
    tmp_dir.mkdir(parents=True, exist_ok=True)
    wav_path = tmp_dir / "audio.wav"
    frame_path = tmp_dir / "frame.png"

    try:
        # 1) TTS from summary
        _, duration_seconds = text_to_audio(
            summary,
            wav_path,
            voice_id=voice_id or DEFAULT_VOICE_ID,
            model_id=model_id or DEFAULT_MODEL_ID,
        )
        if not wav_path.is_file():
            raise ValueError("TTS did not produce audio file")
        duration = duration_seconds or 10.0

        # 2) Single gradient frame with title
        _make_gradient_frame(frame_path, title or "Briefing")

        # 3) Compose video: image for full duration + audio
        try:
            from moviepy.editor import AudioFileClip, ImageClip
        except ImportError as e:
            raise ImportError(
                "moviepy is required for video generation. Install with: pip install moviepy"
            ) from e

        audio_clip = AudioFileClip(str(wav_path))
        # Use actual audio duration in case TTS length differs
        duration = float(audio_clip.duration)

        # ImageClip(duration=...) works in both moviepy 1.x and 2.x
        image_clip = ImageClip(str(frame_path), duration=duration)
        if hasattr(image_clip, "with_fps"):
            image_clip = image_clip.with_fps(VIDEO_FPS)
        else:
            image_clip.fps = VIDEO_FPS
        video_clip = image_clip.with_audio(audio_clip) if hasattr(image_clip, "with_audio") else image_clip.set_audio(audio_clip)

        video_clip.write_videofile(
            str(output_path),
            codec="libx264",
            audio_codec="aac",
            fps=VIDEO_FPS,
            logger=None,
        )

        video_clip.close()
        audio_clip.close()
        image_clip.close()

        return str(output_path)
    finally:
        # Cleanup temp files
        for p in (wav_path, frame_path):
            if p.exists():
                try:
                    p.unlink()
                except OSError:
                    pass
        if tmp_dir.exists():
            try:
                tmp_dir.rmdir()
            except OSError:
                pass
