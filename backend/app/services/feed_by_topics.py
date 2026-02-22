"""
Fetch articles from Google News RSS based on topic keywords.
Uses the free Google News RSS search: https://news.google.com/rss/search?q=KEYWORD
Google News RSS returns redirect URLs (news.google.com/rss/articles/xxx) - we resolve
them to actual article URLs so get_or_extract_summary can fetch the real content.
"""
from __future__ import annotations

import base64
import re
from urllib.parse import quote_plus

import httpx

# User-Agent for Google News (polite scraping)
USER_AGENT = "AuraBriefing/1.0 (Feed Reader; +https://github.com)"


def resolve_google_news_url(url: str) -> str:
    """
    Resolve news.google.com/rss/articles/xxx to the real article URL.
    Google News URLs don't redirect via HTTP - they need decoding or batchexecute API.
    Returns original url if resolution fails.
    """
    url = (url or "").strip()
    if not url or "news.google.com" not in url or "/rss/articles/" not in url:
        return url
    path = url.split("?")[0]
    parts = path.rstrip("/").split("/")
    if len(parts) < 2 or parts[-2] != "articles":
        return url
    encoded = parts[-1]
    if not re.match(r"^[A-Za-z0-9_-]+=*$", encoded):
        return url
    try:
        padded = encoded + "==="
        decoded = base64.urlsafe_b64decode(padded)
    except Exception:
        return url
    # Old format: prefix 0x08 0x13 0x22, then len+url, suffix 0xd2 0x01 0x00
    prefix = bytes([0x08, 0x13, 0x22])
    if not decoded.startswith(prefix):
        return url
    rest = decoded[len(prefix) :]
    suffix = bytes([0xD2, 0x01, 0x00])
    if rest.endswith(suffix):
        rest = rest[: -len(suffix)]
    if len(rest) < 2:
        return url
    n = rest[0]
    if n >= 0x80 and len(rest) >= 2:
        n = rest[1] + (n & 0x7F) * 128
        chunk = rest[2 : 2 + n]
    else:
        chunk = rest[1 : 1 + n]
    try:
        result = chunk.decode("utf-8")
        if result.startswith("http://") or result.startswith("https://"):
            return result
    except Exception:
        pass
    # New format (AU_yqL...) - try batchexecute API
    try:
        rest_str = decoded[len(prefix) : len(prefix) + 8].decode("utf-8", errors="replace")
        if "AU_yq" in rest_str or rest_str.startswith("AU"):
            req_body = (
                '[[["Fbv4je","[\\"garturlreq\\",[[\\"en-US\\",\\"US\\",[\\"WEB_TEST_1_0\\"],null,null,1,1,\\"US:en\\",null,180,null,null,null,null,null,0,null,null,[0,0]],\\"en-US\\",\\"US\\",1,[2,3,4,8],1,0,\\"655000234\\",0,0,null,0],\\"'
                + encoded
                + '\\"]",null,"generic"]]]'
            )
            resp = httpx.post(
                "https://news.google.com/_/DotsSplashUi/data/batchexecute?rpcids=Fbv4je",
                headers={
                    "Content-Type": "application/x-www-form-urlencoded;charset=utf-8",
                    "Referer": "https://news.google.com/",
                    "User-Agent": USER_AGENT,
                },
                content=f"f.req={quote_plus(req_body)}",
                timeout=10.0,
            )
            if resp.status_code == 200 and "garturlres" in resp.text:
                idx = resp.text.find("garturlres")
                if idx >= 0:
                    snippet = resp.text[idx : idx + 2000]
                    # URL may be in "https://...\" or "https://...",
                    match = re.search(r'"(https://[^"\\]*(?:\\.[^"\\]*)*)"', snippet)
                    if match:
                        res_url = match.group(1).replace('\\"', '"').replace("\\u003d", "=").replace("\\/", "/")
                        if "news.google.com" not in res_url:
                            return res_url
                    match = re.search(r'"(https://[^"]+)"', snippet)
                    if match:
                        res_url = match.group(1).replace("\\u003d", "=").replace("\\/", "/")
                        if "news.google.com" not in res_url:
                            return res_url
    except Exception:
        pass
    # Fallback: fetch the article page and extract real URL from redirect / HTML / JS
    try:
        with httpx.Client(follow_redirects=True, timeout=10.0, headers={"User-Agent": USER_AGENT}) as client:
            r = client.get(url)
            if r.status_code != 200:
                raise ValueError("non-200")
            text = r.text or ""
            # 1. data-n-url (common on Google News intermediate pages)
            match = re.search(r'data-n-url="([^"]+)"', text)
            if match:
                res_url = match.group(1).strip()
                if res_url.startswith("http") and "news.google.com" not in res_url:
                    return res_url
            # 2. JavaScript window.location redirect
            match = re.search(r'window\.location\.replace\([\'"]([^\'"]+)[\'"]\)', text)
            if match:
                res_url = match.group(1).strip()
                if res_url.startswith("http") and "news.google.com" not in res_url:
                    return res_url
            # 3. Standard HTTP redirect (if we ended up on a different host)
            final = str(r.url)
            if final.startswith("http") and "news.google.com" not in final:
                return final
    except Exception:
        pass
    return url


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
