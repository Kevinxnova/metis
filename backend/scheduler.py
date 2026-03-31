"""Scraper scheduler. Run all scrapers and report results."""

import logging
from backend.scrapers.github import GitHubScraper
from backend.scrapers.hackernews import HNScraper
from backend.scrapers.producthunt import ProductHuntScraper
from backend.db import init_db

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

SCRAPERS = [
    GitHubScraper(),
    HNScraper(),
    ProductHuntScraper(),
]


def run_all():
    """Run all scrapers and print results."""
    init_db()
    results = []
    for scraper in SCRAPERS:
        logger.info(f"Running {scraper.source_name} scraper...")
        result = scraper.run()
        results.append(result)
        status_emoji = "✓" if result["status"] == "success" else "✗"
        logger.info(
            f"  {status_emoji} {scraper.source_name}: "
            f"{result['tools_found']} found, {result['tools_new']} new, "
            f"{result['tools_deduped']} deduped ({result['duration_ms']}ms)"
        )
        if result["error"]:
            logger.error(f"  Error: {result['error']}")

    total_new = sum(r["tools_new"] for r in results)
    total_found = sum(r["tools_found"] for r in results)
    logger.info(f"Scrape complete: {total_found} total, {total_new} new tools")
    return results


if __name__ == "__main__":
    run_all()
