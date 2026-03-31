import sqlite3
import json
from pathlib import Path
from contextlib import contextmanager
from backend.config import DB_PATH, DATA_DIR


def init_db():
    """Initialize database with schema and run migrations."""
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH))
    schema_path = Path(__file__).parent / "schema.sql"
    conn.executescript(schema_path.read_text())
    # Migration: add translation columns if missing
    cols = [row[1] for row in conn.execute("PRAGMA table_info(tools)").fetchall()]
    if "title_zh" not in cols:
        conn.execute("ALTER TABLE tools ADD COLUMN title_zh TEXT")
    if "description_zh" not in cols:
        conn.execute("ALTER TABLE tools ADD COLUMN description_zh TEXT")
    if "content_type" not in cols:
        conn.execute("ALTER TABLE tools ADD COLUMN content_type TEXT DEFAULT 'other'")
    if "domain" not in cols:
        conn.execute("ALTER TABLE tools ADD COLUMN domain TEXT DEFAULT 'general'")
    if "is_featured" not in cols:
        conn.execute("ALTER TABLE tools ADD COLUMN is_featured INTEGER DEFAULT 0")
    if "is_metis_pick" not in cols:
        conn.execute("ALTER TABLE tools ADD COLUMN is_metis_pick INTEGER DEFAULT 0")
    conn.commit()
    conn.close()


@contextmanager
def get_db():
    """Get a database connection with WAL mode and row factory."""
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
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
