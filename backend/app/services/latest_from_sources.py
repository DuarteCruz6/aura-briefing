"""
Fetch the latest post / video / article URL for each source a user follows.
Dispatches by source type: YouTube (channel → latest video), RSS (news/podcast → latest item),
X via Nitter RSS, LinkedIn via profile-page scraping.
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


def _fetch_latest_from_linkedin(profile_url: str) -> tuple[LatestItem | None, str | None]:
    """Scrape LinkedIn profile/company page for latest post link (no auth)."""
    url = (profile_url or "").strip()
    if not url:
        return (None, "LinkedIn URL is required")
    if "linkedin.com" not in url.lower():
        return (None, "Invalid LinkedIn URL")

    try:
        from bs4 import BeautifulSoup
    except ImportError:
        return (None, "beautifulsoup4 not installed")

    try:
        with httpx.Client(timeout=15.0, follow_redirects=True) as client:
            r = client.get(
                url,
                headers={"User-Agent": USER_AGENT, "Accept-Language": "en-US,en;q=0.9"},
            )
            r.raise_for_status()
            html = r.text
    except httpx.HTTPStatusError as e:
        return (None, f"LinkedIn returned {e.response.status_code}")
    except Exception as e:
        return (None, f"Failed to fetch LinkedIn: {e}")

    # Login wall or auth redirect
    if "authwall" in html.lower() or "login" in html.lower() and "sign in" in html.lower():
        if "authwall" in html.lower() or html.count("login") > 3:
            return (None, "LinkedIn profile requires login to view posts (use a public profile or RSS bridge)")
    soup = BeautifulSoup(html, "html.parser")

    # Post links: feed/update/urn:li:activity:..., /posts/..., or href containing activity
    post_links: list[tuple[str, str | None]] = []
    for a in soup.find_all("a", href=True):
        href = (a.get("href") or "").strip()
        if not href or not href.startswith("http"):
            href = urljoin(url, href)
        if "linkedin.com" not in href:
            continue
        if "/feed/update/" in href or "/posts/" in href or "urn:li:activity" in href or "activity:" in href:
            title = None
            if a.get_text():
                title = a.get_text().strip()[:200] or None
            post_links.append((href, title))

    # Deduplicate by URL, keep order
    seen: set[str] = set()
    for h, t in post_links:
        if h not in seen:
            seen.add(h)
            return (LatestItem(url=h, title=t, published_at=None), None)

    return (None, "No post links found (profile may be private or page structure changed)")


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
        # Treat as RSS if URL looks like a feed; otherwise we don't scrape arbitrary news homepages
        if _is_rss_url(url):
            latest, err = _fetch_latest_from_rss(url)
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
            error="News source URL should be an RSS/feed URL (e.g. .../feed or .../rss) to fetch latest article",
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
