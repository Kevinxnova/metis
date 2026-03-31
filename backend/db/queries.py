import json
from datetime import datetime
from backend.db import get_db


# --- Tools ---

def insert_tool(url: str, dedup_key: str, title: str, description: str,
                source: str, source_url: str, metrics: dict) -> int | None:
    """Insert a tool. Returns tool ID or None if dedup_key exists."""
    with get_db() as db:
        try:
            cursor = db.execute(
                """INSERT INTO tools (url, dedup_key, title, description, source, source_url, metrics, sources)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                (url, dedup_key, title, description or "", source, source_url,
                 json.dumps(metrics), json.dumps([source]))
            )
            return cursor.lastrowid
        except Exception:
            # dedup_key already exists, merge sources
            existing = db.execute("SELECT id, sources FROM tools WHERE dedup_key = ?", (dedup_key,)).fetchone()
            if existing:
                sources = json.loads(existing["sources"])
                if source not in sources:
                    sources.append(source)
                    db.execute("UPDATE tools SET sources = ? WHERE id = ?",
                               (json.dumps(sources), existing["id"]))
                return None
            raise


def get_tools(status: str | None = None, limit: int = 100, offset: int = 0) -> list[dict]:
    """Get tools, optionally filtered by status."""
    with get_db() as db:
        if status:
            rows = db.execute(
                "SELECT * FROM tools WHERE status = ? ORDER BY first_seen DESC LIMIT ? OFFSET ?",
                (status, limit, offset)
            ).fetchall()
        else:
            rows = db.execute(
                "SELECT * FROM tools ORDER BY first_seen DESC LIMIT ? OFFSET ?",
                (limit, offset)
            ).fetchall()
        return [dict(row) for row in rows]


def get_tool(tool_id: int) -> dict | None:
    """Get a single tool by ID."""
    with get_db() as db:
        row = db.execute("SELECT * FROM tools WHERE id = ?", (tool_id,)).fetchone()
        return dict(row) if row else None


def update_tool_status(tool_id: int, status: str) -> bool:
    """Update tool status. Returns True if tool exists."""
    with get_db() as db:
        cursor = db.execute("UPDATE tools SET status = ? WHERE id = ?", (status, tool_id))
        return cursor.rowcount > 0


def merge_tools(keep_id: int, merge_id: int) -> bool:
    """Merge two tools. Keeps keep_id, archives merge_id."""
    with get_db() as db:
        keep = db.execute("SELECT * FROM tools WHERE id = ?", (keep_id,)).fetchone()
        merge = db.execute("SELECT * FROM tools WHERE id = ?", (merge_id,)).fetchone()
        if not keep or not merge:
            return False

        keep_sources = json.loads(keep["sources"])
        merge_sources = json.loads(merge["sources"])
        combined = list(set(keep_sources + merge_sources))

        keep_metrics = json.loads(keep["metrics"])
        merge_metrics = json.loads(merge["metrics"])
        keep_metrics.update(merge_metrics)

        db.execute("UPDATE tools SET sources = ?, metrics = ? WHERE id = ?",
                    (json.dumps(combined), json.dumps(keep_metrics), keep_id))
        db.execute("UPDATE tools SET status = 'archived' WHERE id = ?", (merge_id,))
        return True


def tool_exists(dedup_key: str) -> bool:
    """Check if a tool with this dedup_key exists."""
    with get_db() as db:
        row = db.execute("SELECT 1 FROM tools WHERE dedup_key = ?", (dedup_key,)).fetchone()
        return row is not None


# --- Curation Log ---

def log_curation(tool_id: int, action: str, take_text: str | None = None,
                 batch_context: list | None = None, metadata: dict | None = None):
    """Log a curation decision for training data."""
    with get_db() as db:
        tool = db.execute("SELECT * FROM tools WHERE id = ?", (tool_id,)).fetchone()
        tool_metadata = dict(tool) if tool else {}
        if metadata:
            tool_metadata.update(metadata)

        db.execute(
            """INSERT INTO curation_log (tool_id, action, take_text, batch_context, metadata)
               VALUES (?, ?, ?, ?, ?)""",
            (tool_id, action, take_text,
             json.dumps(batch_context or []),
             json.dumps(tool_metadata))
        )


# --- Issues ---

def create_issue(title: str | None = None) -> int:
    """Create a new draft issue. Returns issue number."""
    with get_db() as db:
        last = db.execute("SELECT MAX(issue_number) as n FROM issues").fetchone()
        next_num = (last["n"] or 0) + 1

        approved = db.execute("SELECT id FROM tools WHERE status = 'approved'").fetchall()
        tool_ids = [row["id"] for row in approved]

        db.execute(
            "INSERT INTO issues (issue_number, title, tool_ids) VALUES (?, ?, ?)",
            (next_num, title or f"Metis Weekly #{next_num}", json.dumps(tool_ids))
        )
        return next_num


def get_issues() -> list[dict]:
    """Get all issues."""
    with get_db() as db:
        rows = db.execute("SELECT * FROM issues ORDER BY issue_number DESC").fetchall()
        return [dict(row) for row in rows]


def get_issue(issue_number: int) -> dict | None:
    """Get an issue with full tool data."""
    with get_db() as db:
        issue = db.execute("SELECT * FROM issues WHERE issue_number = ?", (issue_number,)).fetchone()
        if not issue:
            return None
        issue = dict(issue)
        tool_ids = json.loads(issue["tool_ids"])
        if tool_ids:
            placeholders = ",".join("?" * len(tool_ids))
            tools = db.execute(f"SELECT * FROM tools WHERE id IN ({placeholders})", tool_ids).fetchall()
            issue["tools"] = [dict(t) for t in tools]

            for tool in issue["tools"]:
                take = db.execute(
                    "SELECT take_text FROM curation_log WHERE tool_id = ? AND take_text IS NOT NULL ORDER BY created_at DESC LIMIT 1",
                    (tool["id"],)
                ).fetchone()
                tool["take"] = take["take_text"] if take else None
        else:
            issue["tools"] = []
        return issue


def mark_issue_sent(issue_number: int) -> bool:
    """Mark an issue as sent."""
    with get_db() as db:
        cursor = db.execute(
            "UPDATE issues SET status = 'sent', sent_at = ? WHERE issue_number = ? AND status = 'draft'",
            (datetime.utcnow().isoformat(), issue_number)
        )
        return cursor.rowcount > 0


# --- Scrape Runs ---

def log_scrape_run(source: str, status: str, tools_found: int = 0,
                   tools_new: int = 0, tools_deduped: int = 0,
                   error_message: str | None = None, duration_ms: int = 0):
    """Log a scrape run for health monitoring."""
    with get_db() as db:
        db.execute(
            """INSERT INTO scrape_runs (source, status, tools_found, tools_new, tools_deduped, error_message, duration_ms)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (source, status, tools_found, tools_new, tools_deduped, error_message, duration_ms)
        )


def get_latest_scrape_runs() -> list[dict]:
    """Get the most recent scrape run per source."""
    with get_db() as db:
        rows = db.execute("""
            SELECT * FROM scrape_runs
            WHERE id IN (SELECT MAX(id) FROM scrape_runs GROUP BY source)
            ORDER BY ran_at DESC
        """).fetchall()
        return [dict(row) for row in rows]
