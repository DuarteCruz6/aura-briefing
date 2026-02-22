"""
AI assistant chat using Google Gemini API (google.genai SDK).
Multi-turn conversation with optional context (e.g. user's briefings).
"""
from google import genai
from google.genai import types

from app.config import settings


def chat(
    messages: list[dict],
    *,
    context_briefings: list[dict] | None = None,
    user_name: str | None = None,
    user_topics: list[str] | None = None,
    user_sources: list[dict] | None = None,
    latest_briefing_summary: str | None = None,
    model: str | None = None,
) -> str:
    """
    Send conversation to Gemini and return the assistant reply.

    :param messages: List of { "role": "user" | "assistant", "content": str }.
        The last message must be from the user.
    :param context_briefings: Optional list of briefing dicts (title, etc.) from user's sources.
    :param user_name: The user's display name.
    :param user_topics: Topics the user is interested in (from preferences).
    :param user_sources: List of { name, url, type } for people/channels the user follows.
    :param latest_briefing_summary: Full text of the most recent generated briefing (from DB).
    :param model: Gemini model id. If None, uses settings.gemini_model.
    :return: Assistant reply text.
    """
    if not settings.gemini_api_key:
        raise ValueError("GEMINI_API_KEY is not set")
    if model is None:
        model = getattr(settings, "gemini_model", "gemini-2.5-flash")

    if not messages or messages[-1].get("role") != "user":
        raise ValueError("Messages must end with a user message")

    # Build context for the system instruction
    context_parts: list[str] = []

    if user_name:
        context_parts.append(f"The user's name is {user_name}.")

    if user_topics:
        context_parts.append(
            "Topics they're interested in: " + ", ".join(user_topics[:30]) + "."
        )

    if user_sources:
        lines = ["People/channels they follow:"]
        for s in user_sources[:30]:
            name = s.get("name") or s.get("url") or "Unknown"
            stype = s.get("type", "")
            lines.append(f"- {name} ({stype})")
        context_parts.append("\n".join(lines))

    if latest_briefing_summary:
        context_parts.append(
            "Newest briefing (full summary from the app):\n" + latest_briefing_summary
        )

    if context_briefings:
        lines = ["Recent items from their sources (titles):"]
        for b in context_briefings[:20]:
            title = b.get("title") or "Untitled"
            err = b.get("error")
            if err:
                lines.append(f"- {title} (error: {err})")
            else:
                lines.append(f"- {title}")
        context_parts.append("\n".join(lines))

    system_instruction = (
        "You are the Unscrolling briefing assistant. You help users understand their news and content briefings. "
        "You know the user's name, their interests (topics and people they follow), and the full text of their newest briefing when available. "
        "Answer concisely and in a friendly tone. Use the context provided when the user asks about their briefings, today's stories, or their interests."
    )
    if context_parts:
        system_instruction += "\n\nContext:\n\n" + "\n\n".join(context_parts)

    # Build contents: multi-turn as list of Content (user / model)
    contents: list[types.Content] = []
    for m in messages:
        role = m.get("role")
        content = (m.get("content") or "").strip()
        if not content:
            continue
        if role == "user":
            contents.append(types.Content(role="user", parts=[types.Part.from_text(text=content)]))
        elif role == "assistant":
            contents.append(types.Content(role="model", parts=[types.Part.from_text(text=content)]))

    client = genai.Client(api_key=settings.gemini_api_key)
    response = client.models.generate_content(
        model=model,
        contents=contents,
        config=types.GenerateContentConfig(
            system_instruction=system_instruction,
            max_output_tokens=2048,
        ),
    )
    text = (response.text or "").strip()
    return text or "I couldn't generate a response. Please try again."
