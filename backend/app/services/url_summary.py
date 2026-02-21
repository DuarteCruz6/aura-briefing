"""
Get summary by URL: return from DB if present, otherwise extract and save.
Uses the same table (extracted_summaries) for YouTube and text URLs (X, LinkedIn, news).
"""
import json
import os

from sqlalchemy.orm import Session

from app.models.database import ExtractedSummary


def _is_youtube_url(url: str) -> bool:
    url_lower = (url or "").strip().lower()
    return "youtube.com" in url_lower or "youtu.be" in url_lower


def extract_from_other_url(url: str, output_dir: str = ".") -> dict | None:
    """
    Extract main text content from a non-YouTube URL (X, LinkedIn, news, etc.)
    using the text_content_extractor (fetch + Gemini).
    """
    from app.models.scrapper.text_content_extractor import extract_text_content
    return extract_text_content(url)


def get_or_extract_summary(url: str, db: Session, *, output_dir: str | None = None) -> dict | None:
    """
    Return summary JSON for the given URL.
    - If the URL is already in the database, return the saved JSON (as dict).
    - If not: extract (YouTube via existing transcription, others via extract_from_other_url),
      save to the database, and return the result.
    Returns None only if extraction fails (e.g. unsupported URL and placeholder returns None).
    """
    url = (url or "").strip()
    if not url:
        return None

    # Already saved?
    row = db.query(ExtractedSummary).filter(ExtractedSummary.source_url == url).first()
    if row:
        return json.loads(row.summary_json)

    # Extract
    out_dir = output_dir or os.path.join("/tmp", "transcribe")
    os.makedirs(out_dir, exist_ok=True)

    if _is_youtube_url(url):
        from app.models.transcription import youtube_url_to_text
        result = youtube_url_to_text(url, out_dir)
    else:
        result = extract_from_other_url(url, out_dir)

    if result is None:
        return None

    # Save
    summary_json = json.dumps(result, ensure_ascii=False)
    existing = db.query(ExtractedSummary).filter(ExtractedSummary.source_url == url).first()
    if existing:
        existing.summary_json = summary_json
    else:
        db.add(ExtractedSummary(source_url=url, summary_json=summary_json))
    db.commit()

    return result
