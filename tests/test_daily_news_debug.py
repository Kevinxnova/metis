"""Reproduce: generate_daily_news returns None on Turso.

Run: python -m pytest tests/test_daily_news_debug.py -v -s
"""

import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from dotenv import load_dotenv
load_dotenv()

import pytest
from backend.db import get_db, _use_turso
from backend.config import MINIMAX_API_KEY


TARGET_DATE = "2026-04-11"


def test_turso_connection():
    """Step 0: Can we talk to the database at all?"""
    assert _use_turso(), "Not using Turso — set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN"
    with get_db() as db:
        row = db.execute("SELECT 1 AS ok").fetchone()
        assert row["ok"] == 1


def test_tools_exist_for_date():
    """Step 1: Are there tools for TARGET_DATE?"""
    with get_db() as db:
        count = db.execute(
            "SELECT COUNT(*) FROM tools WHERE date(first_seen) = ?",
            (TARGET_DATE,),
        ).fetchone()[0]
    assert count > 0, f"No tools found for {TARGET_DATE}"
    print(f"  tools for {TARGET_DATE}: {count}")


def test_ai_news_query_returns_results():
    """Step 2: Does _get_ai_news_for_date return anything?

    This is the exact query that runs inside generate_daily_news.
    If this returns empty, generate_daily_news returns None before calling MiniMax.
    """
    from backend.daily_news import _get_ai_news_for_date

    items = _get_ai_news_for_date(TARGET_DATE)
    print(f"  AI news items: {len(items)}")
    if items:
        for i in items[:3]:
            print(f"    [{i['source']}] {i['title'][:50]}")
    assert len(items) > 0, (
        f"_get_ai_news_for_date returned empty for {TARGET_DATE}. "
        "This means the WHERE clause filters out all tools."
    )


def test_ai_news_query_without_classification():
    """Step 3: Does the query work for UNCLASSIFIED tools?

    At 00:30 UTC the classify task hasn't run yet, so:
      domain = 'general' (default), content_type = 'other', discovery_category = 'other'
    Only source = 'rss_news' should match.
    """
    with get_db() as db:
        rows = db.execute(
            """SELECT COUNT(*) FROM tools
               WHERE date(first_seen) = ?
                 AND source = 'rss_news'""",
            (TARGET_DATE,),
        ).fetchone()[0]
    print(f"  rss_news tools for {TARGET_DATE}: {rows}")
    assert rows > 0, "No rss_news tools — daily_news at 00:30 UTC would have zero input"


def test_minimax_api_key_available():
    """Step 4: Is MINIMAX_API_KEY loaded?"""
    assert MINIMAX_API_KEY, "MINIMAX_API_KEY is empty"
    print(f"  key prefix: {MINIMAX_API_KEY[:8]}...")


def test_minimax_api_reachable():
    """Step 5: Can we actually call MiniMax from this environment?"""
    from backend.ai_recommend import _minimax_chat

    resp = _minimax_chat("Reply with exactly: OK", temperature=0)
    assert resp, "MiniMax returned empty response"
    print(f"  MiniMax response: {resp}")


def test_generate_daily_news_end_to_end():
    """Step 6: Full end-to-end — does generate_daily_news succeed or raise?

    After our code fix, this should RAISE (not return None) on failure.
    """
    from backend.daily_news import generate_daily_news
    from backend.db import init_db
    init_db()

    # Use force=True to bypass cache
    result = generate_daily_news(target_date=TARGET_DATE, force=True)
    assert result is not None, "generate_daily_news returned None"
    assert len(result.get("headlines", [])) > 0
    print(f"  headlines: {len(result['headlines'])}")
    print(f"  quick_bites: {len(result.get('quick_bites', []))}")
