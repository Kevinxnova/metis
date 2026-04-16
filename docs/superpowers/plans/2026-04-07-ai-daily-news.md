# AI Daily News Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an AI Daily News page to metis that scrapes high-quality AI news sources (The Verge, TechCrunch, Ars Technica, MIT Tech Review, VentureBeat, Wired AI, OpenAI Blog, Google AI Blog), combines them with existing HN/GitHub/PH data, uses MiniMax to generate a structured daily AI briefing, and displays it on a new `/daily-news` frontend page with date navigation and bilingual support.

**Architecture:** New RSS scraper feeds into the existing `tools` table via `BaseScraper`. A new `daily_news.py` module queries all AI-related tools for the day, sends them to MiniMax for structured summarization, and caches results in an `ai_daily_news` table. A health-check cron verifies daily generation succeeded. Frontend adds a `DailyNews.tsx` page with headline cards, quick bites, and editor's take.

**Tech Stack:** Python/Flask backend, feedparser for RSS, MiniMax M2.7 API (existing), React/TypeScript frontend, SQLite/Turso DB.

---

## File Structure

### Backend — New Files
| File | Responsibility |
|------|----------------|
| `backend/scrapers/rss_news.py` | RSS scraper for 8+ AI news sources, extends `BaseScraper` |
| `backend/daily_news.py` | Aggregate today's AI news, call MiniMax, cache result |

### Backend — Modified Files
| File | Change |
|------|--------|
| `backend/requirements.txt` | Add `feedparser` |
| `backend/db/schema.sql` | Add `ai_daily_news` table |
| `backend/db/queries.py` | Add daily news CRUD functions |
| `backend/scheduler.py` | Register `RSSNewsScraper` |
| `backend/api/main.py` | Add 3 daily-news API routes |
| `api/cron.py` | Add daily news generation + health check step |
| `vercel.json` | Add midday health-check cron |

### Frontend — New Files
| File | Responsibility |
|------|----------------|
| `frontend/src/pages/DailyNews.tsx` | Daily news page component |

### Frontend — Modified Files
| File | Change |
|------|--------|
| `frontend/src/api/client.ts` | Add daily news API methods + types |
| `frontend/src/App.tsx` | Add `/daily-news` route |
| `frontend/src/pages/Discover.tsx` | Add nav link to daily news |
| `frontend/src/i18n.ts` | Add daily news translation keys |

---

## Task 1: Add `feedparser` dependency

**Files:**
- Modify: `backend/requirements.txt`

- [ ] **Step 1: Add feedparser to requirements.txt**

Add `feedparser>=6.0.0` to the end of `backend/requirements.txt`:

```
flask>=3.0.0
httpx==0.28.1
deep-translator==1.11.4
openai>=1.0.0
python-dotenv>=1.0.0
feedparser>=6.0.0
```

- [ ] **Step 2: Install the dependency**

Run: `cd metis && pip install feedparser>=6.0.0`
Expected: Successfully installed feedparser

- [ ] **Step 3: Commit**

```bash
git add backend/requirements.txt
git commit -m "chore: add feedparser dependency for RSS news scraping"
```

---

## Task 2: RSS News Scraper

**Files:**
- Create: `backend/scrapers/rss_news.py`
- Modify: `backend/scheduler.py`

- [ ] **Step 1: Create RSS news scraper**

Create `backend/scrapers/rss_news.py`:

```python
"""RSS news scraper for AI-focused publications."""

import logging
import time
from datetime import datetime, timedelta, timezone
import feedparser
import httpx
from backend.scrapers.base import BaseScraper, RawTool
from backend.config import SCRAPE_TIMEOUT_SECONDS

logger = logging.getLogger(__name__)

# High-quality AI news RSS feeds
RSS_FEEDS = [
    {
        "name": "theverge",
        "url": "https://www.theverge.com/rss/ai-artificial-intelligence/index.xml",
        "label": "The Verge",
    },
    {
        "name": "techcrunch",
        "url": "https://techcrunch.com/category/artificial-intelligence/feed/",
        "label": "TechCrunch",
    },
    {
        "name": "arstechnica",
        "url": "https://feeds.arstechnica.com/arstechnica/technology-lab",
        "label": "Ars Technica",
    },
    {
        "name": "mittr",
        "url": "https://www.technologyreview.com/feed/",
        "label": "MIT Technology Review",
    },
    {
        "name": "venturebeat",
        "url": "https://venturebeat.com/category/ai/feed/",
        "label": "VentureBeat",
    },
    {
        "name": "wired_ai",
        "url": "https://www.wired.com/feed/tag/ai/latest/rss",
        "label": "Wired AI",
    },
    {
        "name": "openai_blog",
        "url": "https://openai.com/blog/rss.xml",
        "label": "OpenAI Blog",
    },
    {
        "name": "google_ai",
        "url": "https://blog.google/technology/ai/rss/",
        "label": "Google AI Blog",
    },
]

# Entries older than this many hours are skipped
MAX_AGE_HOURS = 48


class RSSNewsScraper(BaseScraper):
    """Scrapes multiple AI-focused RSS feeds."""

    source_name = "rss_news"

    def fetch_raw(self) -> list[RawTool]:
        tools: list[RawTool] = []
        cutoff = datetime.now(timezone.utc) - timedelta(hours=MAX_AGE_HOURS)

        for feed_conf in RSS_FEEDS:
            try:
                items = self._fetch_feed(feed_conf, cutoff)
                tools.extend(items)
                logger.info(f"RSS {feed_conf['name']}: {len(items)} items")
            except Exception as e:
                logger.warning(f"RSS {feed_conf['name']} failed: {e}")

        return tools

    def _fetch_feed(self, feed_conf: dict, cutoff: datetime) -> list[RawTool]:
        """Fetch and parse a single RSS feed."""
        # Use httpx to fetch raw XML (some feeds block default feedparser UA)
        resp = httpx.get(
            feed_conf["url"],
            timeout=SCRAPE_TIMEOUT_SECONDS,
            headers={"User-Agent": "Metis/1.0 (AI news aggregator)"},
            follow_redirects=True,
        )
        resp.raise_for_status()
        parsed = feedparser.parse(resp.text)

        items: list[RawTool] = []
        for entry in parsed.entries:
            # Parse publish date
            published = self._parse_date(entry)
            if published and published < cutoff:
                continue

            url = entry.get("link", "")
            if not url:
                continue

            title = (entry.get("title") or "").strip()
            if not title:
                continue

            # Extract description: prefer summary, fallback to content
            description = ""
            if entry.get("summary"):
                description = entry.summary
            elif entry.get("content"):
                description = entry.content[0].get("value", "")
            # Strip HTML tags for clean text
            description = self._strip_html(description)[:500]

            items.append(RawTool(
                url=url,
                title=title,
                description=description,
                source_url=url,
                metrics={"rss_source": feed_conf["name"], "rss_label": feed_conf["label"]},
            ))

        return items

    @staticmethod
    def _parse_date(entry) -> datetime | None:
        """Parse entry published date to UTC datetime."""
        for attr in ("published_parsed", "updated_parsed"):
            tp = getattr(entry, attr, None)
            if tp:
                try:
                    return datetime(*tp[:6], tzinfo=timezone.utc)
                except Exception:
                    pass
        return None

    @staticmethod
    def _strip_html(text: str) -> str:
        """Remove HTML tags from text."""
        import re
        text = re.sub(r'<[^>]+>', '', text)
        text = re.sub(r'\s+', ' ', text).strip()
        return text
```

- [ ] **Step 2: Register in scheduler**

In `backend/scheduler.py`, add the import and registration:

Add import at the top (after the existing scraper imports):
```python
from backend.scrapers.rss_news import RSSNewsScraper
```

Add to `SCRAPERS` list:
```python
SCRAPERS = [
    GitHubScraper(),
    HNScraper(),
    ProductHuntScraper(),
    RSSNewsScraper(),
]
```

- [ ] **Step 3: Verify scraper runs locally**

Run: `cd metis && python -c "from backend.scrapers.rss_news import RSSNewsScraper; s = RSSNewsScraper(); print(len(s.fetch_raw()), 'items fetched')"`

Expected: A number > 0 items fetched (likely 30-100+)

- [ ] **Step 4: Commit**

```bash
git add backend/scrapers/rss_news.py backend/scheduler.py
git commit -m "feat: add RSS news scraper for The Verge, TechCrunch, Ars Technica, MIT Tech Review, VentureBeat, Wired AI, OpenAI Blog, Google AI Blog"
```

---

## Task 3: Database — `ai_daily_news` table

**Files:**
- Modify: `backend/db/schema.sql`

- [ ] **Step 1: Add table to schema**

Append to the end of `backend/db/schema.sql` (before the CREATE INDEX statements):

```sql
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
);

CREATE INDEX IF NOT EXISTS idx_daily_news_date ON ai_daily_news(news_date);
```

- [ ] **Step 2: Commit**

```bash
git add backend/db/schema.sql
git commit -m "feat: add ai_daily_news table schema"
```

---

## Task 4: Daily News DB Queries

**Files:**
- Modify: `backend/db/queries.py`

- [ ] **Step 1: Add daily news query functions**

Add to the end of `backend/db/queries.py`:

```python
# --- AI Daily News ---

def save_daily_news(news_date: str, headlines: list, quick_bites: list,
                    editor_take: str, editor_take_en: str,
                    source_tool_ids: list, model: str) -> int:
    """Save or update a daily news entry. Returns row id."""
    with get_db() as db:
        existing = db.execute(
            "SELECT id FROM ai_daily_news WHERE news_date = ?", (news_date,)
        ).fetchone()
        if existing:
            db.execute(
                """UPDATE ai_daily_news
                   SET headlines=?, quick_bites=?, editor_take=?, editor_take_en=?,
                       source_tool_ids=?, model=?
                   WHERE news_date=?""",
                (json.dumps(headlines, ensure_ascii=False),
                 json.dumps(quick_bites, ensure_ascii=False),
                 editor_take, editor_take_en,
                 json.dumps(source_tool_ids), model, news_date)
            )
            return existing["id"]
        else:
            cursor = db.execute(
                """INSERT INTO ai_daily_news
                   (news_date, headlines, quick_bites, editor_take, editor_take_en, source_tool_ids, model)
                   VALUES (?, ?, ?, ?, ?, ?, ?)""",
                (news_date,
                 json.dumps(headlines, ensure_ascii=False),
                 json.dumps(quick_bites, ensure_ascii=False),
                 editor_take, editor_take_en,
                 json.dumps(source_tool_ids), model)
            )
            return cursor.lastrowid


def get_daily_news(date: str | None = None) -> dict | None:
    """Get daily news for a specific date (default today). Falls back to latest."""
    with get_db() as db:
        if date:
            row = db.execute(
                "SELECT * FROM ai_daily_news WHERE news_date = ?", (date,)
            ).fetchone()
        else:
            row = db.execute(
                "SELECT * FROM ai_daily_news WHERE news_date = date('now')"
            ).fetchone()
            if not row:
                row = db.execute(
                    "SELECT * FROM ai_daily_news ORDER BY news_date DESC LIMIT 1"
                ).fetchone()
        if not row:
            return None
        d = dict(row)
        d["headlines"] = json.loads(d["headlines"])
        d["quick_bites"] = json.loads(d["quick_bites"])
        d["source_tool_ids"] = json.loads(d["source_tool_ids"])
        return d


def get_daily_news_list(limit: int = 7, offset: int = 0) -> list[dict]:
    """Get recent daily news entries (metadata only, no full content)."""
    with get_db() as db:
        rows = db.execute(
            """SELECT id, news_date, editor_take, editor_take_en, model, created_at
               FROM ai_daily_news ORDER BY news_date DESC LIMIT ? OFFSET ?""",
            (limit, offset)
        ).fetchall()
        return [dict(row) for row in rows]
```

- [ ] **Step 2: Commit**

```bash
git add backend/db/queries.py
git commit -m "feat: add daily news CRUD query functions"
```

---

## Task 5: Daily News Generator (MiniMax)

**Files:**
- Create: `backend/daily_news.py`

- [ ] **Step 1: Create daily news generator**

Create `backend/daily_news.py`:

```python
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
```

- [ ] **Step 2: Commit**

```bash
git add backend/daily_news.py
git commit -m "feat: add daily news generator using MiniMax to summarize aggregated AI news"
```

---

## Task 6: Flask API Routes

**Files:**
- Modify: `backend/api/main.py`

- [ ] **Step 1: Add import**

Add to the imports at the top of `backend/api/main.py`:

```python
from backend.db.queries import (
    # ... existing imports ...
    get_daily_news, get_daily_news_list,
)
```

- [ ] **Step 2: Add 3 API routes**

Add before the `# Init DB on import` line at the bottom of `backend/api/main.py`:

```python
# --- AI Daily News ---

@app.route("/api/daily-news")
def daily_news():
    date = request.args.get("date")
    news = get_daily_news(date)
    if not news:
        return jsonify({"detail": "No daily news available"}), 404
    return jsonify(news)


@app.route("/api/daily-news/list")
def daily_news_list():
    limit = int(request.args.get("limit", 7))
    offset = int(request.args.get("offset", 0))
    return jsonify(get_daily_news_list(limit, offset))


@app.route("/api/daily-news/generate", methods=["POST"])
def generate_daily_news_route():
    from backend.daily_news import generate_daily_news
    force = request.args.get("force", "false").lower() == "true"
    result = generate_daily_news(force=force)
    if not result:
        return jsonify({"detail": "Generation failed — check logs or news availability"}), 500
    return jsonify({"ok": True, "news": result})
```

- [ ] **Step 3: Commit**

```bash
git add backend/api/main.py
git commit -m "feat: add daily-news API endpoints (get, list, generate)"
```

---

## Task 7: Cron Integration + Health Check

**Files:**
- Modify: `api/cron.py`
- Modify: `vercel.json`

- [ ] **Step 1: Add daily news generation to cron pipeline**

In `api/cron.py`, add the daily news generation step after the AI picks line. Add this before the final `return jsonify(...)`:

```python
    # Generate AI daily news briefing
    from backend.daily_news import generate_daily_news as gen_daily_news
    daily_news_result = gen_daily_news()
    daily_news_ok = daily_news_result is not None
```

Update the return jsonify to include:
```python
    return jsonify({
        "scrape": results,
        "classified": classified,
        "translated": translated,
        "digest": len(digest),
        "ai_picks": len(ai_picks),
        "daily_news": daily_news_ok,
    })
```

- [ ] **Step 2: Add midday health-check cron**

In `vercel.json`, update the crons array to add a midday check at 14:00 UTC (to catch if the 8:00 run missed):

```json
  "crons": [
    {
      "path": "/api/cron",
      "schedule": "0 8,14,20 * * *"
    }
  ]
```

The daily news generator already has cache logic — if today's news exists, it returns the cached version without re-generating. So the 14:00 run is effectively a health check: if 8:00 succeeded, it's a no-op; if 8:00 failed, 14:00 retries.

- [ ] **Step 3: Commit**

```bash
git add api/cron.py vercel.json
git commit -m "feat: integrate daily news into cron pipeline with midday health-check"
```

---

## Task 8: Frontend API Client

**Files:**
- Modify: `frontend/src/api/client.ts`

- [ ] **Step 1: Add types**

Add after the `AiPick` interface at the end of `client.ts`:

```typescript
export interface DailyNewsHeadline {
  rank: number
  title: string
  title_en: string
  summary: string
  summary_en: string
  source: string
  source_url: string
  tag: string
}

export interface DailyNewsQuickBite {
  text: string
  text_en: string
  source: string
  source_url: string
}

export interface DailyNews {
  id: number
  news_date: string
  headlines: DailyNewsHeadline[]
  quick_bites: DailyNewsQuickBite[]
  editor_take: string
  editor_take_en: string
  model: string
  created_at: string
}

export interface DailyNewsMeta {
  id: number
  news_date: string
  editor_take: string
  editor_take_en: string
  model: string
  created_at: string
}
```

- [ ] **Step 2: Add API methods**

Add to the `api` object (inside the export):

```typescript
  // Daily News
  getDailyNews: (date?: string) => {
    const qs = date ? `?date=${date}` : ''
    return request<DailyNews>(`/daily-news${qs}`)
  },
  getDailyNewsList: (limit = 7, offset = 0) =>
    request<DailyNewsMeta[]>(`/daily-news/list?limit=${limit}&offset=${offset}`),
  generateDailyNews: (force = false) =>
    request<{ ok: boolean; news: DailyNews }>(`/daily-news/generate${force ? '?force=true' : ''}`, { method: 'POST' }),
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/api/client.ts
git commit -m "feat: add daily news types and API methods to frontend client"
```

---

## Task 9: i18n Translation Keys

**Files:**
- Modify: `frontend/src/i18n.ts`

- [ ] **Step 1: Add daily news translation keys**

Add to the `zh` messages object (after the `translating` entry):

```typescript
    // Daily News
    dailyNews: 'AI 日报',
    dailyNewsSubtitle: '每日 AI 科技要闻',
    headlines: '头条',
    quickBites: '快讯',
    editorTake: '编辑视角',
    noNewsToday: '今日暂无日报',
    noNewsDesc: '日报将在每日爬虫完成后自动生成',
    viewSource: '查看原文',
    tag_model: '模型发布',
    tag_funding: '融资',
    tag_opensource: '开源',
    tag_product: '产品',
    tag_policy: '政策',
    tag_research: '研究',
    tag_tool: '工具',
```

Add to the `en` messages object (after the `translating` entry):

```typescript
    // Daily News
    dailyNews: 'AI Daily',
    dailyNewsSubtitle: 'Your daily AI tech briefing',
    headlines: 'Headlines',
    quickBites: 'Quick Bites',
    editorTake: "Editor's Take",
    noNewsToday: 'No briefing today',
    noNewsDesc: 'The daily briefing is generated after the scraper runs',
    viewSource: 'View source',
    tag_model: 'Model',
    tag_funding: 'Funding',
    tag_opensource: 'Open Source',
    tag_product: 'Product',
    tag_policy: 'Policy',
    tag_research: 'Research',
    tag_tool: 'Tool',
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/i18n.ts
git commit -m "feat: add daily news i18n translation keys (zh/en)"
```

---

## Task 10: DailyNews Page Component

**Files:**
- Create: `frontend/src/pages/DailyNews.tsx`

- [ ] **Step 1: Create the page component**

Create `frontend/src/pages/DailyNews.tsx`:

```tsx
import { useState, useEffect } from 'react'
import { api, DailyNews as DailyNewsType } from '../api/client'
import { Lang, t } from '../i18n'

const TAG_COLORS: Record<string, string> = {
  '模型发布': '#f472b6',
  '融资': '#fbbf24',
  '开源': '#34d399',
  '产品': '#60a5fa',
  '政策': '#f87171',
  '研究': '#a78bfa',
  '工具': '#38bdf8',
}

function formatDate(dateStr: string, lang: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  if (lang === 'zh') {
    return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`
  }
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}

function shiftDate(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

const tagKey = (tag: string, lang: string): string => {
  const map: Record<string, string> = {
    '模型发布': lang === 'zh' ? '模型发布' : 'Model',
    '融资': lang === 'zh' ? '融资' : 'Funding',
    '开源': lang === 'zh' ? '开源' : 'Open Source',
    '产品': lang === 'zh' ? '产品' : 'Product',
    '政策': lang === 'zh' ? '政策' : 'Policy',
    '研究': lang === 'zh' ? '研究' : 'Research',
    '工具': lang === 'zh' ? '工具' : 'Tool',
  }
  return map[tag] || tag
}

export default function DailyNews({ lang }: { lang: Lang }) {
  const [news, setNews] = useState<DailyNewsType | null>(null)
  const [currentDate, setCurrentDate] = useState<string>(new Date().toISOString().split('T')[0])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const isZh = lang === 'zh'

  useEffect(() => {
    setLoading(true)
    setError(false)
    api.getDailyNews(currentDate)
      .then(data => { setNews(data); setLoading(false) })
      .catch(() => { setNews(null); setError(true); setLoading(false) })
  }, [currentDate])

  const goDay = (offset: number) => {
    setCurrentDate(prev => shiftDate(prev, offset))
  }

  return (
    <div style={{ background: '#050510', minHeight: '100vh', color: '#fff' }}>
      {/* Header */}
      <header style={{ maxWidth: 720, margin: '0 auto', padding: '40px 24px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <a href="/discover" style={{ color: '#666', textDecoration: 'none', fontSize: 13 }}>
            ← {isZh ? '返回' : 'Back'}
          </a>
          <a href="/" style={{ textDecoration: 'none' }}>
            <span style={{
              fontSize: 20, fontWeight: 700,
              background: 'linear-gradient(135deg, #60a5fa, #a78bfa, #f472b6)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            }}>Metis</span>
          </a>
        </div>

        <h1 style={{ fontSize: 28, fontWeight: 700, margin: '0 0 4px' }}>
          {t(lang, 'dailyNews')}
        </h1>
        <p style={{ color: '#666', fontSize: 14, margin: '0 0 20px' }}>
          {t(lang, 'dailyNewsSubtitle')}
        </p>

        {/* Date Navigation */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 16, marginBottom: 32,
          padding: '8px 0', borderBottom: '1px solid #1a1a2e',
        }}>
          <button onClick={() => goDay(-1)} style={navBtnStyle}>{'<'}</button>
          <span style={{ fontSize: 15, color: '#ccc', minWidth: 160, textAlign: 'center' }}>
            {formatDate(currentDate, lang)}
          </span>
          <button
            onClick={() => goDay(1)}
            disabled={currentDate >= new Date().toISOString().split('T')[0]}
            style={{
              ...navBtnStyle,
              opacity: currentDate >= new Date().toISOString().split('T')[0] ? 0.3 : 1,
            }}
          >{'>'}</button>
        </div>
      </header>

      {/* Content */}
      <main style={{ maxWidth: 720, margin: '0 auto', padding: '0 24px 64px' }}>
        {loading ? (
          <p style={{ color: '#555', textAlign: 'center', padding: 48 }}>
            {isZh ? '加载中...' : 'Loading...'}
          </p>
        ) : error || !news ? (
          <div style={{ textAlign: 'center', padding: 48 }}>
            <p style={{ color: '#555', fontSize: 18, marginBottom: 8 }}>{t(lang, 'noNewsToday')}</p>
            <p style={{ color: '#333', fontSize: 13 }}>{t(lang, 'noNewsDesc')}</p>
          </div>
        ) : (
          <>
            {/* Headlines */}
            <section style={{ marginBottom: 40 }}>
              <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16, color: '#e0e0e0' }}>
                {t(lang, 'headlines')}
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {news.headlines.map((h, i) => (
                  <div key={i} style={cardStyle}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <span style={{
                        fontSize: 11, padding: '2px 8px', borderRadius: 4,
                        background: (TAG_COLORS[h.tag] || '#666') + '22',
                        color: TAG_COLORS[h.tag] || '#888',
                        fontWeight: 600,
                      }}>
                        {tagKey(h.tag, lang)}
                      </span>
                      <span style={{ color: '#555', fontSize: 12 }}>{h.source}</span>
                    </div>
                    <h3 style={{ fontSize: 16, fontWeight: 600, margin: '0 0 8px', lineHeight: 1.4 }}>
                      {isZh ? h.title : h.title_en}
                    </h3>
                    <p style={{ color: '#999', fontSize: 14, lineHeight: 1.6, margin: '0 0 12px' }}>
                      {isZh ? h.summary : h.summary_en}
                    </p>
                    {h.source_url && (
                      <a
                        href={h.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: '#60a5fa', fontSize: 12, textDecoration: 'none' }}
                      >
                        {t(lang, 'viewSource')} →
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </section>

            {/* Quick Bites */}
            {news.quick_bites.length > 0 && (
              <section style={{ marginBottom: 40 }}>
                <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16, color: '#e0e0e0' }}>
                  {t(lang, 'quickBites')}
                </h2>
                <div style={{
                  background: '#0a0a1a', borderRadius: 8, padding: 16,
                  border: '1px solid #1a1a2e',
                }}>
                  {news.quick_bites.map((qb, i) => (
                    <div key={i} style={{
                      padding: '10px 0',
                      borderBottom: i < news.quick_bites.length - 1 ? '1px solid #1a1a2e' : 'none',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12,
                    }}>
                      <span style={{ color: '#ccc', fontSize: 14, lineHeight: 1.5 }}>
                        {isZh ? qb.text : qb.text_en}
                      </span>
                      <a
                        href={qb.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: '#555', fontSize: 12, flexShrink: 0, textDecoration: 'none' }}
                      >
                        {qb.source}
                      </a>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Editor's Take */}
            {(news.editor_take || news.editor_take_en) && (
              <section style={{ marginBottom: 40 }}>
                <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16, color: '#e0e0e0' }}>
                  {t(lang, 'editorTake')}
                </h2>
                <div style={{
                  background: 'linear-gradient(135deg, rgba(96,165,250,0.08), rgba(167,139,250,0.08))',
                  borderRadius: 8, padding: 20,
                  borderLeft: '3px solid #a78bfa',
                }}>
                  <p style={{ color: '#bbb', fontSize: 14, lineHeight: 1.8, margin: 0 }}>
                    {isZh ? news.editor_take : news.editor_take_en}
                  </p>
                </div>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  )
}

const navBtnStyle: React.CSSProperties = {
  background: 'none', border: '1px solid #2a2a3a', borderRadius: 6,
  color: '#999', fontSize: 16, padding: '4px 12px', cursor: 'pointer',
}

const cardStyle: React.CSSProperties = {
  background: '#0a0a1a', borderRadius: 8, padding: 20,
  border: '1px solid #1a1a2e',
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/DailyNews.tsx
git commit -m "feat: add DailyNews page component with headlines, quick bites, editor take, and date navigation"
```

---

## Task 11: Route Registration + Navigation Link

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/pages/Discover.tsx`

- [ ] **Step 1: Add route to App.tsx**

In `frontend/src/App.tsx`, add import:

```typescript
import DailyNews from './pages/DailyNews'
```

Add Route inside `<Routes>` (after the community route):

```tsx
<Route path="/daily-news" element={<DailyNews lang={lang} />} />
```

- [ ] **Step 2: Add nav link in Discover header**

In `frontend/src/pages/Discover.tsx`, find the nav div with the Community and About links (around line 68). Add a daily news link before the Community link:

```tsx
<a href="/daily-news" style={{
  fontSize: 12, color: '#60a5fa', textDecoration: 'none',
  padding: '4px 10px', border: '1px solid rgba(96,165,250,0.3)', borderRadius: 4,
}}>
  {isZh ? 'AI 日报' : 'AI Daily'}
</a>
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/App.tsx frontend/src/pages/Discover.tsx
git commit -m "feat: register /daily-news route and add nav link in Discover header"
```

---

## Task 12: Database Init — Ensure Table Created

**Files:**
- Modify: `backend/db/__init__.py` (if `init_db` doesn't auto-run schema.sql)

- [ ] **Step 1: Verify init_db creates the new table**

Read `backend/db/__init__.py` and check if `init_db()` executes `schema.sql`. If it does, no changes needed — the `ai_daily_news` table will be created automatically.

If `init_db()` does NOT run `schema.sql` on every start (common with SQLite), add a manual CREATE TABLE call. In `backend/daily_news.py`, add table creation at module level (same pattern as `ai_recommend.py` which has `CACHE_TABLE` + `_ensure_table()`):

Add to `backend/daily_news.py` at the top-level:

```python
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
```

Then call `_ensure_table()` at the start of both `save_daily_news` and `get_daily_news` query functions, or at the top of `generate_daily_news()`.

- [ ] **Step 2: Commit (if changes needed)**

```bash
git add backend/daily_news.py
git commit -m "fix: ensure ai_daily_news table is created before first use"
```

---

## Task 13: End-to-End Verification

- [ ] **Step 1: Start backend**

Run: `cd metis && python -m backend.api.main`
Expected: Flask server starts on port 8000

- [ ] **Step 2: Verify RSS scraper works**

Run: `cd metis && python -c "from backend.db import init_db; init_db(); from backend.scrapers.rss_news import RSSNewsScraper; r = RSSNewsScraper().run(); print(r)"`
Expected: `{'source': 'rss_news', 'status': 'success', 'tools_found': N, 'tools_new': N, ...}`

- [ ] **Step 3: Verify daily news generation**

Run: `curl -X POST http://127.0.0.1:8000/api/daily-news/generate`
Expected: JSON with `{"ok": true, "news": {...}}` containing headlines, quick_bites, editor_take

- [ ] **Step 4: Verify GET endpoint**

Run: `curl http://127.0.0.1:8000/api/daily-news`
Expected: Same daily news JSON

- [ ] **Step 5: Verify frontend**

Run: `cd metis/frontend && npm run dev`
Visit: `http://localhost:5173/daily-news`
Expected: Daily news page renders with headlines, quick bites, and editor's take

- [ ] **Step 6: Verify nav link**

Visit: `http://localhost:5173/discover`
Expected: "AI 日报" link appears in header nav, clicking it goes to `/daily-news`

- [ ] **Step 7: Final commit**

```bash
git add -A
git commit -m "feat: AI daily news — complete feature with RSS scraping, MiniMax summarization, and frontend page"
```
