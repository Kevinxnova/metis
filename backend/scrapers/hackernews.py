"""Hacker News scraper. Uses the official Firebase API."""

import logging
import httpx
from backend.scrapers.base import BaseScraper, RawTool
from backend.config import SCRAPE_TIMEOUT_SECONDS, HN_MIN_POINTS, HN_MAX_STORIES

logger = logging.getLogger(__name__)

HN_API = "https://hacker-news.firebaseio.com/v0"


class HNScraper(BaseScraper):
    source_name = "hackernews"

    def fetch_raw(self) -> list[RawTool]:
        tools = []

        # Fetch Show HN and top stories
        for endpoint in ["showstories", "topstories"]:
            try:
                resp = httpx.get(f"{HN_API}/{endpoint}.json", timeout=SCRAPE_TIMEOUT_SECONDS)
                resp.raise_for_status()
                story_ids = resp.json()[:HN_MAX_STORIES]

                for story_id in story_ids:
                    tool = self._fetch_story(story_id, is_show_hn=(endpoint == "showstories"))
                    if tool:
                        tools.append(tool)

            except Exception as e:
                logger.warning(f"HN {endpoint} fetch failed: {e}")

        return tools

    def _fetch_story(self, story_id: int, is_show_hn: bool) -> RawTool | None:
        try:
            resp = httpx.get(f"{HN_API}/item/{story_id}.json", timeout=SCRAPE_TIMEOUT_SECONDS)
            resp.raise_for_status()
            item = resp.json()

            if not item or item.get("dead") or item.get("deleted"):
                return None

            points = item.get("score", 0)
            if points < HN_MIN_POINTS:
                return None

            title = item.get("title", "")
            url = item.get("url", "")

            # Text-only posts (no URL) — use HN item page
            if not url:
                url = f"https://news.ycombinator.com/item?id={story_id}"

            # For Show HN, clean the title prefix
            if is_show_hn and title.startswith("Show HN:"):
                title = title[len("Show HN:"):].strip()

            return RawTool(
                url=url,
                title=title,
                description=item.get("text", "")[:500] if item.get("text") else "",
                source_url=f"https://news.ycombinator.com/item?id={story_id}",
                metrics={
                    "points": points,
                    "comments": item.get("descendants", 0),
                    "is_show_hn": is_show_hn,
                },
            )
        except Exception as e:
            logger.debug(f"Failed to fetch HN story {story_id}: {e}")
            return None
