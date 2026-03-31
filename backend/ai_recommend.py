"""AI recommendation engine. Uses Claude to pick and explain today's best tools."""

import json
import logging
import os
from backend.db.queries import get_today_tools
from backend.db import get_db

logger = logging.getLogger(__name__)

CACHE_TABLE = """
CREATE TABLE IF NOT EXISTS ai_recommendations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tool_id INTEGER NOT NULL,
    reason TEXT NOT NULL,
    use_cases TEXT NOT NULL,
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

        results = []
        for row in rows:
            d = dict(row)
            d["ai_reason"] = d.pop("reason", "")
            d["ai_use_cases"] = d.pop("use_cases", "")
            d["ai_score"] = d.pop("score", 0)
            results.append(d)
        return results


def generate_recommendations() -> list[dict]:
    """Use Claude to pick and explain today's best tools. Caches results."""
    _ensure_table()

    # Check cache first
    cached = get_cached_recommendations()
    if cached:
        return cached

    today_tools = get_today_tools()
    if not today_tools:
        return []

    api_key = os.getenv("ANTHROPIC_API_KEY", "")
    if not api_key:
        logger.warning("No ANTHROPIC_API_KEY set, skipping AI recommendations")
        return []

    try:
        import anthropic
        client = anthropic.Anthropic(api_key=api_key)

        # Build tool summaries for the prompt
        tool_summaries = []
        for tool in today_tools[:50]:  # Cap at 50
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

        prompt = f"""You are Metis, an AI tool discovery assistant. From today's {len(tool_summaries)} newly discovered tools, pick the TOP 5 most valuable ones for developers and tech professionals.

For each pick, provide:
1. The tool's id (from the list)
2. A recommendation reason (2-3 sentences, be specific about WHY this matters)
3. Use cases (2-3 concrete scenarios where someone would use this)
4. A score from 1-10 (10 = must-know)

Focus on: practical utility, novelty, community traction, and potential impact on developer workflows.

Today's tools:
{json.dumps(tool_summaries, ensure_ascii=False, indent=2)}

Respond in this exact JSON format:
{{"picks": [{{"id": 123, "reason": "...", "use_cases": "...", "score": 9}}]}}

Respond ONLY with the JSON, no other text."""

        response = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=2000,
            messages=[{"role": "user", "content": prompt}],
        )

        text = response.content[0].text.strip()
        # Parse JSON from response
        if text.startswith("```"):
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]
        data = json.loads(text)
        picks = data.get("picks", [])

        # Cache results
        with get_db() as db:
            for pick in picks:
                tool_id = pick["id"]
                # Verify tool exists
                exists = db.execute("SELECT 1 FROM tools WHERE id = ?", (tool_id,)).fetchone()
                if not exists:
                    continue
                db.execute(
                    "INSERT INTO ai_recommendations (tool_id, reason, use_cases, score, created_date) VALUES (?, ?, ?, ?, date('now'))",
                    (tool_id, pick["reason"], pick["use_cases"], pick.get("score", 5))
                )

        return get_cached_recommendations()

    except Exception as e:
        logger.error(f"AI recommendation failed: {e}")
        return []
