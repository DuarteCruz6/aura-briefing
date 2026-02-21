"""
Summary generation using Google Gemini API.
"""
import google.generativeai as genai

from app.config import settings

# Default model for digest summaries (good balance of quality and speed)
DEFAULT_MODEL = "gemini-1.5-flash"


def generate_digest_summary(item_contents: list[str], *, model: str = DEFAULT_MODEL) -> str:
    """
    Generate a single digest summary from a list of item contents (e.g. titles + snippets).

    :param item_contents: List of strings, each typically one item's title + content/snippet.
    :param model: Gemini model id (default gemini-1.5-flash).
    :return: Summary text suitable for TTS (podcast script).
    """
    if not settings.gemini_api_key:
        raise ValueError("GEMINI_API_KEY is not set")

    genai.configure(api_key=settings.gemini_api_key)
    combined = "\n\n---\n\n".join(item_contents)
    if not combined.strip():
        return "No new content to summarize."

    prompt = """You are writing a short podcast script for a personal digest. The user has tracked several sources (articles, videos, posts, podcasts). Below are the new items. Write a concise, engaging summary (2–4 minutes when read aloud) that highlights the main points. Use a friendly, conversational tone. Output only the script, no meta-commentary."""

    gemini_model = genai.GenerativeModel(model)
    response = gemini_model.generate_content(
        f"{prompt}\n\nContent:\n\n{combined}",
        generation_config={"max_output_tokens": 1024},
    )
    text = response.text if response.text else ""
    return text.strip() or "No summary generated."
