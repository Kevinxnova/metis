# Weekly Discoveries v0.1.0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the raw "show all ~700 weekly tools" display with AI-scored Top 20 per category (news/ai_tool/other = 60 total), each with a trending_score and AI-generated structured intro.

**Architecture:** Add three columns to the `tools` table (`trending_score`, `ai_intro`, `ai_intro_zh`). Extend the existing classify pipeline with two new steps that process only newly-ingested tools. Rewrite the `/api/discover/week` endpoint to return top 20 per category ordered by `trending_score`. Update the frontend `DiscoveryModule` to use unified styling, 10/20 expand toggle, and show `ai_intro` in tool detail.

**Tech Stack:** Python/Flask backend, SQLite/Turso DB, MiniMax M2.7-highspeed via OpenAI SDK, React 18 + TypeScript + Vite frontend.

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `backend/db/__init__.py` | Add 3 new column migrations |
| Modify | `backend/db/queries.py` | Add `get_unscored_tool_ids()`, `get_tools_without_intro()`, rewrite `get_week_tools()` |
| Modify | `backend/ai_recommend.py` | Add `score_tools()` and `generate_intros()` functions |
| Modify | `backend/cron_tasks.py` | Add Step 5 (scoring) and Step 6 (intro generation) to `task_classify` |
| Modify | `backend/api/main.py` | No route change needed — `get_week_tools()` already wired |
| Modify | `frontend/src/api/client.ts` | Add `trending_score`, `ai_intro`, `ai_intro_zh` to `Tool` interface |
| Modify | `frontend/src/pages/Discover.tsx` | Unify `DiscoveryModule` styling, 10→20 expand, update subtitle |
| Modify | `frontend/src/components/discover/ToolDetail.tsx` | Show `ai_intro` section in detail view |

---

### Task 1: Database Schema Migration

**Files:**
- Modify: `backend/db/__init__.py:164-178`

- [ ] **Step 1: Add three new columns to the migration list**

In `backend/db/__init__.py`, inside the `init_db()` function, add three new entries to the column migration list after the existing `("short_summary_zh", "TEXT")` entry:

```python
        for col, default in [
            ("title_zh", "TEXT"), ("description_zh", "TEXT"),
            ("content_type", "TEXT DEFAULT 'other'"), ("domain", "TEXT DEFAULT 'general'"),
            ("is_featured", "INTEGER DEFAULT 0"), ("is_metis_pick", "INTEGER DEFAULT 0"),
            ("take_en", "TEXT"),
            ("discovery_category", "TEXT DEFAULT 'other'"),
            ("short_summary", "TEXT"),
            ("short_summary_zh", "TEXT"),
            ("trending_score", "REAL"),
            ("ai_intro", "TEXT"),
            ("ai_intro_zh", "TEXT"),
        ]:
```

- [ ] **Step 2: Verify migration works locally**

Run:
```bash
cd metis && python -c "from backend.db import init_db; init_db(); print('OK')"
```
Expected: `OK` with no errors.

- [ ] **Step 3: Verify columns exist**

Run:
```bash
cd metis && python -c "
from backend.db import get_db, init_db
init_db()
with get_db() as db:
    cols = [r[1] for r in db.execute('PRAGMA table_info(tools)').fetchall()]
    for c in ['trending_score', 'ai_intro', 'ai_intro_zh']:
        assert c in cols, f'{c} missing'
    print('All 3 columns present')
"
```
Expected: `All 3 columns present`

- [ ] **Step 4: Commit**

```bash
git add backend/db/__init__.py
git commit -m "feat: add trending_score, ai_intro, ai_intro_zh columns to tools table"
```

---

### Task 2: Database Query Functions

**Files:**
- Modify: `backend/db/queries.py`

- [ ] **Step 1: Add `get_unscored_tool_ids()` function**

Add after `get_unsummarized_tool_ids()` (line 343):

```python
def get_unscored_tool_ids(limit: int = 200) -> list[int]:
    """Get IDs of tools that don't have a trending_score yet."""
    with get_db() as db:
        rows = db.execute(
            """SELECT id FROM tools
               WHERE trending_score IS NULL
               ORDER BY first_seen DESC LIMIT ?""",
            (limit,)
        ).fetchall()
        return [row[0] for row in rows]


def get_tools_without_intro(limit: int = 200) -> list[int]:
    """Get IDs of tools that don't have an ai_intro yet."""
    with get_db() as db:
        rows = db.execute(
            """SELECT id FROM tools
               WHERE ai_intro IS NULL
               ORDER BY first_seen DESC LIMIT ?""",
            (limit,)
        ).fetchall()
        return [row[0] for row in rows]
```

- [ ] **Step 2: Rewrite `get_week_tools()` to return top 20 per category by trending_score**

Replace the existing `get_week_tools()` function (lines 166-182) with:

```python
def get_week_tools() -> list[dict]:
    """Get this week's top tools: 20 per discovery_category, sorted by trending_score.
    Falls back to metrics-based sort_score for tools without trending_score."""
    with get_db() as db:
        rows = db.execute(
            """WITH ranked AS (
                SELECT *,
                    COALESCE(trending_score,
                        COALESCE(
                            json_extract(metrics, '$.stars'),
                            json_extract(metrics, '$.points'),
                            json_extract(metrics, '$.votes'),
                            0
                        )
                    ) as effective_score,
                    ROW_NUMBER() OVER (
                        PARTITION BY discovery_category
                        ORDER BY COALESCE(trending_score,
                            COALESCE(
                                json_extract(metrics, '$.stars'),
                                json_extract(metrics, '$.points'),
                                json_extract(metrics, '$.votes'),
                                0
                            )
                        ) DESC
                    ) as rn
                FROM tools
                WHERE first_seen >= date('now', '-7 days')
            )
            SELECT * FROM ranked WHERE rn <= 20
            ORDER BY discovery_category, effective_score DESC"""
        ).fetchall()
        return [dict(row) for row in rows]
```

- [ ] **Step 3: Verify query functions work locally**

Run:
```bash
cd metis && python -c "
from backend.db import init_db
init_db()
from backend.db.queries import get_unscored_tool_ids, get_tools_without_intro, get_week_tools
print('unscored:', len(get_unscored_tool_ids(limit=5)))
print('no_intro:', len(get_tools_without_intro(limit=5)))
week = get_week_tools()
cats = {}
for t in week:
    c = t.get('discovery_category', 'other')
    cats[c] = cats.get(c, 0) + 1
print('week tools by category:', cats)
"
```
Expected: Counts printed without errors. Each category should have at most 20.

- [ ] **Step 4: Commit**

```bash
git add backend/db/queries.py
git commit -m "feat: add query functions for trending_score, ai_intro, and top-20-per-category week view"
```

---

### Task 3: Scoring Function (`score_tools`)

**Files:**
- Modify: `backend/ai_recommend.py`

- [ ] **Step 1: Add `_compute_metrics_score` helper**

Add after `_extract_json()` (line 69):

```python
def _compute_metrics_score(tool: dict) -> float:
    """Compute a normalized metrics score (0-40 points) from stars/points/votes/comments."""
    metrics = json.loads(tool.get("metrics", "{}"))
    stars = metrics.get("stars") or 0
    points = metrics.get("points") or 0
    votes = metrics.get("votes") or 0
    comments = metrics.get("comments") or 0

    # Normalize each metric to 0-10 range using log scale
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
        # Linear decay: 20 points at day 0, 0 at day 7+
        return round(max(0, 20 * (1 - days_old / 7)), 2)
    except Exception:
        return 10.0  # default for unparseable dates


def _compute_multi_source_bonus(tool: dict) -> float:
    """Bonus for tools discovered from multiple sources (0-10 points)."""
    sources = json.loads(tool.get("sources", "[]"))
    # 0 sources = 0, 1 source = 0, 2 sources = 5, 3+ sources = 10
    return min(10, max(0, (len(sources) - 1) * 5))
```

- [ ] **Step 2: Add `_ai_value_score_batch` function**

Add after the helpers above:

```python
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
```

- [ ] **Step 3: Add `score_tools()` function**

Add after `_ai_value_score_batch`:

```python
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

    # Compute deterministic score components
    scores: dict[int, float] = {}
    for tool in tools:
        tid = tool["id"]
        scores[tid] = (
            _compute_metrics_score(tool) +
            _compute_freshness_score(tool) +
            _compute_multi_source_bonus(tool)
        )

    # Compute AI value scores in batches
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
                # Fallback: add default 15 for this batch
                for tool in batch:
                    scores[tool["id"]] += 15
    else:
        # No API key, add default AI value
        for tid in scores:
            scores[tid] += 15

    # Save scores
    scored = 0
    with get_db() as db:
        for tid, total in scores.items():
            db.execute("UPDATE tools SET trending_score = ? WHERE id = ?", (round(total, 2), tid))
            scored += 1

    logger.info(f"Scored {scored} tools")
    return scored, errors
```

- [ ] **Step 4: Verify scoring works locally**

Run:
```bash
cd metis && python -c "
from backend.db import init_db
init_db()
from backend.db.queries import get_unscored_tool_ids
from backend.ai_recommend import _compute_metrics_score, _compute_freshness_score, _compute_multi_source_bonus
from backend.db import get_db

ids = get_unscored_tool_ids(limit=3)
if ids:
    with get_db() as db:
        for tid in ids:
            row = db.execute('SELECT id, title, metrics, sources, first_seen FROM tools WHERE id = ?', (tid,)).fetchone()
            tool = dict(row)
            m = _compute_metrics_score(tool)
            f = _compute_freshness_score(tool)
            s = _compute_multi_source_bonus(tool)
            print(f'Tool {tid}: metrics={m}, freshness={f}, multi_source={s}, total_no_ai={m+f+s}')
else:
    print('No unscored tools found')
"
```
Expected: Scores printed for up to 3 tools, all values within expected ranges.

- [ ] **Step 5: Commit**

```bash
git add backend/ai_recommend.py
git commit -m "feat: add score_tools() with composite trending_score calculation"
```

---

### Task 4: AI Intro Generation Function (`generate_intros`)

**Files:**
- Modify: `backend/ai_recommend.py`

- [ ] **Step 1: Add `_generate_intro_batch` helper**

Add after `score_tools()`:

```python
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
```

- [ ] **Step 2: Add `generate_intros()` function**

Add after `_generate_intro_batch`:

```python
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
```

- [ ] **Step 3: Commit**

```bash
git add backend/ai_recommend.py
git commit -m "feat: add generate_intros() for AI-generated structured tool introductions"
```

---

### Task 5: Pipeline Integration (Steps 5 & 6 in classify)

**Files:**
- Modify: `backend/cron_tasks.py:9-13` (imports)
- Modify: `backend/cron_tasks.py:115-208` (`task_classify` function)

- [ ] **Step 1: Update imports in cron_tasks.py**

Replace the import block (lines 9-13):

```python
from backend.db.queries import (
    log_cron_run, get_daily_news, get_unclassified_tools,
    save_classification, get_untranslated_tools, save_translation,
    get_daily_digest, get_uncategorized_tool_ids, get_unsummarized_tool_ids,
    get_unscored_tool_ids, get_tools_without_intro,
)
```

- [ ] **Step 2: Add Step 5 (trending_score) and Step 6 (ai_intro) to `task_classify`**

In the `task_classify()` function, add the following code after the Step 4 (Chinese translations) `while` loop and before the `elapsed = time.time() - start` line (before line 194):

```python
        # Step 5: trending_score (only for tools without a score)
        from backend.ai_recommend import score_tools, generate_intros

        steps["scored"] = 0
        while time.time() - start < TIME_LIMIT:
            tool_ids = get_unscored_tool_ids(limit=BATCH_SIZE)
            if not tool_ids:
                break
            n, errs = score_tools(tool_ids)
            steps["scored"] += n
            if errs:
                steps.setdefault("score_errors", []).extend(errs)
            if n == 0:
                break

        # Step 6: ai_intro (only for tools without an intro)
        steps["intros_generated"] = 0
        while time.time() - start < TIME_LIMIT:
            tool_ids = get_tools_without_intro(limit=BATCH_SIZE)
            if not tool_ids:
                break
            n, errs = generate_intros(tool_ids)
            steps["intros_generated"] += n
            if errs:
                steps.setdefault("intro_errors", []).extend(errs)
            if n == 0:
                break
```

- [ ] **Step 3: Update remaining-check lines**

After the new steps, update the remaining checks section (around line 194-198) to add:

```python
        steps["remaining_score"] = len(get_unscored_tool_ids(limit=1)) > 0
        steps["remaining_intro"] = len(get_tools_without_intro(limit=1)) > 0
```

- [ ] **Step 4: Verify the full classify function structure**

Run:
```bash
cd metis && python -c "
import inspect
from backend.cron_tasks import task_classify
src = inspect.getsource(task_classify)
# Check all 6 steps are present
for keyword in ['categorize_tools', 'summarize_tools', 'classify_tool', 'translate_tool', 'score_tools', 'generate_intros']:
    assert keyword in src, f'Missing: {keyword}'
print('All 6 steps present in task_classify')
"
```
Expected: `All 6 steps present in task_classify`

- [ ] **Step 5: Commit**

```bash
git add backend/cron_tasks.py
git commit -m "feat: add trending_score and ai_intro generation steps to classify pipeline"
```

---

### Task 6: Frontend — Tool Type & API Client Update

**Files:**
- Modify: `frontend/src/api/client.ts:15-35` (Tool interface)

- [ ] **Step 1: Add new fields to Tool interface**

In `frontend/src/api/client.ts`, add three fields to the `Tool` interface after `short_summary_zh`:

```typescript
export interface Tool {
  id: number
  url: string
  title: string
  description: string
  title_zh: string | null
  description_zh: string | null
  content_type: string
  domain: string
  source: string
  source_url: string
  metrics: string
  first_seen: string
  status: string
  sources: string
  take?: string
  take_en?: string
  discovery_category?: 'news' | 'ai_tool' | 'other' | null
  short_summary?: string | null
  short_summary_zh?: string | null
  trending_score?: number | null
  ai_intro?: string | null
  ai_intro_zh?: string | null
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/api/client.ts
git commit -m "feat: add trending_score, ai_intro fields to Tool interface"
```

---

### Task 7: Frontend — Unified DiscoveryModule Styling & 10/20 Toggle

**Files:**
- Modify: `frontend/src/pages/Discover.tsx:169-222` (week section) and `frontend/src/pages/Discover.tsx:237-314` (DiscoveryModule component)

- [ ] **Step 1: Unify the three module definitions to use the same styling**

Replace the `modules` array (lines 183-187) with unified styling:

```typescript
              const modules = [
                { key: 'news',    icon: '📰', labelZh: 'AI 动态',  labelEn: 'AI News',  tools: newsTools },
                { key: 'ai_tool', icon: '🔧', labelZh: 'AI 工具',  labelEn: 'AI Tools', tools: aiTools },
                { key: 'other',   icon: '🌐', labelZh: '其他',     labelEn: 'Others',   tools: otherTools },
              ]
```

And update the `DiscoveryModule` calls (lines 206-218) to remove per-module color/border/bg props:

```typescript
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {modules.map(mod => (
                      <DiscoveryModule
                        key={mod.key}
                        icon={mod.icon}
                        label={isZh ? mod.labelZh : mod.labelEn}
                        tools={mod.tools}
                        isZh={isZh}
                        onSelect={setSelectedTool}
                      />
                    ))}
                  </div>
```

- [ ] **Step 2: Rewrite DiscoveryModule component with unified style and 10/20 toggle**

Replace the entire `DiscoveryModule` function (lines 237-314) with:

```typescript
function DiscoveryModule({ icon, label, tools, isZh, onSelect }: {
  icon: string; label: string
  tools: Tool[]; isZh: boolean; onSelect: (t: Tool) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const DEFAULT_SHOW = 10
  const MAX_SHOW = 20
  const shown = expanded ? tools.slice(0, MAX_SHOW) : tools.slice(0, DEFAULT_SHOW)

  const borderColor = 'rgba(96,165,250,0.2)'
  const bgColor = 'rgba(96,165,250,0.05)'
  const accentColor = 'var(--accent-blue)'

  return (
    <div style={{ background: bgColor, border: `1px solid ${borderColor}`, borderRadius: 10, overflow: 'hidden' }}>
      {/* Header row */}
      <div
        onClick={() => tools.length > 0 && setExpanded(e => !e)}
        style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px',
          cursor: tools.length > 0 ? 'pointer' : 'default', userSelect: 'none',
        }}
      >
        <span style={{ fontSize: 14 }}>{icon}</span>
        <span style={{ fontSize: 14, fontWeight: 600, color: accentColor, flex: 1 }}>{label}</span>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{tools.length}</span>
        {tools.length > 0 && (
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{expanded ? '↑' : '↓'}</span>
        )}
      </div>

      {/* Items */}
      {tools.length === 0 ? (
        <p style={{ color: 'var(--text-dim)', fontSize: 12, margin: 0, padding: '0 16px 12px' }}>
          {isZh ? '暂无内容' : 'Nothing yet'}
        </p>
      ) : (
        <div style={{ padding: '0 16px 12px' }}>
          {shown.map((tool, i) => {
            const summary = isZh
              ? (tool.short_summary_zh || tool.short_summary || '')
              : (tool.short_summary || '')
            const descPart = summary.includes('—')
              ? summary.split('—').slice(1).join('—').trim()
              : summary
            return (
              <div
                key={tool.id}
                onClick={() => onSelect(tool)}
                style={{
                  display: 'flex', alignItems: 'baseline', gap: 6,
                  padding: '6px 0', borderTop: i === 0 ? `1px solid ${borderColor}` : '1px solid var(--border-subtle)',
                  cursor: 'pointer',
                }}
              >
                <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0, width: 16 }}>{i + 1}</span>
                <span style={{ fontSize: 13, color: 'var(--text-heading)', fontWeight: 500, flexShrink: 0 }}>
                  {isZh ? (tool.title_zh || tool.title) : tool.title}
                </span>
                {descPart && (
                  <>
                    <span style={{ color: 'var(--text-dim)', flexShrink: 0 }}>—</span>
                    <span style={{ fontSize: 12, color: 'var(--text-body)', lineHeight: 1.4 }}>{descPart}</span>
                  </>
                )}
              </div>
            )
          })}
          {tools.length > DEFAULT_SHOW && (
            <button
              onClick={e => { e.stopPropagation(); setExpanded(v => !v) }}
              style={{ marginTop: 8, fontSize: 12, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            >
              {expanded
                ? (isZh ? '收起 ↑' : 'Collapse ↑')
                : (isZh ? `查看全部 ${Math.min(tools.length, MAX_SHOW)} 条 ↓` : `Show all ${Math.min(tools.length, MAX_SHOW)} ↓`)}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/Discover.tsx
git commit -m "feat: unify DiscoveryModule styling and add 10/20 expand toggle"
```

---

### Task 8: Frontend — Show AI Intro in Tool Detail

**Files:**
- Modify: `frontend/src/components/discover/ToolDetail.tsx:159-167` (Description section)

- [ ] **Step 1: Add AI intro section above the existing Description**

Replace the Description section (lines 159-167) with code that shows `ai_intro` when available, falling back to `description`:

```typescript
        {/* AI Intro (structured, if available) */}
        {(tool as any).ai_intro && (
          <div style={{ marginBottom: 24 }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-body)', marginBottom: 12 }}>
              {isZh ? 'AI 简介' : 'AI Introduction'}
            </h2>
            <div style={{ fontSize: 15, color: 'var(--text-secondary)', lineHeight: 1.8 }}>
              {((isZh && (tool as any).ai_intro_zh) ? (tool as any).ai_intro_zh : (tool as any).ai_intro)
                .split('\n\n')
                .map((para: string, i: number) => (
                  <p key={i} style={{ margin: i === 0 ? 0 : '12px 0 0' }}>{para}</p>
                ))}
            </div>
          </div>
        )}

        {/* Description (original) */}
        <div style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-body)', marginBottom: 12 }}>
            {isZh ? '简介' : 'Description'}
          </h2>
          <p style={{ fontSize: 15, color: 'var(--text-secondary)', lineHeight: 1.8, margin: 0 }}>
            {desc || (isZh ? '暂无详细描述。' : 'No description available.')}
          </p>
        </div>
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/discover/ToolDetail.tsx
git commit -m "feat: show AI intro in tool detail view"
```

---

### Task 9: End-to-End Verification

- [ ] **Step 1: Run the full backend locally to verify no import errors**

Run:
```bash
cd metis && python -c "
from backend.db import init_db
init_db()
from backend.cron_tasks import task_classify, task_scrape, task_digest
from backend.db.queries import get_week_tools, get_unscored_tool_ids, get_tools_without_intro
from backend.ai_recommend import score_tools, generate_intros
print('All imports OK')
week = get_week_tools()
print(f'Week tools: {len(week)}')
print(f'Unscored: {len(get_unscored_tool_ids(limit=5))}')
print(f'No intro: {len(get_tools_without_intro(limit=5))}')
"
```
Expected: No import errors, counts printed.

- [ ] **Step 2: Verify frontend builds**

Run:
```bash
cd metis/frontend && npm run build
```
Expected: Build succeeds with no TypeScript errors.

- [ ] **Step 3: Start dev server and verify Discover page loads**

Run:
```bash
cd metis/frontend && npm run dev &
```
Open browser to `http://localhost:5173/discover`. Verify:
- Three category modules (AI News, AI Tools, Others) all have the same blue-tinted styling
- Each shows up to 10 items by default
- "Show all 20" button appears if category has >10 items
- Clicking a tool shows the detail view

- [ ] **Step 4: Final commit (if any fixups needed)**

```bash
git add -A
git commit -m "fix: address any issues found during e2e verification"
```

- [ ] **Step 5: Push all changes**

```bash
git push origin main
```
