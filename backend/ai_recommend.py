"""AI recommendation engine. Uses MiniMax to pick and explain today's best tools."""

import json
import logging
from openai import OpenAI
from backend.config import MINIMAX_API_KEY
from backend.db.queries import get_today_tools
from backend.db import get_db

logger = logging.getLogger(__name__)

CACHE_TABLE = """
CREATE TABLE IF NOT EXISTS ai_recommendations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tool_id INTEGER NOT NULL,
    reason TEXT NOT NULL,
    use_cases TEXT NOT NULL,
    reason_en TEXT DEFAULT '',
    use_cases_en TEXT DEFAULT '',
    score INTEGER DEFAULT 0,
    created_date TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
"""


def _ensure_table():
    with get_db() as db:
        db.execute(CACHE_TABLE)


def get_cached_recommendations(date: str | None = None) -> list[dict]:
    """Get cached AI recommendations for a date (default today)."""
    _ensure_table()
    with get_db() as db:
        if date is None:
            date_clause = "date('now')"
            params: tuple = ()
        else:
            date_clause = "?"
            params = (date,)

        rows = db.execute(f"""
            SELECT r.*, t.* FROM ai_recommendations r
            JOIN tools t ON r.tool_id = t.id
            WHERE r.created_date = {date_clause}
            ORDER BY r.score DESC
        """, params).fetchall()

        # Fallback: if no results for today, get most recent
        if not rows and date is None:
            rows = db.execute("""
                SELECT r.*, t.* FROM ai_recommendations r
                JOIN tools t ON r.tool_id = t.id
                ORDER BY r.created_date DESC, r.score DESC
                LIMIT 10
            """).fetchall()

        results = []
        for row in rows:
            d = dict(row)
            d["ai_reason"] = d.pop("reason", "")
            d["ai_use_cases"] = d.pop("use_cases", "")
            d["ai_reason_en"] = d.pop("reason_en", "")
            d["ai_use_cases_en"] = d.pop("use_cases_en", "")
            d["ai_score"] = d.pop("score", 0)
            results.append(d)
        return results


def generate_recommendations() -> list[dict]:
    """Use MiniMax to pick and explain today's best tools. Caches results."""
    _ensure_table()

    cached = get_cached_recommendations()
    if cached:
        return cached

    today_tools = get_today_tools()
    if not today_tools:
        return []

    if not MINIMAX_API_KEY:
        logger.warning("No MINIMAX_API_KEY set, skipping AI recommendations")
        return []

    try:
        client = OpenAI(
            api_key=MINIMAX_API_KEY,
            base_url="https://api.minimax.chat/v1",
        )

        # Build tool summaries
        tool_summaries = []
        for tool in today_tools[:50]:
            metrics = json.loads(tool.get("metrics", "{}"))
            tool_summaries.append({
                "id": tool["id"],
                "title": tool["title"],
                "description": (tool.get("description") or "")[:200],
                "source": tool["source"],
                "content_type": tool.get("content_type", "other"),
                "domain": tool.get("domain", "general"),
                "stars": metrics.get("stars"),
                "points": metrics.get("points"),
                "votes": metrics.get("votes"),
            })

        prompt = f"""你是 Metis，一个AI工具发现助手。从今天新发现的 {len(tool_summaries)} 个工具中，挑选最有价值的 TOP 5 推荐给开发者和技术从业者。

对每个推荐，同时提供中文和英文版本：
1. id：工具的 id（来自列表）
2. reason：推荐理由，中文，2-3句
3. use_cases：适用场景，中文，2-3个
4. reason_en：推荐理由，English，2-3 sentences
5. use_cases_en：适用场景，English，2-3 scenarios
6. score：评分 1-10（10=必须了解）

重点关注：实用性、新颖性、社区热度、对开发者工作流的潜在影响。

今日工具列表：
{json.dumps(tool_summaries, ensure_ascii=False, indent=2)}

严格按以下JSON格式返回，不要有其他文字：
{{"picks": [{{"id": 123, "reason": "中文理由", "use_cases": "中文场景", "reason_en": "English reason", "use_cases_en": "English use cases", "score": 9}}]}}"""

        response = client.chat.completions.create(
            model="MiniMax-M2.7-highspeed",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=2000,
            temperature=0.7,
        )

        text = response.choices[0].message.content.strip()

        # Strip <think>...</think> tags from reasoning models
        import re
        text = re.sub(r'<think>.*?</think>', '', text, flags=re.DOTALL).strip()

        # Extract JSON from response
        # Try: raw JSON, ```json block, or first { to last }
        if text.startswith("```"):
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]
            text = text.strip()
        elif not text.startswith("{"):
            # Find JSON object in the text
            start = text.find("{")
            end = text.rfind("}") + 1
            if start >= 0 and end > start:
                text = text[start:end]

        logger.info(f"MiniMax response (first 200 chars): {text[:200]}")
        data = json.loads(text)
        picks = data.get("picks", [])

        # Cache results
        with get_db() as db:
            for pick in picks:
                tool_id = pick["id"]
                exists = db.execute("SELECT 1 FROM tools WHERE id = ?", (tool_id,)).fetchone()
                if not exists:
                    continue
                db.execute(
                    "INSERT INTO ai_recommendations (tool_id, reason, use_cases, reason_en, use_cases_en, score, created_date) VALUES (?, ?, ?, ?, ?, ?, date('now'))",
                    (tool_id, pick["reason"], pick["use_cases"],
                     pick.get("reason_en", ""), pick.get("use_cases_en", ""),
                     pick.get("score", 5))
                )

        return get_cached_recommendations()

    except Exception as e:
        logger.error(f"AI recommendation failed: {e}")
        return []
