"""
Fetch articles from Google News RSS based on topic keywords.
Uses the free Google News RSS search: https://news.google.com/rss/search?q=KEYWORD
Google News RSS returns redirect URLs (news.google.com/rss/articles/xxx) - we resolve
them to actual article URLs so get_or_extract_summary can fetch the real content.
"""
from __future__ import annotations

import base64
import re
from urllib.parse import quote_plus, urlparse

import httpx

# User-Agent for Google News (polite scraping); browser-like helps HTML fallback
USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)


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
                # Response format: ...["garturlres","https://real-url.com/..."],...
                idx = resp.text.find('["garturlres","')
                if idx >= 0:
                    start = idx + len('["garturlres","')
                    end = start
                    while end < len(resp.text):
                        c = resp.text[end]
                        if c == "\\" and end + 1 < len(resp.text):
                            end += 2  # skip escaped char
                            continue
                        if c in ('"', ",", "]"):
                            break
                        end += 1
                    res_url = resp.text[start:end].replace("\\u003d", "=").replace("\\/", "/").strip()
                    if res_url.startswith("http") and "news.google.com" not in res_url:
                        return res_url
                # Legacy regex fallback
                idx = resp.text.find("garturlres")
                if idx >= 0:
                    snippet = resp.text[idx : idx + 2000]
                    for pattern in (r'"(https://[^"\\]*(?:\\.[^"\\]*)*)"', r'"(https://[^"]+)"'):
                        match = re.search(pattern, snippet)
                        if match:
                            res_url = match.group(1).replace("\\u003d", "=").replace("\\/", "/")
                            if "news.google.com" not in res_url:
                                return res_url
    except Exception:
        pass
    # Fallback: fetch the Google News article page and extract real URL from HTML
    try:
        res = httpx.get(url, follow_redirects=True, timeout=10.0, headers={"User-Agent": USER_AGENT})
        if res.status_code == 200 and res.url and "news.google.com" not in str(res.url):
            return str(res.url)
        html = res.text if res.status_code == 200 else ""
        if html:
            from bs4 import BeautifulSoup
            soup = BeautifulSoup(html, "html.parser")
            # Prefer canonical if it points to the real article
            canonical = soup.find("link", rel="canonical")
            if canonical and canonical.get("href"):
                h = canonical["href"].strip()
                if h.startswith("http") and "news.google.com" not in h:
                    return h
            # Look for the "Read full story" or first external article link
            for a in soup.find_all("a", href=True):
                h = a["href"].strip()
                if not h.startswith("http"):
                    continue
                try:
                    parsed = urlparse(h)
                    if "google.com" in parsed.netloc or "google." in parsed.netloc:
                        continue
                    if any(x in parsed.path.lower() for x in ("/login", "/signin", "/account", "/search")):
                        continue
                    return h
                except Exception:
                    continue
    except Exception:
        pass
    # Last resort: HTTP redirect (works for some URLs)
    try:
        with httpx.Client(follow_redirects=True, timeout=8.0, headers={"User-Agent": USER_AGENT}) as client:
            r = client.get(url)
            if r.status_code == 200:
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
