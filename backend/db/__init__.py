"""Database layer. Uses Turso HTTP API when deployed, local SQLite for dev."""

import os
import sqlite3
import httpx
import json
from pathlib import Path
from contextlib import contextmanager
from backend.config import DATA_DIR

TURSO_URL = os.getenv("TURSO_DATABASE_URL", "")
TURSO_TOKEN = os.getenv("TURSO_AUTH_TOKEN", "")


def _use_turso() -> bool:
    return bool(TURSO_URL and TURSO_TOKEN)


def _turso_http_url() -> str:
    """Convert libsql:// URL to https:// for HTTP API."""
    url = TURSO_URL
    if url.startswith("libsql://"):
        url = "https://" + url[len("libsql://"):]
    return url


class TursoRow:
    """sqlite3.Row-compatible wrapper for Turso HTTP API results."""
    def __init__(self, columns: list[str], values: list):
        self._data = dict(zip(columns, values))

    def __getitem__(self, key):
        if isinstance(key, int):
            return list(self._data.values())[key]
        return self._data[key]

    def keys(self):
        return self._data.keys()


class TursoConnection:
    """sqlite3-compatible connection that uses Turso HTTP API."""

    def __init__(self):
        self._base = _turso_http_url()
        self._token = TURSO_TOKEN
        self._client = httpx.Client(timeout=30)
        self.row_factory = None

    def execute(self, sql: str, params: tuple | list = ()) -> 'TursoCursor':
        # Convert ? placeholders to Turso's format
        args = []
        for p in params:
            if p is None:
                args.append({"type": "null"})
            elif isinstance(p, int):
                args.append({"type": "integer", "value": str(p)})
            elif isinstance(p, float):
                args.append({"type": "float", "value": str(p)})
            else:
                args.append({"type": "text", "value": str(p)})

        resp = self._client.post(
            f"{self._base}/v2/pipeline",
            headers={"Authorization": f"Bearer {self._token}"},
            json={
                "requests": [
                    {"type": "execute", "stmt": {"sql": sql, "args": args}},
                    {"type": "close"},
                ]
            },
        )
        resp.raise_for_status()
        data = resp.json()

        result = data.get("results", [{}])[0]
        if result.get("type") == "error":
            error_msg = result.get("error", {}).get("message", "Unknown Turso error")
            raise Exception(error_msg)

        response = result.get("response", {}).get("result", {})
        cols = [c["name"] for c in response.get("cols", [])]
        rows_raw = response.get("rows", [])
        affected = response.get("affected_row_count", 0)
        last_id = response.get("last_insert_rowid", None)

        rows = []
        for row_data in rows_raw:
            values = [cell.get("value") for cell in row_data]
            # Convert integer strings back to int
            converted = []
            for i, cell in enumerate(row_data):
                v = cell.get("value")
                if cell.get("type") == "integer" and v is not None:
                    converted.append(int(v))
                elif cell.get("type") == "float" and v is not None:
                    converted.append(float(v))
                else:
                    converted.append(v)
            if self.row_factory == sqlite3.Row:
                rows.append(TursoRow(cols, converted))
            else:
                rows.append(tuple(converted))

        cursor = TursoCursor(rows, affected, last_id)
        return cursor

    def executescript(self, sql: str):
        for stmt in sql.split(";"):
            stmt = stmt.strip()
            if stmt and not stmt.startswith("--") and not stmt.startswith("PRAGMA"):
                try:
                    self.execute(stmt)
                except:
                    pass

    def commit(self):
        pass  # Turso auto-commits

    def rollback(self):
        pass

    def sync(self):
        pass

    def close(self):
        self._client.close()


class TursoCursor:
    def __init__(self, rows, affected, last_id):
        self._rows = rows
        self.rowcount = affected
        self.lastrowid = int(last_id) if last_id else None

    def fetchall(self):
        return self._rows

    def fetchone(self):
        return self._rows[0] if self._rows else None


def init_db():
    """Initialize database with schema and run migrations."""
    if _use_turso():
        conn = TursoConnection()
    else:
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        from backend.config import DB_PATH
        conn = sqlite3.connect(str(DB_PATH))

    schema_path = Path(__file__).parent / "schema.sql"
    for statement in schema_path.read_text().split(";"):
        statement = statement.strip()
        if statement and not statement.startswith("--") and not statement.startswith("PRAGMA"):
            try:
                conn.execute(statement)
            except:
                pass

    # Migrations
    try:
        cols = [row[1] for row in conn.execute("PRAGMA table_info(tools)").fetchall()]
        for col, default in [
            ("title_zh", "TEXT"), ("description_zh", "TEXT"),
            ("content_type", "TEXT DEFAULT 'other'"), ("domain", "TEXT DEFAULT 'general'"),
            ("is_featured", "INTEGER DEFAULT 0"), ("is_metis_pick", "INTEGER DEFAULT 0"),
        ]:
            if col not in cols:
                conn.execute(f"ALTER TABLE tools ADD COLUMN {col} {default}")
    except:
        pass

    conn.commit()
    conn.close()


@contextmanager
def get_db():
    """Get a database connection with row factory."""
    if _use_turso():
        conn = TursoConnection()
    else:
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        from backend.config import DB_PATH
        conn = sqlite3.connect(str(DB_PATH))

    conn.row_factory = sqlite3.Row
    if not _use_turso():
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute("PRAGMA foreign_keys=ON")
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
