"""Vercel Cron Job — runs scrapers + AI digest daily."""

import sys
import os
import json
import logging

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv()

from flask import Flask, jsonify, request

app = Flask(__name__)
logger = logging.getLogger(__name__)

CRON_SECRET = os.getenv("CRON_SECRET", "")


def generate_daily_digest():
    """Use AI to pick 3 tools + 2 hot news from today's discoveries."""
    from backend.db.queries import get_today_tools, get_daily_digest, save_daily_digest

    # Skip if already generated today
    existing = get_daily_digest()
    if existing:
        return existing

    today = get_today_tools()
    if not today:
        return []

    api_key = os.getenv("MINIMAX_API_KEY", "")
    if not api_key:
        return []

    try:
        from openai import OpenAI
        client = OpenAI(api_key=api_key, base_url="https://api.minimax.chat/v1")

        summaries = []
        for t in today[:40]:
            metrics = json.loads(t.get("metrics", "{}"))
            summaries.append({
                "id": t["id"],
                "title": t["title"],
                "desc": (t.get("description") or "")[:150],
                "type": t.get("content_type", "other"),
                "stars": metrics.get("stars"),
                "points": metrics.get("points"),
            })

        prompt = f"""从以下 {len(summaries)} 个今日发现中，选出：
- 3 个最值得关注的工具（tool_pick），每个用一句话说明它能帮用户解决什么问题
- 2 个热点信息（hot_news），每个用一句话总结

同时提供中英文。

工具列表：
{json.dumps(summaries, ensure_ascii=False)[:3000]}

严格按 JSON 返回：
{{"items": [
  {{"type": "tool_pick", "tool_id": 123, "summary": "中文一句话", "summary_en": "English one line"}},
  {{"type": "hot_news", "tool_id": null, "summary": "中文一句话", "summary_en": "English one line"}}
]}}"""

        resp = client.chat.completions.create(
            model="MiniMax-M2.7-highspeed",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=1500,
            temperature=0.7,
        )

        import re
        text = resp.choices[0].message.content.strip()
        text = re.sub(r'<think>.*?</think>', '', text, flags=re.DOTALL).strip()
        if not text.startswith("{"):
            start = text.find("{")
            end = text.rfind("}") + 1
            if start >= 0 and end > start:
                text = text[start:end]

        data = json.loads(text)
        items = data.get("items", [])

        entries = []
        for item in items:
            entries.append({
                "tool_id": item.get("tool_id"),
                "type": item["type"],
                "summary": item["summary"],
                "summary_en": item.get("summary_en", ""),
            })

        save_daily_digest(entries)
        return get_daily_digest()

    except Exception as e:
        logger.error(f"Daily digest failed: {e}")
        return []


@app.route("/api/cron", methods=["GET"])
def cron():
    if CRON_SECRET and request.headers.get("Authorization") != f"Bearer {CRON_SECRET}":
        return jsonify({"error": "Unauthorized"}), 401

    from backend.db import init_db
    init_db()

    from backend.scheduler import run_all
    results = run_all()

    # Auto-classify + translate new tools
    from backend.db.queries import get_unclassified_tools, save_classification, get_untranslated_tools, save_translation
    from backend.classifier import classify_tool
    from backend.translate import translate_tool

    classified = 0
    for tool in get_unclassified_tools(limit=100):
        ct, domain = classify_tool(tool)
        save_classification(tool["id"], ct, domain)
        classified += 1

    translated = 0
    for tool in get_untranslated_tools(limit=100):
        result = translate_tool(tool)
        save_translation(tool["id"], result.get("title_zh", ""), result.get("description_zh", ""))
        translated += 1

    # Generate daily digest (3 tool picks + 2 hot news)
    digest = generate_daily_digest()

    # Generate AI recommendations
    from backend.ai_recommend import generate_recommendations
    ai_picks = generate_recommendations()

    # Generate AI daily news briefing
    from backend.daily_news import generate_daily_news as gen_daily_news
    daily_news_result = gen_daily_news()
    daily_news_ok = daily_news_result is not None

    return jsonify({
        "scrape": results,
        "classified": classified,
        "translated": translated,
        "digest": len(digest),
        "ai_picks": len(ai_picks),
        "daily_news": daily_news_ok,
    })
