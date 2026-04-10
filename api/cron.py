"""Vercel Cron Job — runs scrapers + AI digest daily.

Each cron invocation checks what work remains and continues from where the last run left off.
Priority order: scrape → daily_news → classify → translate → digest → recommendations.
This ensures all tasks complete across multiple cron runs even with 600s timeout.
"""

import sys
import os
import json
import logging
import time

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv()

from flask import Flask, jsonify, request

app = Flask(__name__)
logger = logging.getLogger(__name__)

CRON_SECRET = os.getenv("CRON_SECRET", "")
MAX_DURATION = 540  # Leave 60s buffer before Vercel's 600s hard limit


def _seconds_left(start: float) -> float:
    return MAX_DURATION - (time.time() - start)


@app.route("/api/cron", methods=["GET"])
def cron():
    if CRON_SECRET and request.headers.get("Authorization") != f"Bearer {CRON_SECRET}":
        return jsonify({"error": "Unauthorized"}), 401

    start_time = time.time()

    from backend.db import init_db
    init_db()

    from backend.daily_news import generate_daily_news as gen_daily_news
    from backend.db.queries import (
        get_daily_news, get_unclassified_tools, save_classification,
        get_untranslated_tools, save_translation, get_daily_digest,
    )
    from backend.ai_recommend import generate_recommendations
    from backend.classifier import classify_tool
    from backend.translate import translate_tool

    from datetime import date
    today = date.today().isoformat()

    status = {
        "date": today,
        "scraped": False,
        "daily_news": False,
        "daily_news_verified": False,
        "classified": 0,
        "translated": 0,
        "digest": 0,
        "ai_picks": 0,
    }

    # ── Step 1: Scrape (only if no tools exist for today yet) ──
    from backend.db import get_db
    with get_db() as db:
        tool_count = db.execute(
            "SELECT COUNT(*) FROM tools WHERE date(first_seen) = ?", (today,)
        ).fetchone()[0]

    if tool_count == 0 and _seconds_left(start_time) > 120:
        logger.info("No tools for today, running scrapers...")
        from backend.scrapers.github import GitHubScraper
        from backend.scrapers.hackernews import HNScraper
        from backend.scrapers.producthunt import ProductHuntScraper
        from backend.scrapers.rss_news import RSSNewsScraper

        for scraper in [GitHubScraper(), HNScraper(), ProductHuntScraper(), RSSNewsScraper()]:
            if _seconds_left(start_time) < 60:
                logger.warning(f"Time running low, stopping scrapers")
                break
            try:
                result = scraper.run()
                logger.info(f"{scraper.source_name}: {result['tools_found']} found, {result['tools_new']} new")
            except Exception as e:
                logger.error(f"{scraper.source_name} failed: {e}")
        status["scraped"] = True
    elif tool_count > 0:
        status["scraped"] = True
        logger.info(f"Already have {tool_count} tools for {today}, skipping scrape")

    # ── Step 2: Daily News (highest priority after scrape) ──
    existing_news = get_daily_news(today)
    if existing_news:
        status["daily_news"] = True
        status["daily_news_verified"] = True
    elif _seconds_left(start_time) > 60:
        logger.info("Generating daily news...")
        result = gen_daily_news()
        if result:
            status["daily_news"] = True
            verified = get_daily_news(today)
            status["daily_news_verified"] = verified is not None
            if not status["daily_news_verified"]:
                logger.error(f"Daily news saved but not found for {today}, retrying...")
                gen_daily_news(force=True)
                status["daily_news_verified"] = get_daily_news(today) is not None
        else:
            logger.error(f"Daily news generation returned None for {today}")

    # ── Step 3: Classify unclassified tools ──
    if _seconds_left(start_time) > 60:
        for tool in get_unclassified_tools(limit=100):
            if _seconds_left(start_time) < 30:
                logger.info(f"Time limit approaching, classified {status['classified']} tools")
                break
            try:
                ct, domain = classify_tool(tool)
                save_classification(tool["id"], ct, domain)
                status["classified"] += 1
            except Exception as e:
                logger.error(f"Classify failed for {tool['id']}: {e}")

    # ── Step 4: Translate untranslated tools ──
    if _seconds_left(start_time) > 60:
        for tool in get_untranslated_tools(limit=100):
            if _seconds_left(start_time) < 30:
                logger.info(f"Time limit approaching, translated {status['translated']} tools")
                break
            try:
                result = translate_tool(tool)
                save_translation(tool["id"], result.get("title_zh", ""), result.get("description_zh", ""))
                status["translated"] += 1
            except Exception as e:
                logger.error(f"Translate failed for {tool['id']}: {e}")

    # ── Step 5: Daily digest ──
    if _seconds_left(start_time) > 30:
        from backend.daily_news import generate_daily_digest
        digest = generate_daily_digest()
        status["digest"] = len(digest)

    # ── Step 6: AI recommendations ──
    if _seconds_left(start_time) > 30:
        ai_picks = generate_recommendations()
        status["ai_picks"] = len(ai_picks)

    # ── Summary & Verification ──
    elapsed = round(time.time() - start_time, 1)
    remaining_classify = len(get_unclassified_tools(limit=1))
    remaining_translate = len(get_untranslated_tools(limit=1))

    with get_db() as db:
        tool_count_today = db.execute(
            "SELECT COUNT(*) FROM tools WHERE date(first_seen) = ?", (today,)
        ).fetchone()[0]

    has_digest = len(get_daily_digest()) > 0
    has_news = get_daily_news(today) is not None

    all_done = (has_news
                and remaining_classify == 0
                and remaining_translate == 0
                and has_digest
                and tool_count_today > 0)

    status["elapsed_seconds"] = elapsed
    status["all_tasks_complete"] = all_done
    status["remaining_classify"] = remaining_classify > 0
    status["remaining_translate"] = remaining_translate > 0
    status["has_digest"] = has_digest
    status["tools_today"] = tool_count_today
    status["mode"] = "complete" if all_done else "partial"

    if not all_done:
        missing = []
        if tool_count_today == 0:
            missing.append("scrape")
        if not has_news:
            missing.append("daily_news")
        if remaining_classify > 0:
            missing.append("classify")
        if remaining_translate > 0:
            missing.append("translate")
        if not has_digest:
            missing.append("digest")
        logger.warning(f"Incomplete after {elapsed}s. Missing: {', '.join(missing)}")
    else:
        logger.info(f"All tasks complete in {elapsed}s")

    return jsonify(status)
