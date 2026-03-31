import os
import sqlite3
from pathlib import Path
from contextlib import contextmanager
from backend.config import DATA_DIR

TURSO_URL = os.getenv("TURSO_DATABASE_URL", "")
TURSO_TOKEN = os.getenv("TURSO_AUTH_TOKEN", "")


def _use_turso() -> bool:
    return bool(TURSO_URL and TURSO_TOKEN)


def _get_connection():
    if _use_turso():
        import libsql_experimental as libsql
        return libsql.connect("metis.db", sync_url=TURSO_URL, auth_token=TURSO_TOKEN)
    else:
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        from backend.config import DB_PATH
        return sqlite3.connect(str(DB_PATH))


def init_db():
    """Initialize database with schema and run migrations."""
    conn = _get_connection()
    schema_path = Path(__file__).parent / "schema.sql"

    # Execute schema line by line (libsql doesn't support executescript)
    for statement in schema_path.read_text().split(";"):
        statement = statement.strip()
        if statement and not statement.startswith("--") and not statement.startswith("PRAGMA"):
            try:
                conn.execute(statement)
            except Exception:
                pass  # table/index already exists

    conn.commit()

    # Migrations
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

    if _use_turso():
        conn.sync()

    conn.close()


@contextmanager
def get_db():
    """Get a database connection with row factory."""
    conn = _get_connection()
    conn.row_factory = sqlite3.Row
    if not _use_turso():
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute("PRAGMA foreign_keys=ON")
    try:
        yield conn
        conn.commit()
        if _use_turso():
            conn.sync()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
