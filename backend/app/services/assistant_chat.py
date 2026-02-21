"""
AI assistant chat using Google Gemini API.
Multi-turn conversation with optional context (e.g. user's briefings).
"""
import google.generativeai as genai

from app.config import settings


def chat(
    messages: list[dict],
    *,
    context_briefings: list[dict] | None = None,
    model: str | None = None,
) -> str:
    """
    Send conversation to Gemini and return the assistant reply.

    :param messages: List of { "role": "user" | "assistant", "content": str }.
        The last message must be from the user.
    :param context_briefings: Optional list of briefing dicts (title, summary, etc.)
        to give the model awareness of "today's stories".
    :param model: Gemini model id. If None, uses settings.gemini_model.
    :return: Assistant reply text.
    """
    if not settings.gemini_api_key:
        raise ValueError("GEMINI_API_KEY is not set")
    if model is None:
        model = getattr(settings, "gemini_model", "gemini-2.5-flash")

    genai.configure(api_key=settings.gemini_api_key)
    gemini_model = genai.GenerativeModel(model)

    if not messages or messages[-1].get("role") != "user":
        raise ValueError("Messages must end with a user message")

    # Build context string from briefings for the system
    context_parts: list[str] = []
    if context_briefings:
        lines = ["Recent briefings from the user's sources:"]
        for b in context_briefings[:20]:
            title = b.get("title") or "Untitled"
            err = b.get("error")
            if err:
                lines.append(f"- {title} (error: {err})")
            else:
                lines.append(f"- {title}")
        context_parts.append("\n".join(lines))

    # Convert to Gemini history: "assistant" -> "model"
    history: list[dict] = []
    for m in messages[:-1]:
        role = m.get("role")
        content = (m.get("content") or "").strip()
        if not content:
            continue
        if role == "user":
            history.append({"role": "user", "parts": [content]})
        elif role == "assistant":
            history.append({"role": "model", "parts": [content]})

    last_user_content = (messages[-1].get("content") or "").strip()
    if not last_user_content:
        raise ValueError("Last user message must have content")

    system_instruction = (
        "You are the Briefcast briefing assistant. You help users understand their news and content briefings. "
        "Answer concisely and in a friendly tone. If the user asks about today's stories or their briefings, "
        "use the context provided when available; otherwise say you don't have that context and suggest they check their briefing cards."
    )
    if context_parts:
        system_instruction += "\n\n" + "\n\n".join(context_parts)

    # Gemini API: pass system_instruction to the model; history uses "user" and "model"
    model_with_system = genai.GenerativeModel(
        model,
        system_instruction=system_instruction,
    )
    chat_session = model_with_system.start_chat(history=history)
    response = chat_session.send_message(last_user_content)
    text = response.text if response.text else ""
    return text.strip() or "I couldn't generate a response. Please try again."
