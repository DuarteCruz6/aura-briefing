"""
Produce a single ~3-minute text summary from multiple URLs.
Uses get_or_extract_summary per URL (same as POST /summaries/get-or-extract), then Gemini to summarize.
"""
from sqlalchemy.orm import Session

from app.models.summary_generation.service import generate_3min_digest_summary
from app.services.url_summary import get_or_extract_summary


def _summary_dict_to_content(obj: dict, url: str = "") -> str:
    """Turn one URL's summary JSON into a single string (title + main text/transcript)."""
    if not obj:
        return ""
    title = obj.get("title") or obj.get("name") or ""
    body = obj.get("text") or obj.get("transcript") or obj.get("content") or ""
    parts = [f"Source: {url}", title, body]
    return "\n".join(p for p in parts if p).strip()


def get_multi_url_summary(urls: list[str], db: Session) -> str:
    """
    For each URL, get or extract summary (same as post_get_or_extract_summary); then generate
    a single ~3-minute text summary of all content via Gemini.

    :param urls: List of source URLs (YouTube, X, LinkedIn, news, etc.).
    :param db: Database session for get_or_extract_summary.
    :return: One combined summary text (~3 min when read aloud).
    """
    urls = [u.strip() for u in urls if (u and u.strip())]
    if not urls:
        return "No URLs provided."

    item_contents: list[str] = []
    for url in urls:
        result = get_or_extract_summary(url, db)
        if result is None:
            item_contents.append(f"[Source: {url}]\n(Content could not be extracted or URL not supported.)")
        else:
            item_contents.append(_summary_dict_to_content(result, url))

    if not item_contents:
        return "No content could be extracted from the given URLs."

    return generate_3min_digest_summary(item_contents)
