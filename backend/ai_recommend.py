"""AI recommendation engine. Uses MiniMax to pick and explain today's best tools."""

import json
import re
import logging
import urllib.request
import ssl
import certifi
from backend.config import MINIMAX_API_KEY
from backend.db.queries import get_today_tools
from backend.db import get_db

logger = logging.getLogger(__name__)

_SSL_CTX = ssl.create_default_context(cafile=certifi.where())

MINIMAX_URL = "https://api.minimax.chat/v1/text/chatcompletion_v2"
MINIMAX_MODEL = "MiniMax-M2.7-highspeed"

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


def _minimax_chat(prompt: str, max_tokens: int = 2000, temperature: float = 0.7) -> str:
    """Call MiniMax native API and return response text."""
    payload = json.dumps({
        "model": MINIMAX_MODEL,
        "messages": [{"role": "user", "content": prompt}],
        "max_tokens": max_tokens,
        "temperature": temperature,
    }, ensure_ascii=False).encode("utf-8")

    req = urllib.request.Request(
        MINIMAX_URL,
        data=payload,
        headers={
            "Authorization": f"Bearer {MINIMAX_API_KEY}",
            "Content-Type": "application/json",
        }
    )
    resp = urllib.request.urlopen(req, context=_SSL_CTX, timeout=300)
    data = json.loads(resp.read().decode("utf-8"))
    return data["choices"][0]["message"]["content"].strip()


def _extract_json(text: str) -> str:
    """Strip think tags and extract JSON from response."""
    text = re.sub(r'<think>.*?</think>', '', text, flags=re.DOTALL).strip()
    if text.startswith("```"):
        text = text.split("```")[1]
        if text.startswith("json"):
            text = text[4:]
        return text.strip()
    if not text.startswith("{"):
        start = text.find("{")
        end = text.rfind("}") + 1
        if start >= 0 and end > start:
            return text[start:end]
    return text


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

        text = _minimax_chat(prompt, max_tokens=2000, temperature=0.7)
        text = _extract_json(text)

        logger.info(f"MiniMax response (first 200 chars): {text[:200]}")
        data = json.loads(text)
        picks = data.get("picks", [])

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


def categorize_and_summarize(tool_ids: list[int]) -> int:
    """For each new tool, use MiniMax to assign discovery_category and short_summary.
    Returns the number of tools successfully processed."""
    if not tool_ids or not MINIMAX_API_KEY:
        return 0

    with get_db() as db:
        rows = db.execute(
            f"SELECT id, title, title_zh, description, description_zh, content_type, domain, source "
            f"FROM tools WHERE id IN ({','.join('?' * len(tool_ids))})",
            tool_ids
        ).fetchall()

    if not rows:
        return 0

    tool_list = []
    for t in [dict(r) for r in rows]:
        tool_list.append({
            "id": t["id"],
            "title": t["title"],
            "description": (t.get("description") or "")[:80],
            "source": t.get("source", ""),
            "content_type": t.get("content_type", "other"),
            "domain": t.get("domain", "general"),
        })

    prompt = f"""你是 Metis，一个 AI 工具发现助手。请对以下 {len(tool_list)} 条内容分别做两件事：

1. **分类** (discovery_category)，只能选以下三个值之一：
   - "news"：AI 相关新闻，包括新模型发布、AI 公司融资、社区生态、行业报告、研究论文
   - "ai_tool"：可直接使用的 AI 工具、AI 库、AI API、AI 模型、Agent 框架
   - "other"：其他科技内容，非 AI 的开发工具、通用技术资讯、开源项目等

2. **生成一行摘要**，格式："产品/项目名 — 功能概述"
   - short_summary：英文版，约50个字符，例如 "GStack — headless browser automation with built-in AI skills library"
   - short_summary_zh：中文版，约50个汉字，例如 "GStack — 无头浏览器自动化框架，内置 AI skills 技能库，可提升模型执行效果"

内容列表：
{json.dumps(tool_list, ensure_ascii=False, indent=2)}

严格按以下 JSON 格式返回，不要有其他文字：
{{"results": [{{"id": 123, "discovery_category": "ai_tool", "short_summary": "...", "short_summary_zh": "..."}}]}}"""

    try:
        text = _minimax_chat(prompt, max_tokens=16000, temperature=0.3)
        text = _extract_json(text)

        data = json.loads(text)
        results = data.get("results", [])

        updated = 0
        with get_db() as db:
            for r in results:
                tool_id = r.get("id")
                category = r.get("discovery_category", "other")
                if category not in ("news", "ai_tool", "other"):
                    category = "other"
                db.execute(
                    "UPDATE tools SET discovery_category=?, short_summary=?, short_summary_zh=? WHERE id=?",
                    (category, r.get("short_summary", ""), r.get("short_summary_zh", ""), tool_id)
                )
                updated += 1

        logger.info(f"Categorized and summarized {updated} tools")
        return updated

    except Exception as e:
        logger.error(f"categorize_and_summarize failed: {e}")
        return 0
