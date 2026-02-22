"""
Summary generation using Google Gemini API (google.genai SDK).
"""
from google import genai
from google.genai import types

from app.config import settings


def _client():
    if not settings.gemini_api_key:
        raise ValueError("GEMINI_API_KEY is not set")
    return genai.Client(api_key=settings.gemini_api_key)


def generate_digest_summary(item_contents: list[str], *, model: str | None = None) -> str:
    """
    Generate a single digest summary from a list of item contents (e.g. titles + snippets).

    :param item_contents: List of strings, each typically one item's title + content/snippet.
    :param model: Gemini model id. If None, uses settings.gemini_model (default gemini-2.5-flash).
    :return: Summary text suitable for TTS (podcast script).
    """
    if model is None:
        model = getattr(settings, "gemini_model", "gemini-2.5-flash")

    combined = "\n\n---\n\n".join(item_contents)
    if not combined.strip():
        return "No new content to summarize."

    prompt = """You are writing a short podcast script for a personal digest. It is for a single user. The user has tracked several sources (articles, videos, posts, podcasts). Below are the new items. Write a concise, engaging summary that highlights the main points. Use a friendly, conversational tone. Output only the script, no meta-commentary."""

    client = _client()
    response = client.models.generate_content(
        model=model,
        contents=f"{prompt}\n\nContent:\n\n{combined}",
        config=types.GenerateContentConfig(max_output_tokens=1024),
    )
    text = (response.text or "").strip()
    return text or "No summary generated."


def generate_3min_digest_summary(item_contents: list[str], *, model: str | None = None) -> str:
    """
    Generate a single digest summary from a list of item contents, aimed at ~3 minutes when read aloud.

    :param item_contents: List of strings, each typically one item's title + content/snippet.
    :param model: Gemini model id. If None, uses settings.gemini_model.
    :return: Summary text suitable for TTS (podcast script), ~3 minutes when read aloud.
    """
    if model is None:
        model = getattr(settings, "gemini_model", "gemini-2.5-flash")

    combined = "\n\n---\n\n".join(item_contents)
    if not combined.strip():
        return "No new content to summarize."

    prompt = """You are writing a short podcast script for a personal digest. It is for a single user. The user has collected content from several URLs (articles, videos, posts, etc.). Below is the extracted content from each source. Write an engaging summary. Highlight the main points from each source in a coherent narrative. Use a friendly, conversational tone. Output only the script, no meta-commentary or section headers like "Summary:"."""

    client = _client()
    response = client.models.generate_content(
        model=model,
        contents=f"{prompt}\n\nContent:\n\n{combined}",
        config=types.GenerateContentConfig(max_output_tokens=2048),
    )
    text = (response.text or "").strip()
    return text or "No summary generated."
