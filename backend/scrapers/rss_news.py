"""RSS news scraper. Fetches AI news from 8 RSS feeds, last 48 hours only."""

import logging
import re
from datetime import datetime, timezone, timedelta

import html
import feedparser
import httpx

from backend.scrapers.base import BaseScraper, RawTool
from backend.config import SCRAPE_TIMEOUT_SECONDS

logger = logging.getLogger(__name__)

# (label, url) pairs
RSS_FEEDS = [
    ("The Verge AI", "https://www.theverge.com/rss/ai-artificial-intelligence/index.xml"),
    ("TechCrunch AI", "https://techcrunch.com/category/artificial-intelligence/feed/"),
    ("Ars Technica", "https://feeds.arstechnica.com/arstechnica/technology-lab"),
    ("MIT Technology Review", "https://www.technologyreview.com/feed/"),
    ("VentureBeat AI", "https://venturebeat.com/category/ai/feed/"),
    ("Wired AI", "https://www.wired.com/feed/tag/ai/latest/rss"),
    ("OpenAI Blog", "https://openai.com/blog/rss.xml"),
    ("Google AI Blog", "https://blog.google/technology/ai/rss/"),
]

_TAG_RE = re.compile(r"<[^>]+>")
_LOOKBACK_HOURS = 48

_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (compatible; MetisBot/1.0; +https://github.com/kevinhu/metis)"
    )
}


def _strip_html(text: str) -> str:
    """Remove HTML tags, decode entities, and collapse whitespace."""
    if not text:
        return ""
    text = _TAG_RE.sub(" ", text)
    text = html.unescape(text)
    return " ".join(text.split())


def _entry_published_dt(entry) -> datetime | None:
    """Return a timezone-aware datetime for an entry, or None if unparseable."""
    # feedparser populates published_parsed or updated_parsed as time.struct_time (UTC)
    for attr in ("published_parsed", "updated_parsed"):
        t = getattr(entry, attr, None)
        if t is not None:
            try:
                return datetime(*t[:6], tzinfo=timezone.utc)
            except Exception:
                pass
    return None


class RSSNewsScraper(BaseScraper):
    source_name = "rss_news"

    def fetch_raw(self) -> list[RawTool]:
        cutoff = datetime.now(timezone.utc) - timedelta(hours=_LOOKBACK_HOURS)
        tools: list[RawTool] = []

        for label, feed_url in RSS_FEEDS:
            try:
                tools.extend(self._fetch_feed(label, feed_url, cutoff))
            except Exception as e:
                logger.warning(f"RSS feed '{label}' failed: {e}")

        return tools

    def _fetch_feed(self, label: str, feed_url: str, cutoff: datetime) -> list[RawTool]:
        """Fetch and parse a single RSS feed, returning RawTools newer than cutoff."""
        # Use httpx so we can set a custom User-Agent (many feeds block feedparser's default)
        resp = httpx.get(feed_url, headers=_HEADERS, timeout=SCRAPE_TIMEOUT_SECONDS, follow_redirects=True)
        resp.raise_for_status()

        feed = feedparser.parse(resp.content)

        if feed.bozo and not feed.entries:
            logger.warning(f"RSS feed '{label}' parsed with error and has no entries: {feed.bozo_exception}")
            return []

        tools: list[RawTool] = []

        for entry in feed.entries:
            published = _entry_published_dt(entry)
            if published is None or published < cutoff:
                continue

            url = entry.get("link", "").strip()
            title = _strip_html(entry.get("title", "")).strip()
            if not url or not title:
                continue

            # Build description from summary or content
            raw_desc = entry.get("summary", "") or ""
            if not raw_desc and entry.get("content"):
                raw_desc = entry["content"][0].get("value", "")
            description = _strip_html(raw_desc)[:500]

            tools.append(
                RawTool(
                    url=url,
                    title=title,
                    description=description,
                    source_url=feed_url,
                    metrics={
                        "rss_source": feed_url,
                        "rss_label": label,
                        "published": published.isoformat() if published else None,
                    },
                )
            )

        logger.debug(f"RSS feed '{label}': {len(tools)} entries within last {_LOOKBACK_HOURS}h")
        return tools
