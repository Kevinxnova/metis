# Cron Split & Monitoring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the monolithic `/api/cron` into independent sub-task endpoints with persistent logging to Turso, so failures are traceable and tasks don't steal each other's time budget.

**Architecture:** Each cron sub-task (`scrape`, `daily-news`, `classify`, `digest`) gets its own Vercel Function endpoint with independent 600s timeout. A `cron_logs` table in Turso records every execution with step-level timing, status, and error details. The original `/api/cron` is preserved as a manual full-pipeline trigger.

**Tech Stack:** Python/Flask on Vercel Functions, Turso (libsql HTTP API), existing MiniMax integration

---

## File Structure

| File | Role |
|------|------|
| `backend/db/schema.sql` | Add `cron_logs` table |
| `backend/db/queries.py` | Add `log_cron_run` and `get_cron_logs` functions |
| `backend/cron_tasks.py` | **New.** Four standalone task functions with logging |
| `api/cron_scrape.py` | **New.** Vercel Function for `/api/cron/scrape` |
| `api/cron_daily_news.py` | **New.** Vercel Function for `/api/cron/daily-news` |
| `api/cron_classify.py` | **New.** Vercel Function for `/api/cron/classify` |
| `api/cron_digest.py` | **New.** Vercel Function for `/api/cron/digest` |
| `api/cron.py` | Keep as manual full-pipeline trigger, refactor to call shared task functions |
| `backend/api/main.py` | Add `/api/cron-logs` endpoint |
| `vercel.json` | Update cron schedules and add function configs + rewrites |

---

### Task 1: Add `cron_logs` table to schema

**Files:**
- Modify: `backend/db/schema.sql` (append after line 88)
- Modify: `backend/db/queries.py` (append new functions)

- [ ] **Step 1: Add table definition to schema.sql**

Append to the end of `backend/db/schema.sql` (before the CREATE INDEX block):

```sql
CREATE TABLE IF NOT EXISTS cron_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_date TEXT NOT NULL,
    task_name TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('success', 'error', 'timeout', 'skipped')),
    steps TEXT DEFAULT '{}',
    error_message TEXT,
    duration_seconds REAL,
    metadata TEXT DEFAULT '{}',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_cron_logs_date ON cron_logs(run_date);
CREATE INDEX IF NOT EXISTS idx_cron_logs_task ON cron_logs(task_name);
```

- [ ] **Step 2: Add query functions to queries.py**

Append to `backend/db/queries.py`:

```python
# --- Cron Logs ---

def log_cron_run(run_date: str, task_name: str, status: str,
                 steps: dict | None = None, error_message: str | None = None,
                 duration_seconds: float = 0, metadata: dict | None = None):
    """Log a cron task execution."""
    with get_db() as db:
        db.execute(
            """INSERT INTO cron_logs
               (run_date, task_name, status, steps, error_message, duration_seconds, metadata)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (run_date, task_name, status,
             json.dumps(steps or {}), error_message,
             round(duration_seconds, 2),
             json.dumps(metadata or {}))
        )


def get_cron_logs(limit: int = 50, task_name: str | None = None) -> list[dict]:
    """Get recent cron logs, optionally filtered by task name."""
    with get_db() as db:
        if task_name:
            rows = db.execute(
                "SELECT * FROM cron_logs WHERE task_name = ? ORDER BY created_at DESC LIMIT ?",
                (task_name, limit)
            ).fetchall()
        else:
            rows = db.execute(
                "SELECT * FROM cron_logs ORDER BY created_at DESC LIMIT ?",
                (limit,)
            ).fetchall()
        result = []
        for row in rows:
            d = dict(row)
            d["steps"] = json.loads(d["steps"])
            d["metadata"] = json.loads(d["metadata"])
            result.append(d)
        return result
```

- [ ] **Step 3: Run init_db locally to verify table creation**

```bash
cd metis && source .env && export $(grep -v '^#' .env | xargs) && python3 -c "
from backend.db import init_db
init_db()
print('Schema OK')
"
```

Expected: `Schema OK`, no errors.

- [ ] **Step 4: Commit**

```bash
git add backend/db/schema.sql backend/db/queries.py
git commit -m "feat: add cron_logs table for monitoring cron executions"
```

---

### Task 2: Create shared cron task functions

**Files:**
- Create: `backend/cron_tasks.py`

This module contains four task functions, each self-contained with timing, logging, and error handling. Each function takes no arguments (reads date from `date.today()`) and returns a status dict.

- [ ] **Step 1: Create `backend/cron_tasks.py`**

```python
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
            # Import the generate function from cron.py's logic
            from api.cron import generate_daily_digest
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
```

- [ ] **Step 2: Commit**

```bash
git add backend/cron_tasks.py
git commit -m "feat: add shared cron task functions with per-step logging"
```

---

### Task 3: Move `generate_daily_digest` out of `api/cron.py`

The `generate_daily_digest` function currently lives inside `api/cron.py`. `backend/cron_tasks.py` needs it. Move it to a shared location.

**Files:**
- Modify: `backend/daily_news.py` (append the function)
- Modify: `api/cron.py` (replace inline function with import)
- Modify: `backend/cron_tasks.py` (update import)

- [ ] **Step 1: Move `generate_daily_digest` to `backend/daily_news.py`**

Append to the end of `backend/daily_news.py`:

```python
def generate_daily_digest() -> list[dict]:
    """Use AI to pick 3 tools + 2 hot news from today's discoveries."""
    import os
    import re
    from backend.db.queries import get_today_tools, get_daily_digest, save_daily_digest

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
            metrics = json.loads(t.get("metrics", "{}")) if isinstance(t.get("metrics"), str) else t.get("metrics", {})
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
            model=MINIMAX_MODEL,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=1500,
            temperature=0.7,
        )

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
```

- [ ] **Step 2: Update `api/cron.py` — replace inline `generate_daily_digest` with import**

In `api/cron.py`, delete the entire `generate_daily_digest` function (lines 32-112), and in the cron handler's Step 5, replace:

```python
        digest = generate_daily_digest()
```

with:

```python
        from backend.daily_news import generate_daily_digest
        digest = generate_daily_digest()
```

- [ ] **Step 3: Update `backend/cron_tasks.py` — fix the import in `task_digest`**

In `task_digest()`, change:

```python
            from api.cron import generate_daily_digest
            digest = generate_daily_digest()
```

to:

```python
            from backend.daily_news import generate_daily_digest
            digest = generate_daily_digest()
```

- [ ] **Step 4: Commit**

```bash
git add backend/daily_news.py api/cron.py backend/cron_tasks.py
git commit -m "refactor: move generate_daily_digest to backend/daily_news.py"
```

---

### Task 4: Create Vercel Function endpoints for each sub-task

**Files:**
- Create: `api/cron_scrape.py`
- Create: `api/cron_daily_news.py`
- Create: `api/cron_classify.py`
- Create: `api/cron_digest.py`

Each file follows the same pattern: Flask app with one route, auth check, delegates to shared task function.

- [ ] **Step 1: Create `api/cron_scrape.py`**

```python
"""Vercel Cron — scrape all sources."""

import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from dotenv import load_dotenv
load_dotenv()

from flask import Flask, jsonify, request

app = Flask(__name__)
CRON_SECRET = os.getenv("CRON_SECRET", "")


@app.route("/api/cron/scrape", methods=["GET"])
def cron_scrape():
    if CRON_SECRET and request.headers.get("Authorization") != f"Bearer {CRON_SECRET}":
        return jsonify({"error": "Unauthorized"}), 401
    from backend.cron_tasks import task_scrape
    return jsonify(task_scrape())
```

- [ ] **Step 2: Create `api/cron_daily_news.py`**

```python
"""Vercel Cron — generate daily news."""

import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from dotenv import load_dotenv
load_dotenv()

from flask import Flask, jsonify, request

app = Flask(__name__)
CRON_SECRET = os.getenv("CRON_SECRET", "")


@app.route("/api/cron/daily-news", methods=["GET"])
def cron_daily_news():
    if CRON_SECRET and request.headers.get("Authorization") != f"Bearer {CRON_SECRET}":
        return jsonify({"error": "Unauthorized"}), 401
    from backend.cron_tasks import task_daily_news
    return jsonify(task_daily_news())
```

- [ ] **Step 3: Create `api/cron_classify.py`**

```python
"""Vercel Cron — classify and translate tools."""

import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from dotenv import load_dotenv
load_dotenv()

from flask import Flask, jsonify, request

app = Flask(__name__)
CRON_SECRET = os.getenv("CRON_SECRET", "")


@app.route("/api/cron/classify", methods=["GET"])
def cron_classify():
    if CRON_SECRET and request.headers.get("Authorization") != f"Bearer {CRON_SECRET}":
        return jsonify({"error": "Unauthorized"}), 401
    from backend.cron_tasks import task_classify
    return jsonify(task_classify())
```

- [ ] **Step 4: Create `api/cron_digest.py`**

```python
"""Vercel Cron — generate digest and AI recommendations."""

import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from dotenv import load_dotenv
load_dotenv()

from flask import Flask, jsonify, request

app = Flask(__name__)
CRON_SECRET = os.getenv("CRON_SECRET", "")


@app.route("/api/cron/digest", methods=["GET"])
def cron_digest():
    if CRON_SECRET and request.headers.get("Authorization") != f"Bearer {CRON_SECRET}":
        return jsonify({"error": "Unauthorized"}), 401
    from backend.cron_tasks import task_digest
    return jsonify(task_digest())
```

- [ ] **Step 5: Commit**

```bash
git add api/cron_scrape.py api/cron_daily_news.py api/cron_classify.py api/cron_digest.py
git commit -m "feat: add independent Vercel Function endpoints for each cron sub-task"
```

---

### Task 5: Update `vercel.json` — rewrites, function configs, cron schedules

**Files:**
- Modify: `vercel.json`

- [ ] **Step 1: Replace `vercel.json` with new config**

```json
{
  "buildCommand": "cd frontend && npm install && npm run build",
  "outputDirectory": "frontend/dist",
  "functions": {
    "api/cron.py": {
      "maxDuration": 600
    },
    "api/cron_scrape.py": {
      "maxDuration": 600
    },
    "api/cron_daily_news.py": {
      "maxDuration": 300
    },
    "api/cron_classify.py": {
      "maxDuration": 600
    },
    "api/cron_digest.py": {
      "maxDuration": 300
    }
  },
  "rewrites": [
    { "source": "/api/cron/scrape", "destination": "/api/cron_scrape.py" },
    { "source": "/api/cron/daily-news", "destination": "/api/cron_daily_news.py" },
    { "source": "/api/cron/classify", "destination": "/api/cron_classify.py" },
    { "source": "/api/cron/digest", "destination": "/api/cron_digest.py" },
    { "source": "/api/cron", "destination": "/api/cron.py" },
    { "source": "/api/(.*)", "destination": "/api/index.py" },
    { "source": "/((?!api/).*)", "destination": "/index.html" }
  ],
  "crons": [
    {
      "path": "/api/cron/scrape",
      "schedule": "0 0 * * *"
    },
    {
      "path": "/api/cron/daily-news",
      "schedule": "30 0 * * *"
    },
    {
      "path": "/api/cron/classify",
      "schedule": "0 1 * * *"
    },
    {
      "path": "/api/cron/digest",
      "schedule": "30 1 * * *"
    },
    {
      "path": "/api/cron/daily-news",
      "schedule": "0 6 * * *"
    }
  ]
}
```

Key decisions:
- Sub-task rewrites MUST come before the catch-all `/api/cron` rewrite (Vercel matches first-match)
- `scrape` and `classify` get 600s (they loop over many items)
- `daily-news` and `digest` get 300s (single API call each, plenty of time)
- 14:00 Beijing retry for daily-news as fallback

- [ ] **Step 2: Commit**

```bash
git add vercel.json
git commit -m "feat: split cron into independent sub-tasks with separate schedules"
```

---

### Task 6: Add `/api/cron-logs` endpoint

**Files:**
- Modify: `backend/api/main.py` (append route)

- [ ] **Step 1: Add cron logs endpoint**

Append before the `# Init DB on import` line in `backend/api/main.py`:

```python
# --- Cron Logs ---

@app.route("/api/cron-logs")
def cron_logs():
    from backend.db.queries import get_cron_logs
    task = request.args.get("task")
    limit = int(request.args.get("limit", 50))
    return jsonify(get_cron_logs(limit=limit, task_name=task))
```

- [ ] **Step 2: Commit**

```bash
git add backend/api/main.py
git commit -m "feat: add /api/cron-logs endpoint for monitoring"
```

---

### Task 7: Refactor existing `api/cron.py` to use shared tasks

**Files:**
- Modify: `api/cron.py`

Keep the `/api/cron` endpoint as a manual full-pipeline trigger, but refactor it to call the shared task functions sequentially and aggregate results.

- [ ] **Step 1: Rewrite `api/cron.py`**

Replace the entire file content with:

```python
"""Vercel Cron — full pipeline (manual trigger / legacy).

Runs all tasks sequentially: scrape → daily_news → classify → digest.
Kept as a manual full-pipeline trigger. Scheduled crons now use individual endpoints.
"""

import sys
import os
import time
import logging

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv()

from flask import Flask, jsonify, request

app = Flask(__name__)
logger = logging.getLogger(__name__)

CRON_SECRET = os.getenv("CRON_SECRET", "")
MAX_DURATION = 540


@app.route("/api/cron", methods=["GET"])
def cron():
    if CRON_SECRET and request.headers.get("Authorization") != f"Bearer {CRON_SECRET}":
        return jsonify({"error": "Unauthorized"}), 401

    start = time.time()
    from backend.cron_tasks import task_scrape, task_daily_news, task_classify, task_digest

    results = {}

    for name, fn in [("scrape", task_scrape), ("daily_news", task_daily_news),
                     ("classify", task_classify), ("digest", task_digest)]:
        if time.time() - start > MAX_DURATION:
            results[name] = {"status": "skipped", "reason": "time_budget_exhausted"}
            break
        try:
            results[name] = fn()
        except Exception as e:
            results[name] = {"status": "error", "error": str(e)}

    results["elapsed_seconds"] = round(time.time() - start, 1)
    return jsonify(results)
```

- [ ] **Step 2: Commit**

```bash
git add api/cron.py
git commit -m "refactor: simplify api/cron.py to use shared task functions"
```

---

### Task 8: Test locally and deploy

- [ ] **Step 1: Verify all imports work**

```bash
cd metis && export $(grep -v '^#' .env | xargs) && python3 -c "
from backend.cron_tasks import task_scrape, task_daily_news, task_classify, task_digest
from backend.db.queries import log_cron_run, get_cron_logs
print('All imports OK')
"
```

Expected: `All imports OK`

- [ ] **Step 2: Test cron logs write/read**

```bash
cd metis && export $(grep -v '^#' .env | xargs) && python3 -c "
from backend.db import init_db
init_db()
from backend.db.queries import log_cron_run, get_cron_logs
log_cron_run('2026-04-10', 'test', 'success', steps={'tested': True}, duration_seconds=1.5)
logs = get_cron_logs(limit=1)
print(logs[0]['task_name'], logs[0]['status'], logs[0]['steps'])
"
```

Expected: `test success {'tested': True}`

- [ ] **Step 3: Push to deploy**

```bash
git push origin main
```

Vercel auto-deploys on push. After deploy completes, verify:
- `https://www.novametis.top/api/cron-logs` returns empty list or test entry
- `https://www.novametis.top/api/cron/scrape` triggers scrape (if tools already exist, returns skipped)

- [ ] **Step 4: Final commit tag**

```bash
git tag v1.1.0-cron-split
git push origin v1.1.0-cron-split
```
