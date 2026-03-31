"""Product Hunt scraper. Uses the GraphQL API."""

import logging
import httpx
from backend.scrapers.base import BaseScraper, RawTool
from backend.config import PRODUCTHUNT_API_TOKEN, SCRAPE_TIMEOUT_SECONDS

logger = logging.getLogger(__name__)

PH_API = "https://api.producthunt.com/v2/api/graphql"

QUERY = """
query {
  posts(order: VOTES, first: 30) {
    edges {
      node {
        id
        name
        tagline
        description
        url
        website
        votesCount
        commentsCount
        topics {
          edges {
            node {
              name
            }
          }
        }
      }
    }
  }
}
"""


class ProductHuntScraper(BaseScraper):
    source_name = "producthunt"

    def fetch_raw(self) -> list[RawTool]:
        if not PRODUCTHUNT_API_TOKEN:
            logger.warning("No PRODUCTHUNT_API_TOKEN set, skipping Product Hunt scrape")
            return []

        try:
            resp = httpx.post(
                PH_API,
                json={"query": QUERY},
                headers={
                    "Authorization": f"Bearer {PRODUCTHUNT_API_TOKEN}",
                    "Content-Type": "application/json",
                },
                timeout=SCRAPE_TIMEOUT_SECONDS,
            )
            resp.raise_for_status()
            data = resp.json()

            tools = []
            edges = data.get("data", {}).get("posts", {}).get("edges", [])

            for edge in edges:
                node = edge["node"]
                website = node.get("website") or node.get("url", "")
                topics = [t["node"]["name"] for t in node.get("topics", {}).get("edges", [])]

                tools.append(RawTool(
                    url=website,
                    title=node["name"],
                    description=node.get("tagline", "") or node.get("description", "")[:300],
                    source_url=node.get("url", ""),
                    metrics={
                        "votes": node.get("votesCount", 0),
                        "comments": node.get("commentsCount", 0),
                        "topics": topics,
                    },
                ))

            return tools

        except Exception as e:
            logger.error(f"Product Hunt scrape failed: {e}")
            raise
