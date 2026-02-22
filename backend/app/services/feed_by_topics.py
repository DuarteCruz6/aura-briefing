"""
Fetch articles from Google News RSS based on topic keywords.
Uses the free Google News RSS search: https://news.google.com/rss/search?q=KEYWORD
Google News RSS returns redirect URLs (news.google.com/rss/articles/xxx) - we resolve
them to actual article URLs so get_or_extract_summary can fetch the real content.
"""
from __future__ import annotations

from urllib.parse import quote_plus

try:
    from googlenewsdecoder import gnewsdecoder
except ImportError:
    gnewsdecoder = None  # optional: app works without it, URLs stay unresolved

# User-Agent for Google News (polite scraping)
USER_AGENT = "AuraBriefing/1.0 (Feed Reader; +https://github.com)"


def resolve_google_news_url(link: str) -> str:
    """
    Resolve news.google.com URLs to the real article URL using googlenewsdecoder.
    The library handles timeouts, proxies, and different formats internally.
    Returns original link if resolution fails or package is not installed.
    """
    if gnewsdecoder is None:
        return link
    try:
        decoded = gnewsdecoder(link)
        if decoded.get("status"):
            return decoded["decoded_url"]
    except Exception:
        pass
    return link


def _build_google_news_rss_url(topic: str, hl: str = "en-US", gl: str = "US", ceid: str = "US:en") -> str:
    """Build Google News RSS search URL for a topic."""
    q = quote_plus((topic or "").strip())
    if not q:
        return ""
    return f"https://news.google.com/rss/search?q={q}&hl={hl}&gl={gl}&ceid={ceid}"


def fetch_articles_for_topic(
    topic: str,
    max_articles: int = 10,
    hl: str = "en-US",
    gl: str = "US",
) -> list[dict]:
    """
    Fetch articles from Google News RSS for a single topic.
    Returns list of {url, title, published_at, source}.
    """
    topic = (topic or "").strip()
    if not topic:
        return []
    try:
        import feedparser
    except ImportError:
        return []
    url = _build_google_news_rss_url(topic, hl=hl, gl=gl)
    if not url:
        return []
    try:
        parsed = feedparser.parse(url, request_headers={"User-Agent": USER_AGENT})
    except Exception:
        return []
    entries = getattr(parsed, "entries", [])[:max_articles]
    results = []
    for entry in entries:
        link = entry.get("link") or entry.get("href")
        if not link:
            continue
        link = resolve_google_news_url(link)
        title = entry.get("title") or ""
        published = None
        for key in ("published", "updated", "created"):
            if key in entry and entry[key]:
                p = entry[key]
                published = p.isoformat() if hasattr(p, "isoformat") else str(p)
                break
        source = (entry.get("source") or {}).get("title") if isinstance(entry.get("source"), dict) else None
        results.append({"url": link, "title": title, "published_at": published, "source": source})
    return results


def fetch_articles_by_topics(
    topics: list[str],
    max_per_topic: int = 5,
    hl: str = "en-US",
    gl: str = "US",
) -> list[dict]:
    """
    Fetch articles for each topic. Returns list of {topic, articles: [{url, title, published_at, source}]}.
    """
    if not topics:
        return []
    result = []
    seen_urls: set[str] = set()
    for topic in topics:
        topic = (topic or "").strip()
        if not topic:
            continue
        articles = fetch_articles_for_topic(topic, max_articles=max_per_topic, hl=hl, gl=gl)
        # Dedupe by URL across topics
        deduped = []
        for a in articles:
            u = (a.get("url") or "").strip()
            if u and u not in seen_urls:
                seen_urls.add(u)
                deduped.append(a)
        result.append({"topic": topic, "articles": deduped})
    
    return result
