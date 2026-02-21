#!/usr/bin/env python3
"""
Extract main text content from text-based URLs (X/Twitter, LinkedIn, news articles).
Fetches the page and uses Gemini to extract title + main body. No audio.

Import: from app.models.scrapper.text_content_extractor import extract_text_content
CLI: python -m app.models.scrapper.text_content_extractor <url>
"""

import json
import os
import re
import sys


# Max chars of HTML/text to send to Gemini (to stay within context and save tokens)
MAX_INPUT_CHARS = 80_000

# User-Agent so we get desktop HTML; some sites serve different content for bots
USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; rv:91.0) Gecko/20100101 Firefox/91.0"
)


def _get_gemini_api_key() -> str:
    try:
        from app.config import settings
        key = getattr(settings, "gemini_api_key", None) or ""
    except Exception:
        key = os.getenv("GEMINI_API_KEY", "")
    if not key:
        raise ValueError("GEMINI_API_KEY is not set (env or app config)")
    return key


def _fetch_html(url: str) -> str | None:
    """Fetch URL and return response text, or None on failure."""
    try:
        import httpx
    except ImportError as e:
        raise ImportError("httpx is required. Install with: pip install httpx") from e
    try:
        with httpx.Client(
            follow_redirects=True,
            timeout=20.0,
            headers={"User-Agent": USER_AGENT},
        ) as client:
            r = client.get(url)
            r.raise_for_status()
            return r.text
    except Exception:
        return None


def _strip_html_to_text(html: str) -> str:
    """Remove script/style, then tags; collapse whitespace."""
    if not html:
        return ""
    # Remove script and style blocks and their content
    html = re.sub(r"<script[^>]*>.*?</script>", " ", html, flags=re.DOTALL | re.IGNORECASE)
    html = re.sub(r"<style[^>]*>.*?</style>", " ", html, flags=re.DOTALL | re.IGNORECASE)
    # Replace tags with space
    html = re.sub(r"<[^>]+>", " ", html)
    # Decode common entities
    html = html.replace("&nbsp;", " ").replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">").replace("&quot;", '"')
    # Collapse whitespace
    text = re.sub(r"\s+", " ", html).strip()
    return text


def _extract_with_gemini(raw_text: str, url: str, *, api_key: str, model: str = "gemini-1.5-flash") -> dict | None:
    """Use Gemini to extract title and main text from raw page text."""
    import google.generativeai as genai
    genai.configure(api_key=api_key)
    prompt = """You are given raw text extracted from a web page (could be a news article, a post from X/Twitter, LinkedIn, or similar).
Extract ONLY the main content: the post body, article body, or primary text. No navigation, ads, cookie notices, or menus.
Also extract a short title (e.g. headline or first line of the post).
Return valid JSON with exactly these two keys:
- "title": string (short title)
- "text": string (full main text, cleaned)

If there is no meaningful content, return {"title": "", "text": ""}.
Output only the JSON object, no markdown or explanation."""

    truncated = raw_text[:MAX_INPUT_CHARS] if len(raw_text) > MAX_INPUT_CHARS else raw_text
    if not truncated.strip():
        return {"title": "", "text": ""}

    gemini_model = genai.GenerativeModel(model)
    response = gemini_model.generate_content(
        f"{prompt}\n\nURL: {url}\n\nPage text:\n\n{truncated}",
        generation_config={"max_output_tokens": 8192},
    )
    out = (response.text or "").strip()
    if not out:
        return None
    # Remove optional markdown code fence
    if out.startswith("```"):
        out = re.sub(r"^```(?:json)?\s*", "", out)
        out = re.sub(r"\s*```$", "", out)
    try:
        data = json.loads(out)
        return {"title": data.get("title", ""), "text": data.get("text", "")}
    except json.JSONDecodeError:
        return None


def extract_text_content(
    url: str,
    *,
    api_key: str | None = None,
    model: str = "gemini-1.5-flash",
) -> dict | None:
    """
    Fetch a text-based URL (X, LinkedIn, news, etc.) and extract main content using Gemini.

    Args:
        url: Full URL of the page (e.g. X post, LinkedIn post, article).
        api_key: Gemini API key. If None, uses app config or GEMINI_API_KEY env.
        model: Gemini model (default gemini-1.5-flash).

    Returns:
        Dict with "title", "text", and "url". None if fetch or extraction failed.
    """
    url = (url or "").strip()
    if not url:
        return None
    key = api_key or _get_gemini_api_key()
    html = _fetch_html(url)
    if html is None:
        return None
    raw_text = _strip_html_to_text(html)
    extracted = _extract_with_gemini(raw_text, url, api_key=key, model=model)
    if extracted is None:
        return None
    extracted["url"] = url
    return extracted


def main() -> None:
    if len(sys.argv) > 1:
        url = sys.argv[1].strip()
    else:
        url = input("Enter URL (X, LinkedIn, or news article): ").strip()

    if not url:
        print("No URL provided.", file=sys.stderr)
        sys.exit(1)

    # Load .env when run as CLI if present
    try:
        from pathlib import Path
        env_path = Path(__file__).resolve().parent.parent.parent.parent / ".env"
        if env_path.is_file():
            from dotenv import load_dotenv
            load_dotenv(env_path)
    except Exception:
        pass

    print(f"Fetching and extracting text from: {url}", file=sys.stderr)
    try:
        result = extract_text_content(url)
    except ValueError as e:
        print(str(e), file=sys.stderr)
        sys.exit(1)
    except ImportError as e:
        print(str(e), file=sys.stderr)
        sys.exit(1)

    if result:
        print(json.dumps(result, ensure_ascii=False, indent=2))
    else:
        print(json.dumps({"error": "Fetch or extraction failed."}), file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
