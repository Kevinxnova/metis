-- Metis Phase 1 Schema
-- SQLite with WAL mode for concurrent read/write safety

PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=ON;

CREATE TABLE IF NOT EXISTS tools (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    url TEXT NOT NULL,
    dedup_key TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    description TEXT,
    source TEXT NOT NULL,
    source_url TEXT,
    metrics TEXT DEFAULT '{}',
    first_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'skipped', 'deferred', 'archived')),
    sources TEXT DEFAULT '[]',
    title_zh TEXT,
    description_zh TEXT,
    content_type TEXT DEFAULT 'other' CHECK(content_type IN ('tool', 'library', 'model', 'api', 'article', 'other')),
    domain TEXT DEFAULT 'general' CHECK(domain IN ('ai', 'web', 'devops', 'data', 'security', 'design', 'general')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS curation_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tool_id INTEGER NOT NULL REFERENCES tools(id),
    action TEXT NOT NULL CHECK(action IN ('approve', 'skip', 'defer', 'archive', 'edit_take', 'unapprove', 'merge')),
    take_text TEXT,
    batch_context TEXT,
    metadata TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS issues (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    issue_number INTEGER NOT NULL UNIQUE,
    title TEXT,
    status TEXT DEFAULT 'draft' CHECK(status IN ('draft', 'sent')),
    tool_ids TEXT DEFAULT '[]',
    sent_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS scrape_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('success', 'error', 'timeout')),
    tools_found INTEGER DEFAULT 0,
    tools_new INTEGER DEFAULT 0,
    tools_deduped INTEGER DEFAULT 0,
    error_message TEXT,
    duration_ms INTEGER,
    ran_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tools_status ON tools(status);
CREATE INDEX IF NOT EXISTS idx_tools_first_seen ON tools(first_seen);
CREATE INDEX IF NOT EXISTS idx_tools_dedup_key ON tools(dedup_key);
CREATE INDEX IF NOT EXISTS idx_curation_log_tool_id ON curation_log(tool_id);
CREATE INDEX IF NOT EXISTS idx_scrape_runs_source ON scrape_runs(source);
CREATE INDEX IF NOT EXISTS idx_scrape_runs_ran_at ON scrape_runs(ran_at);
