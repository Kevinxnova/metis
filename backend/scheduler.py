"""Scraper scheduler. Run all scrapers and report results."""

import logging
from dotenv import load_dotenv

load_dotenv()

from backend.scrapers.github import GitHubScraper
from backend.scrapers.hackernews import HNScraper
from backend.scrapers.producthunt import ProductHuntScraper
from backend.scrapers.rss_news import RSSNewsScraper
from backend.db import init_db

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

SCRAPERS = [
    GitHubScraper(),
    HNScraper(),
    ProductHuntScraper(),
    RSSNewsScraper(),
]


def run_all():
    """Run all scrapers and trigger AI recommendations if new tools were found."""
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

    if total_new > 0:
        logger.info(f"New tools found, running categorization...")
        from backend.ai_recommend import categorize_tools, summarize_tools
        from backend.db import get_db

        # 获取今日新增且尚未分类的工具 ID
        with get_db() as db:
            rows = db.execute(
                "SELECT id FROM tools WHERE date(first_seen) = date('now') AND discovery_category IS NULL"
            ).fetchall()
        new_ids = [r[0] for r in rows]

        if new_ids:
            logger.info(f"Categorizing {len(new_ids)} new tools...")
            n_cat, _ = categorize_tools(new_ids)
            logger.info(f"Categorized {n_cat} tools")

        # 概要：已分类但缺 short_summary 的
        with get_db() as db:
            rows = db.execute(
                "SELECT id FROM tools WHERE date(first_seen) = date('now') AND short_summary IS NULL AND discovery_category IS NOT NULL"
            ).fetchall()
        sum_ids = [r[0] for r in rows]

        if sum_ids:
            logger.info(f"Summarizing {len(sum_ids)} tools...")
            n_sum, _ = summarize_tools(sum_ids)
            logger.info(f"Summarized {n_sum} tools")

    # Note: daily_news and recommendations are handled by cron.py after run_all()
    return results


if __name__ == "__main__":
    run_all()
