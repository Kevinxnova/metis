"""Shared cron task functions. Each task is self-contained with logging."""

import json
import logging
import time
from datetime import date

from backend.db import init_db, get_db
from backend.db.queries import (
    log_cron_run, get_daily_news, get_unclassified_tools,
    save_classification, get_untranslated_tools, save_translation,
    get_daily_digest,
)

logger = logging.getLogger(__name__)


def task_scrape() -> dict:
    """Run all scrapers. Returns status dict."""
    init_db()
    today = date.today().isoformat()
    start = time.time()
    steps = {}

    try:
        # Skip if already scraped today
        with get_db() as db:
            tool_count = db.execute(
                "SELECT COUNT(*) FROM tools WHERE date(first_seen) = ?", (today,)
            ).fetchone()[0]

        if tool_count > 0:
            steps["skip_reason"] = f"Already have {tool_count} tools for {today}"
            log_cron_run(today, "scrape", "skipped", steps=steps,
                         duration_seconds=time.time() - start,
                         metadata={"tools_existing": tool_count})
            return {"status": "skipped", "tools_existing": tool_count}

        from backend.scrapers.github import GitHubScraper
        from backend.scrapers.hackernews import HNScraper
        from backend.scrapers.producthunt import ProductHuntScraper
        from backend.scrapers.rss_news import RSSNewsScraper

        total_new = 0
        total_found = 0
        for scraper in [GitHubScraper(), HNScraper(), ProductHuntScraper(), RSSNewsScraper()]:
            s_start = time.time()
            try:
                result = scraper.run()
                steps[scraper.source_name] = {
                    "status": result["status"],
                    "found": result["tools_found"],
                    "new": result["tools_new"],
                    "deduped": result["tools_deduped"],
                    "duration_s": round(time.time() - s_start, 1),
                    "error": result.get("error"),
                }
                total_new += result["tools_new"]
                total_found += result["tools_found"]
            except Exception as e:
                steps[scraper.source_name] = {
                    "status": "error",
                    "error": str(e),
                    "duration_s": round(time.time() - s_start, 1),
                }

        # Run categorization for new tools
        if total_new > 0:
            try:
                from backend.ai_recommend import categorize_and_summarize
                with get_db() as db:
                    rows = db.execute(
                        "SELECT id FROM tools WHERE date(first_seen) = ? AND short_summary IS NULL",
                        (today,)
                    ).fetchall()
                new_ids = [r[0] for r in rows]
                if new_ids:
                    n = categorize_and_summarize(new_ids)
                    steps["categorize"] = {"count": n}
            except Exception as e:
                steps["categorize"] = {"error": str(e)}

        elapsed = time.time() - start
        log_cron_run(today, "scrape", "success", steps=steps,
                     duration_seconds=elapsed,
                     metadata={"total_found": total_found, "total_new": total_new})
        return {"status": "success", "total_found": total_found, "total_new": total_new, "steps": steps}

    except Exception as e:
        elapsed = time.time() - start
        log_cron_run(today, "scrape", "error", steps=steps,
                     error_message=str(e), duration_seconds=elapsed)
        return {"status": "error", "error": str(e)}


def task_daily_news() -> dict:
    """Generate daily news. Returns status dict."""
    init_db()
    today = date.today().isoformat()
    start = time.time()
    steps = {}

    try:
        # Check if already exists
        existing = get_daily_news(today)
        if existing:
            steps["skip_reason"] = "Already generated"
            log_cron_run(today, "daily_news", "skipped", steps=steps,
                         duration_seconds=time.time() - start)
            return {"status": "skipped", "reason": "already_exists"}

        # Check if we have enough data
        with get_db() as db:
            tool_count = db.execute(
                "SELECT COUNT(*) FROM tools WHERE date(first_seen) = ?", (today,)
            ).fetchone()[0]
        steps["tools_available"] = tool_count

        if tool_count == 0:
            steps["skip_reason"] = "No tools scraped yet"
            log_cron_run(today, "daily_news", "skipped", steps=steps,
                         duration_seconds=time.time() - start)
            return {"status": "skipped", "reason": "no_tools"}

        from backend.daily_news import generate_daily_news
        result = generate_daily_news(target_date=today, force=False)

        elapsed = time.time() - start
        if result:
            headline_count = len(result.get("headlines", []))
            steps["headlines"] = headline_count
            steps["quick_bites"] = len(result.get("quick_bites", []))
            log_cron_run(today, "daily_news", "success", steps=steps,
                         duration_seconds=elapsed,
                         metadata={"headlines": headline_count})
            return {"status": "success", "headlines": headline_count}
        else:
            log_cron_run(today, "daily_news", "error", steps=steps,
                         error_message="generate_daily_news returned None",
                         duration_seconds=elapsed)
            return {"status": "error", "error": "generation returned None"}

    except Exception as e:
        elapsed = time.time() - start
        log_cron_run(today, "daily_news", "error", steps=steps,
                     error_message=str(e), duration_seconds=elapsed)
        return {"status": "error", "error": str(e)}


def task_classify() -> dict:
    """Classify and translate unprocessed tools. Returns status dict."""
    init_db()
    today = date.today().isoformat()
    start = time.time()
    steps = {"classified": 0, "translated": 0}

    try:
        from backend.classifier import classify_tool

        for tool in get_unclassified_tools(limit=100):
            if time.time() - start > 500:  # Leave buffer
                break
            try:
                ct, domain = classify_tool(tool)
                save_classification(tool["id"], ct, domain)
                steps["classified"] += 1
            except Exception as e:
                steps.setdefault("classify_errors", []).append(
                    {"id": tool["id"], "error": str(e)})

        from backend.translate import translate_tool
        for tool in get_untranslated_tools(limit=100):
            if time.time() - start > 500:
                break
            try:
                result = translate_tool(tool)
                save_translation(tool["id"], result.get("title_zh", ""), result.get("description_zh", ""))
                steps["translated"] += 1
            except Exception as e:
                steps.setdefault("translate_errors", []).append(
                    {"id": tool["id"], "error": str(e)})

        elapsed = time.time() - start
        remaining_c = len(get_unclassified_tools(limit=1))
        remaining_t = len(get_untranslated_tools(limit=1))
        steps["remaining_classify"] = remaining_c > 0
        steps["remaining_translate"] = remaining_t > 0

        log_cron_run(today, "classify", "success", steps=steps,
                     duration_seconds=elapsed)
        return {"status": "success", **steps}

    except Exception as e:
        elapsed = time.time() - start
        log_cron_run(today, "classify", "error", steps=steps,
                     error_message=str(e), duration_seconds=elapsed)
        return {"status": "error", "error": str(e)}


def task_digest() -> dict:
    """Generate daily digest and AI recommendations. Returns status dict."""
    init_db()
    today = date.today().isoformat()
    start = time.time()
    steps = {}

    try:
        # Digest
        existing_digest = get_daily_digest()
        if existing_digest:
            steps["digest"] = "already_exists"
        else:
            from backend.daily_news import generate_daily_digest
            digest = generate_daily_digest()
            steps["digest"] = len(digest)

        # AI recommendations
        from backend.ai_recommend import generate_recommendations
        ai_picks = generate_recommendations()
        steps["ai_picks"] = len(ai_picks)

        elapsed = time.time() - start
        log_cron_run(today, "digest", "success", steps=steps,
                     duration_seconds=elapsed)
        return {"status": "success", **steps}

    except Exception as e:
        elapsed = time.time() - start
        log_cron_run(today, "digest", "error", steps=steps,
                     error_message=str(e), duration_seconds=elapsed)
        return {"status": "error", "error": str(e)}
