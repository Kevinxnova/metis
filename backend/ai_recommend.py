"""AI recommendation engine. Uses MiniMax to pick and explain today's best tools."""

import json
import re
import logging
from backend.config import MINIMAX_API_KEY
from backend.db.queries import get_today_tools
from backend.db import get_db

logger = logging.getLogger(__name__)
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


def _minimax_chat(prompt: str, max_tokens: int = 10000, temperature: float = 0.7) -> str:
    """Call MiniMax API via OpenAI SDK and return response text. Retries once on failure."""
    from openai import OpenAI

    client = OpenAI(api_key=MINIMAX_API_KEY, base_url="https://api.minimax.chat/v1")

    last_err = None
    for attempt in range(2):
        if attempt > 0:
            import time
            time.sleep(5)
            logger.info("Retrying MiniMax API call (attempt 2/2)")
        try:
            resp = client.chat.completions.create(
                model=MINIMAX_MODEL,
                messages=[{"role": "user", "content": prompt}],
                max_tokens=max_tokens,
                temperature=temperature,
                timeout=120,
            )
            return resp.choices[0].message.content.strip()
        except Exception as e:
            last_err = e
            logger.error(f"MiniMax call failed (attempt {attempt+1}/2): {e}")
    raise last_err


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


def _compute_metrics_score(tool: dict) -> float:
    """Compute a normalized metrics score (0-40 points) from stars/points/votes/comments."""
    metrics = json.loads(tool.get("metrics", "{}"))
    stars = metrics.get("stars") or 0
    points = metrics.get("points") or 0
    votes = metrics.get("votes") or 0
    comments = metrics.get("comments") or 0

    import math
    def log_norm(val, max_val):
        if val <= 0:
            return 0
        return min(10, 10 * math.log1p(val) / math.log1p(max_val))

    score = (
        log_norm(stars, 10000) * 1.5 +     # stars weight: 15 max
        log_norm(points, 500) * 1.0 +       # HN points weight: 10 max
        log_norm(votes, 1000) * 0.8 +       # PH votes weight: 8 max
        log_norm(comments, 200) * 0.7        # comments weight: 7 max
    )
    return round(score, 2)


def _compute_freshness_score(tool: dict) -> float:
    """Compute freshness score (0-20 points). Newer tools score higher."""
    from datetime import datetime, timezone
    first_seen = tool.get("first_seen", "")
    try:
        seen_dt = datetime.fromisoformat(first_seen.replace("Z", "+00:00"))
        if seen_dt.tzinfo is None:
            seen_dt = seen_dt.replace(tzinfo=timezone.utc)
        now = datetime.now(timezone.utc)
        days_old = (now - seen_dt).total_seconds() / 86400
        return round(max(0, 20 * (1 - days_old / 7)), 2)
    except Exception:
        return 10.0


def _compute_multi_source_bonus(tool: dict) -> float:
    """Bonus for tools discovered from multiple sources (0-10 points)."""
    sources = json.loads(tool.get("sources", "[]"))
    return min(10, max(0, (len(sources) - 1) * 5))


def _ai_value_score_batch(tool_list: list[dict]) -> list[dict]:
    """Ask MiniMax to score tools on value/impact/novelty. Returns list of {id, ai_value}."""
    items = [{"id": t["id"], "title": t["title"], "desc": (t.get("description") or "")[:100]} for t in tool_list]
    prompt = (
        f"Rate each item's value to developers (0-30). Consider: practical utility, novelty, potential impact.\n"
        f"Items: {json.dumps(items, ensure_ascii=False)}\n"
        f'Return JSON only: {{"r":[{{"id":1,"v":25}}]}}'
    )
    text = _minimax_chat(prompt, max_tokens=4000, temperature=0.1)
    text = _extract_json(text)
    data = json.loads(text)
    raw = data.get("r") or data.get("results") or []
    return [{"id": item.get("id"), "ai_value": min(30, max(0, item.get("v", item.get("ai_value", 15))))} for item in raw]


def score_tools(tool_ids: list[int]) -> tuple[int, list[str]]:
    """Compute trending_score for tools. Score = metrics(0-40) + freshness(0-20) + multi_source(0-10) + ai_value(0-30).
    Returns (count_scored, list_of_errors)."""
    errors: list[str] = []
    if not tool_ids:
        return 0, errors

    with get_db() as db:
        rows = db.execute(
            f"SELECT id, title, description, metrics, sources, first_seen FROM tools WHERE id IN ({','.join('?' * len(tool_ids))})",
            tool_ids
        ).fetchall()

    if not rows:
        return 0, errors

    tools = [dict(r) for r in rows]

    scores: dict[int, float] = {}
    for tool in tools:
        tid = tool["id"]
        scores[tid] = (
            _compute_metrics_score(tool) +
            _compute_freshness_score(tool) +
            _compute_multi_source_bonus(tool)
        )

    SCORE_BATCH = 30
    if MINIMAX_API_KEY:
        for i in range(0, len(tools), SCORE_BATCH):
            batch = tools[i:i + SCORE_BATCH]
            try:
                ai_scores = _ai_value_score_batch(batch)
                for item in ai_scores:
                    tid = item.get("id")
                    if tid in scores:
                        scores[tid] += item.get("ai_value", 15)
            except Exception as e:
                err = f"ai_value_score batch {i}-{i+SCORE_BATCH}: {e}"
                logger.error(err)
                errors.append(err)
                for tool in batch:
                    scores[tool["id"]] += 15
    else:
        for tid in scores:
            scores[tid] += 15

    scored = 0
    with get_db() as db:
        for tid, total in scores.items():
            db.execute("UPDATE tools SET trending_score = ? WHERE id = ?", (round(total, 2), tid))
            scored += 1

    logger.info(f"Scored {scored} tools")
    return scored, errors


def _generate_intro_batch(tool_list: list[dict]) -> list[dict]:
    """Generate structured AI intros for a batch of tools.
    Returns list of {id, ai_intro, ai_intro_zh}."""
    items = [{"id": t["id"], "title": t["title"], "desc": (t.get("description") or "")[:200],
              "source": t.get("source", ""), "type": t.get("content_type", "")} for t in tool_list]
    prompt = (
        f"For each item, write a structured introduction in BOTH English and Chinese.\n"
        f"Structure (3 short paragraphs each):\n"
        f"1. What it is — one sentence positioning\n"
        f"2. Core capabilities — key features and highlights\n"
        f"3. Use cases — who should use it and what problems it solves\n\n"
        f"Items: {json.dumps(items, ensure_ascii=False)}\n\n"
        f'Return JSON only: {{"r":[{{"id":1,"en":"Para1\\n\\nPara2\\n\\nPara3","zh":"段落1\\n\\n段落2\\n\\n段落3"}}]}}'
    )
    text = _minimax_chat(prompt, max_tokens=10000, temperature=0.3)
    text = _extract_json(text)
    data = json.loads(text)
    raw = data.get("r") or data.get("results") or []
    return [{"id": item.get("id"),
             "ai_intro": item.get("en", item.get("ai_intro", "")),
             "ai_intro_zh": item.get("zh", item.get("ai_intro_zh", ""))} for item in raw]


def generate_intros(tool_ids: list[int]) -> tuple[int, list[str]]:
    """Generate AI intros for tools that don't have one yet.
    Returns (count_generated, list_of_errors)."""
    errors: list[str] = []
    if not tool_ids or not MINIMAX_API_KEY:
        return 0, errors

    with get_db() as db:
        rows = db.execute(
            f"SELECT id, title, description, source, content_type FROM tools WHERE id IN ({','.join('?' * len(tool_ids))})",
            tool_ids
        ).fetchall()

    if not rows:
        return 0, errors

    tool_list = [dict(r) for r in rows]
    generated = 0
    INTRO_BATCH = 10

    for i in range(0, len(tool_list), INTRO_BATCH):
        batch = tool_list[i:i + INTRO_BATCH]
        try:
            results = _generate_intro_batch(batch)
            with get_db() as db:
                for r in results:
                    tid = r.get("id")
                    db.execute(
                        "UPDATE tools SET ai_intro = ?, ai_intro_zh = ? WHERE id = ?",
                        (r.get("ai_intro", ""), r.get("ai_intro_zh", ""), tid)
                    )
                    generated += 1
        except Exception as e:
            err = f"generate_intro batch {i}-{i+INTRO_BATCH}: {e}"
            logger.error(err)
            errors.append(err)

    logger.info(f"Generated intros for {generated} tools")
    return generated, errors


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

        text = _minimax_chat(prompt, max_tokens=10000, temperature=0.7)
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


def _classify_batch(tool_list: list[dict]) -> list[dict]:
    """Classify a batch of tools into news/ai_tool/other. Returns list of {id, category}."""
    prompt = (
        f"Classify these {len(tool_list)} items. Return ONLY JSON, no other text.\n"
        f"discovery_category must be exactly one of: news / ai_tool / other\n"
        f"- news: AI-related announcements, model releases, funding, industry events\n"
        f"- ai_tool: AI-powered products, tools, libraries, frameworks\n"
        f"- other: everything else (non-AI tech, general software, etc.)\n"
        f"Data: {json.dumps(tool_list, ensure_ascii=False)}\n"
        f'Return: {{"results":[{{"id":1,"discovery_category":"ai_tool"}}]}}'
    )
    text = _minimax_chat(prompt, temperature=0.1)
    text = _extract_json(text)
    return json.loads(text).get("results", [])


def _summarize_batch(tool_list: list[dict]) -> list[dict]:
    """Generate short summaries for a batch of tools. Returns list of {id, short_summary, short_summary_zh}."""
    # Keep prompt minimal — reasoning model needs low max_tokens to avoid spending all budget on thinking
    items_json = json.dumps([{"id": t["id"], "title": t["title"]} for t in tool_list], ensure_ascii=False)
    prompt = (
        f"For each item output a one-line summary. JSON only.\n"
        f"short_summary: English ≤60 chars. short_summary_zh: Chinese ≤20 chars.\n"
        f"Items: {items_json}\n"
        f'Format: {{"r":[{{"id":1,"s":"Name — what it does","z":"名称 — 功能"}}]}}'
    )
    text = _minimax_chat(prompt, temperature=0.1)
    text = _extract_json(text)
    data = json.loads(text)
    # support both key names
    raw = data.get("r") or data.get("results") or []
    return [{"id": item.get("id"), "short_summary": item.get("s", item.get("short_summary", "")),
             "short_summary_zh": item.get("z", item.get("short_summary_zh", ""))} for item in raw]


def categorize_tools(tool_ids: list[int]) -> tuple[int, list[str]]:
    """Assign discovery_category to tools via MiniMax.
    Returns (count_categorized, list_of_errors)."""
    errors: list[str] = []
    if not tool_ids or not MINIMAX_API_KEY:
        return 0, errors

    with get_db() as db:
        rows = db.execute(
            f"SELECT id, title, description FROM tools WHERE id IN ({','.join('?' * len(tool_ids))})",
            tool_ids
        ).fetchall()

    if not rows:
        return 0, errors

    tool_list = [{"id": r["id"], "title": r["title"], "description": (r["description"] or "")[:120]} for r in rows]

    categories: dict[int, str] = {}
    CLASSIFY_BATCH = 50
    for i in range(0, len(tool_list), CLASSIFY_BATCH):
        batch = tool_list[i:i + CLASSIFY_BATCH]
        try:
            results = _classify_batch(batch)
            for r in results:
                tid = r.get("id")
                cat = r.get("discovery_category", "other")
                if cat not in ("news", "ai_tool", "other"):
                    cat = "other"
                categories[tid] = cat
        except Exception as e:
            err = f"classify batch {i}-{i+CLASSIFY_BATCH}: {e}"
            logger.error(err)
            errors.append(err)

    if not categories:
        return 0, errors

    with get_db() as db:
        for tid, cat in categories.items():
            db.execute("UPDATE tools SET discovery_category=? WHERE id=?", (cat, tid))

    logger.info(f"Categorized {len(categories)} tools")
    return len(categories), errors


def summarize_tools(tool_ids: list[int]) -> tuple[int, list[str]]:
    """Generate short_summary for tools via MiniMax.
    Returns (count_summarized, list_of_errors)."""
    errors: list[str] = []
    if not tool_ids or not MINIMAX_API_KEY:
        return 0, errors

    with get_db() as db:
        rows = db.execute(
            f"SELECT id, title, description FROM tools WHERE id IN ({','.join('?' * len(tool_ids))})",
            tool_ids
        ).fetchall()

    if not rows:
        return 0, errors

    tool_list = [{"id": r["id"], "title": r["title"], "description": (r["description"] or "")[:120]} for r in rows]

    SUMMARY_BATCH = 20
    summarized = 0
    for i in range(0, len(tool_list), SUMMARY_BATCH):
        batch = tool_list[i:i + SUMMARY_BATCH]
        if not batch:
            continue
        try:
            results = _summarize_batch(batch)
            with get_db() as db:
                for r in results:
                    tid = r.get("id")
                    db.execute(
                        "UPDATE tools SET short_summary=?, short_summary_zh=? WHERE id=?",
                        (r.get("short_summary", ""), r.get("short_summary_zh", ""), tid)
                    )
                    summarized += 1
        except Exception as e:
            err = f"summarize batch {i}-{i+SUMMARY_BATCH}: {e}"
            logger.error(err)
            errors.append(err)

    logger.info(f"Summarized {summarized} tools")
    return summarized, errors
