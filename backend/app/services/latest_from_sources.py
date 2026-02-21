"""
Fetch the latest post / video / article URL for each source a user follows.
Dispatches by source type: YouTube (channel → latest video), RSS (news/podcast → latest item),
X via Nitter RSS, LinkedIn via Apify (harvestapi/linkedin-profile-posts) or fallback scraping.
"""
from __future__ import annotations

from dataclasses import dataclass
from urllib.parse import urljoin, urlparse

import httpx

from app.models.database.source import Source, SourceType

# Browser-like User-Agent for scraping (LinkedIn, Nitter)
USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; rv:109.0) Gecko/20100101 Firefox/119.0"
)


@dataclass
class LatestItem:
    url: str
    title: str | None
    published_at: str | None


@dataclass
class SourceLatestResult:
    source_id: int
    source_type: str
    source_url: str
    source_name: str | None
    latest: LatestItem | None
    error: str | None


def _is_rss_url(url: str) -> bool:
    url_lower = (url or "").strip().lower()
    return (
        "rss" in url_lower
        or "feed" in url_lower
        or url_lower.endswith(".xml")
        or "/feed/" in url_lower
    )


def _discover_rss_feed(site_url: str) -> str | None:
    """
    Discover RSS/Atom feed from a news site homepage URL.
    Tries: 1) parse page for <link rel="alternate" type="application/rss+xml">,
    2) common paths like /feed, /rss.
    """
    site_url = (site_url or "").strip()
    if not site_url:
        return None
    if "://" not in site_url:
        site_url = "https://" + site_url
    parsed = urlparse(site_url)
    base = f"{parsed.scheme or 'https'}://{parsed.netloc}"

    # 1) Fetch page and look for RSS link in <head>
    try:
        with httpx.Client(timeout=10.0, follow_redirects=True) as client:
            r = client.get(site_url, headers={"User-Agent": USER_AGENT})
            r.raise_for_status()
            html = r.text
    except Exception:
        html = ""

    if html:
        try:
            from bs4 import BeautifulSoup
            soup = BeautifulSoup(html, "html.parser")
            for link in soup.find_all("link", rel=True, href=True):
                rel = (link.get("rel") or "")
                if isinstance(rel, list):
                    rel = " ".join(rel).lower()
                else:
                    rel = str(rel).lower()
                type_ = (link.get("type") or "").lower()
                if "alternate" in rel and ("rss" in type_ or "xml" in type_ or "atom" in type_):
                    href = link.get("href", "").strip()
                    if href:
                        feed_url = urljoin(site_url, href)
                        if feed_url and (_is_rss_url(feed_url) or "xml" in feed_url.lower()):
                            return feed_url
        except Exception:
            pass

    # 2) Try common RSS paths (RTE, BBC, NYT, most news orgs use these)
    common_paths = ["/feed", "/rss", "/feeds", "/feed/", "/rss.xml", "/feed/rss", "/news/feed", "/atom.xml"]
    for path in common_paths:
        candidate = (base.rstrip("/") + path) if path.startswith("/") else f"{base}/{path}"
        try:
            with httpx.Client(timeout=8.0, follow_redirects=True) as client:
                r = client.get(candidate, headers={"User-Agent": USER_AGENT})
                if r.status_code == 200:
                    ct = (r.headers.get("content-type") or "").lower()
                    if "xml" in ct or "rss" in ct or "atom" in ct:
                        return candidate
                    # Some servers don't set content-type correctly; quick sniff
                    text = (r.text or "")[:500]
                    if "<rss" in text.lower() or "<feed" in text.lower() or '<?xml' in text:
                        return candidate
        except Exception:
            pass
    return None


def _fetch_latest_from_rss(feed_url: str) -> tuple[LatestItem | None, str | None]:
    """Parse RSS/Atom feed and return latest entry link and title."""
    try:
        import feedparser
    except ImportError:
        return (None, "feedparser not installed")

    feed_url = (feed_url or "").strip()
    if not feed_url:
        return (None, "Feed URL is required")

    try:
        parsed = feedparser.parse(
            feed_url,
            request_headers={"User-Agent": "AuraBriefing/1.0"},
        )
    except Exception as e:
        return (None, f"Failed to fetch feed: {e}")

    entries = getattr(parsed, "entries", [])
    if not entries:
        return (None, "Feed has no entries")

    entry = entries[0]
    link = entry.get("link") or entry.get("href")
    if not link:
        return (None, "Latest entry has no link")
    title = entry.get("title") or None
    published = None
    for key in ("published", "updated", "created"):
        if key in entry and entry[key]:
            published = entry[key]
            break
    if hasattr(published, "isoformat"):
        published = published.isoformat()

    return (LatestItem(url=link, title=title, published_at=published), None)


def _extract_twitter_username(profile_url: str) -> str | None:
    """Extract username from twitter.com/username or x.com/username."""
    url = (profile_url or "").strip().lower()
    if not url:
        return None
    # twitter.com/username, x.com/username (optional trailing slash and query)
    for domain in ("twitter.com/", "x.com/", "www.twitter.com/", "www.x.com/"):
        if domain in url:
            try:
                parsed = urlparse(url if "://" in url else "https://" + url)
                path = (parsed.path or "").strip("/")
                if path:
                    # first segment is username (ignore /status/123 etc)
                    parts = path.split("/")
                    if parts and parts[0] not in ("search", "hashtag", "intent", "share"):
                        return parts[0]
            except Exception:
                pass
    return None


def _fetch_latest_from_x(profile_url: str) -> tuple[LatestItem | None, str | None]:
    """Fetch latest X/Twitter post via Nitter RSS (no API key)."""
    username = _extract_twitter_username(profile_url)
    if not username:
        return (None, "Invalid X/Twitter profile URL (use https://twitter.com/username or https://x.com/username)")

    try:
        from app.config import settings
        base = (getattr(settings, "nitter_base_url", None) or "").strip().rstrip("/") or "https://nitter.net"
    except Exception:
        base = "https://nitter.net"
    feed_url = f"{base}/{username}/rss"

    try:
        import feedparser
    except ImportError:
        return (None, "feedparser not installed")

    try:
        parsed = feedparser.parse(
            feed_url,
            request_headers={"User-Agent": USER_AGENT},
        )
    except Exception as e:
        return (None, f"Nitter feed failed: {e}")

    entries = getattr(parsed, "entries", [])
    if not entries:
        return (None, "No posts in feed or Nitter instance unavailable (try another NITTER_BASE_URL)")

    entry = entries[0]
    link = entry.get("link") or entry.get("href")
    if not link:
        return (None, "Latest entry has no link")
    # Nitter RSS often has nitter links; convert to real twitter/x URL if desired (optional)
    title = entry.get("title") or None
    published = None
    for key in ("published", "updated", "created"):
        if key in entry and entry[key]:
            published = entry[key]
            break
    if hasattr(published, "isoformat"):
        published = published.isoformat()

    return (LatestItem(url=link, title=title, published_at=published), None)


# Apify actor for LinkedIn profile posts (HarvestAPI - no cookies, pay per result)
APIFY_LINKEDIN_ACTOR_ID = "harvestapi~linkedin-profile-posts"


def _fetch_latest_from_linkedin_apify(profile_url: str, api_token: str) -> tuple[LatestItem | None, str | None]:
    """Fetch latest LinkedIn post via Apify (harvestapi/linkedin-profile-posts). No cookies needed."""
    url = (profile_url or "").strip()
    if not url or "linkedin.com" not in url.lower():
        return (None, "Invalid LinkedIn profile URL")
    if _is_rss_url(url):
        return (None, "Use RSS fetcher for feed URLs")

    api_url = (
        f"https://api.apify.com/v2/acts/{APIFY_LINKEDIN_ACTOR_ID}/run-sync-get-dataset-items"
        f"?token={api_token}&timeout=120&limit=1"
    )
    payload = {"targetUrls": [url], "maxPosts": 1}
    try:
        with httpx.Client(timeout=130.0) as client:
            r = client.post(api_url, json=payload)
            r.raise_for_status()
            data = r.json()
    except httpx.HTTPStatusError as e:
        body = e.response.text
        if e.response.status_code == 401:
            return (None, "Apify API token invalid or missing (set APIFY_API_TOKEN)")
        if e.response.status_code in (400, 402, 408):
            return (None, f"Apify: {body[:200]}" if body else str(e))
        return (None, f"Apify returned {e.response.status_code}: {body[:200]}")
    except Exception as e:
        return (None, f"Apify request failed: {e}")

    if not isinstance(data, list) or len(data) == 0:
        return (None, "No posts returned for this profile")
    item = data[0]
    post_url = item.get("linkedinUrl") or item.get("url")
    if not post_url:
        return (None, "Apify result had no post URL")
    title = (item.get("content") or "")[:300].strip() or None
    published = None
    posted = item.get("postedAt")
    if isinstance(posted, dict) and posted.get("date"):
        published = posted["date"]
    elif isinstance(posted, str):
        published = posted
    return (LatestItem(url=post_url, title=title or None, published_at=published), None)


def _fetch_latest_from_linkedin(profile_url: str) -> tuple[LatestItem | None, str | None]:
    """Fetch latest LinkedIn post: try Apify first if APIFY_API_TOKEN set, else RSS (if feed URL), else scrape."""
    url = (profile_url or "").strip()
    if not url:
        return (None, "LinkedIn URL is required")
    # 1) Apify (no cookies, works for any profile)
    try:
        from app.config import settings
        token = (getattr(settings, "apify_api_token", None) or "").strip()
        if token:
            latest, err = _fetch_latest_from_linkedin_apify(url, token)
            if err is None:
                return (latest, None)
            # Apify failed; fall through to RSS/scrape
    except Exception:
        pass
    # 2) If URL is an RSS feed, use it
    if _is_rss_url(url):
        return _fetch_latest_from_rss(url)
    if "linkedin.com" not in url.lower():
        return (None, "Invalid LinkedIn URL")
    # 3) Fallback: scrape with optional cookies (if you added cookie storage later)
    try:
        from bs4 import BeautifulSoup
    except ImportError:
        return (None, "beautifulsoup4 not installed. Set APIFY_API_TOKEN for LinkedIn (recommended).")

    headers = {"User-Agent": USER_AGENT, "Accept-Language": "en-US,en;q=0.9"}
    try:
        with httpx.Client(timeout=15.0, follow_redirects=True) as client:
            r = client.get(url, headers=headers)
            r.raise_for_status()
            html = r.text
    except httpx.HTTPStatusError as e:
        return (None, f"LinkedIn returned {e.response.status_code}. Set APIFY_API_TOKEN to use Apify instead.")
    except Exception as e:
        return (None, f"Failed to fetch LinkedIn: {e}")

    lower = html.lower()
    if "authwall" in lower or ("sign in" in lower and "feed/update" not in lower and "activity:" not in lower):
        return (None, "LinkedIn requires login. Set APIFY_API_TOKEN (Apify) to fetch without cookies.")
    soup = BeautifulSoup(html, "html.parser")
    post_links: list[tuple[str, str | None]] = []
    for a in soup.find_all("a", href=True):
        href = (a.get("href") or "").strip()
        if not href or not href.startswith("http"):
            href = urljoin(url, href)
        if "linkedin.com" not in href:
            continue
        if "/feed/update/" in href or "/posts/" in href or "urn:li:activity" in href or "activity:" in href:
            title = a.get_text().strip()[:200] if a.get_text() else None
            post_links.append((href, title))
    seen: set[str] = set()
    for h, t in post_links:
        if h not in seen:
            seen.add(h)
            return (LatestItem(url=h, title=t, published_at=None), None)
    return (None, "No post links found. Set APIFY_API_TOKEN to use Apify for LinkedIn.")


def _fetch_latest_youtube(channel_url: str) -> tuple[LatestItem | None, str | None]:
    from app.models.scrapper.youtube_audio_extractor import get_latest_video_from_channel

    result, err = get_latest_video_from_channel(channel_url)
    if err:
        return (None, err)
    if not result:
        return (None, "No latest video")
    return (
        LatestItem(
            url=result["url"],
            title=result.get("title"),
            published_at=result.get("published_at"),
        ),
        None,
    )


def fetch_latest_for_source(source: Source) -> SourceLatestResult:
    """
    For a single Source, fetch the latest item URL (and optional title/published).
    Returns a SourceLatestResult with either latest or error set.
    """
    st = source.type
    url = (source.url or "").strip()

    if st == SourceType.YOUTUBE:
        # Channel URL → latest video
        latest, err = _fetch_latest_youtube(url)
        return SourceLatestResult(
            source_id=source.id,
            source_type=st.value,
            source_url=url,
            source_name=source.name,
            latest=latest,
            error=err,
        )

    if st == SourceType.NEWS or st == SourceType.PODCAST:
        # Use RSS: direct feed URL, or auto-discover from news site homepage
        feed_url = url
        if not _is_rss_url(url):
            feed_url = _discover_rss_feed(url)
            if not feed_url:
                return SourceLatestResult(
                    source_id=source.id,
                    source_type=st.value,
                    source_url=url,
                    source_name=source.name,
                    latest=None,
                    error="Could not find RSS feed for this URL. Try adding the site's feed URL directly (e.g. site.com/feed or /rss).",
                )
        latest, err = _fetch_latest_from_rss(feed_url)
        return SourceLatestResult(
            source_id=source.id,
            source_type=st.value,
            source_url=url,
            source_name=source.name,
            latest=latest,
            error=err,
        )

    if st == SourceType.X:
        latest, err = _fetch_latest_from_x(url)
        return SourceLatestResult(
            source_id=source.id,
            source_type=st.value,
            source_url=url,
            source_name=source.name,
            latest=latest,
            error=err,
        )

    if st == SourceType.LINKEDIN:
        latest, err = _fetch_latest_from_linkedin(url)
        return SourceLatestResult(
            source_id=source.id,
            source_type=st.value,
            source_url=url,
            source_name=source.name,
            latest=latest,
            error=err,
        )

    return SourceLatestResult(
        source_id=source.id,
        source_type=st.value,
        source_url=url,
        source_name=source.name,
        latest=None,
        error=f"Unsupported source type: {st.value}",
    )


def fetch_latest_for_sources(sources: list[Source]) -> list[dict]:
    """
    For each source, fetch latest item. Returns a list of dicts suitable for JSON response.
    """
    results = []
    for source in sources:
        r = fetch_latest_for_source(source)
        latest_dict = None
        if r.latest:
            latest_dict = {
                "url": r.latest.url,
                "title": r.latest.title,
                "published_at": r.latest.published_at,
            }
        results.append(
            {
                "source_id": r.source_id,
                "source_type": r.source_type,
                "source_url": r.source_url,
                "source_name": r.source_name,
                "latest": latest_dict,
                "error": r.error,
            }
        )
    return results
