"""AI Daily News generator. Aggregates today's AI news and uses MiniMax to produce a structured briefing."""

import json
import logging
from datetime import date

from backend.config import MINIMAX_API_KEY
from backend.ai_recommend import _minimax_chat, _extract_json
from backend.db import get_db
from backend.db.queries import save_daily_news, get_daily_news

logger = logging.getLogger(__name__)

MINIMAX_MODEL = "MiniMax-M2.7-highspeed"

DAILY_NEWS_TABLE = """
CREATE TABLE IF NOT EXISTS ai_daily_news (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    news_date TEXT NOT NULL UNIQUE,
    headlines TEXT NOT NULL DEFAULT '[]',
    quick_bites TEXT NOT NULL DEFAULT '[]',
    editor_take TEXT DEFAULT '',
    editor_take_en TEXT DEFAULT '',
    source_tool_ids TEXT DEFAULT '[]',
    model TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
"""


def _ensure_table():
    with get_db() as db:
        db.execute(DAILY_NEWS_TABLE)


PROMPT_TEMPLATE = """你是一位资深 AI 科技记者，请基于以下今日 AI 领域资讯素材，撰写一份专业的 AI 科技日报。

## 素材来源说明
以下数据来自 Hacker News、GitHub Trending、Product Hunt、The Verge、TechCrunch、Ars Technica、MIT Technology Review、VentureBeat、Wired、OpenAI Blog、Google AI Blog 等多个渠道的今日更新，已经过去重和初步分类。

## 输入素材
{news_json}

## 输出要求（严格按此 JSON 结构返回，不要有任何其他文字）

{{"date": "{today}",
  "headlines": [
    {{
      "rank": 1,
      "title": "标题（≤30字，有信息量）",
      "title_en": "English title (≤80 chars)",
      "summary": "2-3句核心要点，提炼关键信息而非复述原文",
      "summary_en": "English summary, 2-3 sentences",
      "source": "来源名称",
      "source_url": "原文链接",
      "tag": "模型发布|融资|开源|产品|政策|研究|工具"
    }}
  ],
  "quick_bites": [
    {{
      "text": "一句话快讯（≤50字）",
      "text_en": "English one-liner",
      "source": "来源",
      "source_url": "链接"
    }}
  ],
  "editor_take": "编辑视角（中文）：3-5句话的趋势分析，要有观点和洞察，不是流水账",
  "editor_take_en": "Editor's take (English): 3-5 sentences with insight"
}}

## 撰写规则
1. headlines 选 3-5 条最重要的新闻，按影响力降序排列
2. quick_bites 选 3-6 条次要但值得关注的信息
3. 去重：同一事件即使来自多个源，只保留一条（选最权威的来源）
4. 标题避免"震惊""重磅"等标题党用词，信息量优先
5. tag 必须从 7 个类别中选一个：模型发布、融资、开源、产品、政策、研究、工具
6. editor_take 需总结当日 AI 领域整体动态，点出最值得关注的趋势或转折点
7. 如果素材不足（<3条有价值信息），headlines 可以少于 3 条，但必须保证质量
8. source_url 必须是真实原文链接，不要编造"""


def _get_ai_news_for_date(target_date: str | None = None) -> list[dict]:
    """Query today's AI-related tools from all sources."""
    _ensure_table()
    with get_db() as db:
        if target_date:
            date_clause = "?"
            params: tuple = (target_date,)
        else:
            date_clause = "date('now')"
            params = ()

        rows = db.execute(f"""
            SELECT id, url, title, description, source, source_url, metrics,
                   content_type, domain, discovery_category, first_seen
            FROM tools
            WHERE date(first_seen) = {date_clause}
              AND (domain = 'ai'
                   OR source = 'rss_news'
                   OR discovery_category = 'news'
                   OR content_type IN ('model', 'article'))
            ORDER BY
                COALESCE(
                    json_extract(metrics, '$.stars'),
                    json_extract(metrics, '$.points'),
                    json_extract(metrics, '$.votes'),
                    0
                ) DESC
            LIMIT 80
        """, params).fetchall()

        results = []
        for row in rows:
            d = dict(row)
            d["metrics"] = json.loads(d.get("metrics") or "{}")
            results.append(d)
        return results


def generate_daily_news(target_date: str | None = None, force: bool = False) -> dict | None:
    """Generate the AI daily news briefing.

    Args:
        target_date: Date string 'YYYY-MM-DD', defaults to today.
        force: If True, regenerate even if cached.

    Returns:
        The daily news dict, or None if generation failed.
    """
    _ensure_table()
    today = target_date or date.today().isoformat()

    # Check cache
    if not force:
        cached = get_daily_news(today)
        if cached:
            logger.info(f"Daily news for {today} already exists, returning cached")
            return cached

    if not MINIMAX_API_KEY:
        logger.warning("No MINIMAX_API_KEY set, skipping daily news generation")
        return None

    # Gather AI news
    news_items = _get_ai_news_for_date(target_date)
    if not news_items:
        logger.warning(f"No AI news found for {today}, skipping daily news")
        return None

    logger.info(f"Generating daily news for {today} from {len(news_items)} items")

    # Prepare input for MiniMax
    summaries = []
    source_ids = []
    for item in news_items:
        source_ids.append(item["id"])
        metrics = item.get("metrics", {})
        rss_label = metrics.get("rss_label", "")
        summaries.append({
            "id": item["id"],
            "title": item["title"],
            "description": (item.get("description") or "")[:200],
            "source": rss_label or item["source"],
            "source_url": item.get("source_url") or item["url"],
            "content_type": item.get("content_type", "other"),
            "stars": metrics.get("stars"),
            "points": metrics.get("points"),
            "votes": metrics.get("votes"),
        })

    prompt = PROMPT_TEMPLATE.format(
        news_json=json.dumps(summaries, ensure_ascii=False, indent=2)[:6000],
        today=today,
    )

    try:
        text = _minimax_chat(prompt, max_tokens=3000, temperature=0.7)
        text = _extract_json(text)
        logger.info(f"MiniMax daily news response (first 200 chars): {text[:200]}")

        data = json.loads(text)
        headlines = data.get("headlines", [])
        quick_bites = data.get("quick_bites", [])
        editor_take = data.get("editor_take", "")
        editor_take_en = data.get("editor_take_en", "")

        save_daily_news(
            news_date=today,
            headlines=headlines,
            quick_bites=quick_bites,
            editor_take=editor_take,
            editor_take_en=editor_take_en,
            source_tool_ids=source_ids,
            model=MINIMAX_MODEL,
        )

        return get_daily_news(today)

    except Exception as e:
        logger.error(f"Daily news generation failed: {e}")
        return None
