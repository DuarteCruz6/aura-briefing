"""
Generate images for video slides using Gemini Imagen.
Requires GEMINI_API_KEY. Falls back to None if API unavailable or generation fails.
"""

import os
from io import BytesIO
from pathlib import Path


# Imagen model for image generation (English prompts)
IMAGEN_MODEL = "imagen-3.0-generate-002"

# Target size for video frames (16:9)
FRAME_WIDTH = 1280
FRAME_HEIGHT = 720


def _prompt_for_segment(segment_text: str, title: str | None, is_first: bool) -> str:
    """Build a short, visual-only prompt for Imagen from segment text."""
    # Keep prompt concise and descriptive; Imagen works best with clear visual descriptions
    snippet = (segment_text or "").strip()[:280]
    if not snippet:
        snippet = title or "daily news briefing"
    # Ask for editorial style, no text in image
    if is_first:
        return (
            f"Professional editorial photograph or illustration for a news briefing. "
            f"Main theme: {snippet}. Clean, modern, high quality, no text or words in the image."
        )
    return (
        f"Professional editorial image for a news segment. Theme: {snippet}. "
        f"Clean, modern, no text or captions in the image."
    )


def generate_slide_image(
    segment_text: str,
    output_path: str | Path,
    *,
    title: str | None = None,
    is_first: bool = False,
    api_key: str | None = None,
) -> bool:
    """
    Generate one image for a slide from the segment text using Imagen, save and resize to frame size.

    Returns True if image was generated and saved, False otherwise (caller can use text fallback).
    """
    try:
        from google import genai
        from google.genai import types
    except ImportError:
        return False

    key = api_key or os.getenv("GEMINI_API_KEY")
    if not key:
        return False

    prompt = _prompt_for_segment(segment_text, title, is_first)
    output_path = Path(output_path).resolve()
    output_path.parent.mkdir(parents=True, exist_ok=True)

    try:
        client = genai.Client(api_key=key)
        response = client.models.generate_images(
            model=IMAGEN_MODEL,
            prompt=prompt,
            config=types.GenerateImagesConfig(number_of_images=1),
        )
    except Exception:
        return False

    if not response.generated_images or len(response.generated_images) == 0:
        return False

    img_obj = response.generated_images[0]
    # Access image bytes: generated_image.image.image_bytes (or .image_bytes on object)
    raw = getattr(img_obj, "image", img_obj)
    image_bytes = getattr(raw, "image_bytes", None)
    if not image_bytes:
        return False

    try:
        from PIL import Image
    except ImportError:
        return False

    try:
        img = Image.open(BytesIO(image_bytes)).convert("RGB")
    except Exception:
        return False

    # Resize/crop to exact video frame size (16:9)
    img = _resize_to_frame(img, FRAME_WIDTH, FRAME_HEIGHT)
    img.save(str(output_path), "PNG")
    return True


def _resize_to_frame(img: "Image.Image", width: int, height: int) -> "Image.Image":
    """Resize and center-crop image to exact width x height."""
    from PIL import Image

    w, h = img.size
    target_ratio = width / height
    current_ratio = w / h

    if current_ratio > target_ratio:
        # Image is wider: crop width
        new_w = int(h * target_ratio)
        left = (w - new_w) // 2
        img = img.crop((left, 0, left + new_w, h))
    else:
        # Image is taller: crop height
        new_h = int(w / target_ratio)
        top = (h - new_h) // 2
        img = img.crop((0, top, w, top + new_h))

    return img.resize((width, height), Image.Resampling.LANCZOS)
