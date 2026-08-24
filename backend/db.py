"""Database connection + schema bootstrap for Platio.

Production uses PostgreSQL (set DATABASE_URL). Local/dev falls back to SQLite.
A thin shim (`_PGConn`) lets the existing SQLite-style SQL (`?` placeholders,
`lastrowid`, `row["col"]` / `row[0]` access) run unchanged on PostgreSQL.
"""
import os
import sqlite3

from config import DB_PATH


# ----------------------------- PostgreSQL -----------------------------
class _PGResult:
    def __init__(self, cur, last_id=None):
        self._cur = cur
        self._last_id = last_id

    def fetchone(self):
        return self._cur.fetchone()

    def fetchall(self):
        return self._cur.fetchall()

    def __iter__(self):
        return iter(self._cur)

    @property
    def lastrowid(self):
        return self._last_id


class _PGConn:
    def __init__(self, pg):
        self._pg = pg

    def execute(self, query, params=None):
        from psycopg2.extras import DictCursor
        q = query.replace("?", "%s")
        cur = self._pg.cursor(cursor_factory=DictCursor)
        auto_returning = False
        if q.lstrip().upper().startswith("INSERT") and "RETURNING" not in q.upper():
            q = q + " RETURNING id"
            auto_returning = True
        cur.execute(q, params)
        last_id = None
        if auto_returning:
            row = cur.fetchone()
            last_id = row["id"] if row else None
        return _PGResult(cur, last_id)

    def commit(self):
        self._pg.commit()

    def close(self):
        self._pg.close()


# ----------------------------- Schemas -----------------------------
SQLITE_SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'admin',
    display_name TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    client_name TEXT,
    location TEXT,
    start_date TEXT,
    expected_end_date TEXT,
    budget_paise INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT,
    deleted_by INTEGER
);

CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kind TEXT NOT NULL,
    name TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    UNIQUE (kind, name)
);

CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL REFERENCES projects(id),
    type TEXT NOT NULL,
    amount_paise INTEGER NOT NULL,
    date TEXT NOT NULL,
    category_id INTEGER REFERENCES categories(id),
    subcategory TEXT,
    description TEXT,
    party TEXT,
    payment_method TEXT,
    reference_number TEXT,
    receipt_id INTEGER,
    notes TEXT,
    created_by INTEGER REFERENCES users(id),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT,
    deleted_by INTEGER
);

CREATE TABLE IF NOT EXISTS receipts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    transaction_id INTEGER REFERENCES transactions(id),
    project_id INTEGER NOT NULL REFERENCES projects(id),
    storage_key TEXT NOT NULL,
    original_filename TEXT,
    content_type TEXT,
    size_bytes INTEGER,
    uploaded_by INTEGER REFERENCES users(id),
    created_at TEXT NOT NULL,
    deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    actor_id INTEGER REFERENCES users(id),
    action TEXT NOT NULL,
    entity_type TEXT,
    entity_id INTEGER,
    old_value TEXT,
    new_value TEXT,
    reason TEXT,
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_txn_project ON transactions(project_id);
CREATE INDEX IF NOT EXISTS idx_txn_date ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_txn_type ON transactions(type);
CREATE INDEX IF NOT EXISTS idx_txn_category ON transactions(category_id);
CREATE INDEX IF NOT EXISTS idx_txn_project_date ON transactions(project_id, date);
CREATE INDEX IF NOT EXISTS idx_txn_project_type ON transactions(project_id, type);
CREATE INDEX IF NOT EXISTS idx_proj_deleted ON projects(deleted_at);
CREATE INDEX IF NOT EXISTS idx_txn_deleted ON transactions(deleted_at);
"""

PG_SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'admin',
    display_name TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS projects (
    id SERIAL PRIMARY KEY,
    project_code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    client_name TEXT,
    location TEXT,
    start_date TEXT,
    expected_end_date TEXT,
    budget_paise INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT,
    deleted_by INTEGER
);

CREATE TABLE IF NOT EXISTS categories (
    id SERIAL PRIMARY KEY,
    kind TEXT NOT NULL,
    name TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    UNIQUE (kind, name)
);

CREATE TABLE IF NOT EXISTS transactions (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id),
    type TEXT NOT NULL,
    amount_paise INTEGER NOT NULL,
    date TEXT NOT NULL,
    category_id INTEGER REFERENCES categories(id),
    subcategory TEXT,
    description TEXT,
    party TEXT,
    payment_method TEXT,
    reference_number TEXT,
    receipt_id INTEGER,
    notes TEXT,
    created_by INTEGER REFERENCES users(id),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT,
    deleted_by INTEGER
);

CREATE TABLE IF NOT EXISTS receipts (
    id SERIAL PRIMARY KEY,
    transaction_id INTEGER REFERENCES transactions(id),
    project_id INTEGER NOT NULL REFERENCES projects(id),
    storage_key TEXT NOT NULL,
    original_filename TEXT,
    content_type TEXT,
    size_bytes INTEGER,
    uploaded_by INTEGER REFERENCES users(id),
    created_at TEXT NOT NULL,
    deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    actor_id INTEGER REFERENCES users(id),
    action TEXT NOT NULL,
    entity_type TEXT,
    entity_id INTEGER,
    old_value TEXT,
    new_value TEXT,
    reason TEXT,
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_txn_project ON transactions(project_id);
CREATE INDEX IF NOT EXISTS idx_txn_date ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_txn_type ON transactions(type);
CREATE INDEX IF NOT EXISTS idx_txn_category ON transactions(category_id);
CREATE INDEX IF NOT EXISTS idx_txn_project_date ON transactions(project_id, date);
CREATE INDEX IF NOT EXISTS idx_txn_project_type ON transactions(project_id, type);
CREATE INDEX IF NOT EXISTS idx_proj_deleted ON projects(deleted_at);
CREATE INDEX IF NOT EXISTS idx_txn_deleted ON transactions(deleted_at);
"""


def _split(sql):
    for stmt in sql.split(";"):
        s = stmt.strip()
        if s:
            yield s


def _pg_url():
    url = os.environ.get("DATABASE_URL", "")
    if url and "sslmode" not in url:
        url = url + "?sslmode=require"
    return url


def get_conn():
    url = os.environ.get("DATABASE_URL")
    if url:
        import psycopg2
        return _PGConn(psycopg2.connect(_pg_url()))
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db() -> None:
    conn = get_conn()
    try:
        if os.environ.get("DATABASE_URL"):
            for stmt in _split(PG_SCHEMA):
                conn.execute(stmt)
        else:
            conn.execute(SQLITE_SCHEMA)
            conn.execute("PRAGMA foreign_keys = ON")
        conn.commit()
    finally:
        conn.close()
