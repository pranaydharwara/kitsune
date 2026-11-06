import asyncio
from contextlib import asynccontextmanager

import aiosqlite

from core.config import DB_PATH, KITSUNE_DIR

SCHEMA = """\
CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    path TEXT NOT NULL UNIQUE,
    icon TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL DEFAULT 'New chat',
    project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
    mode TEXT NOT NULL DEFAULT 'auto' CHECK (mode IN ('auto', 'local', 'cloud')),
    escalated INTEGER NOT NULL DEFAULT 0,
    summary TEXT,
    summary_updated_at TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    text TEXT NOT NULL,
    answered_by TEXT,
    latency_ms INTEGER,
    tokens_in INTEGER,
    tokens_out INTEGER,
    cost_usd REAL,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id, created_at);

CREATE TABLE IF NOT EXISTS routing_decisions (
    message_id TEXT PRIMARY KEY REFERENCES messages(id) ON DELETE CASCADE,
    heuristic_flags TEXT,
    classifier_json TEXT,
    chosen TEXT NOT NULL,
    reason TEXT,
    user_override TEXT,
    feedback TEXT CHECK (feedback IN ('up', 'down', NULL))
);

CREATE TABLE IF NOT EXISTS context_snapshots (
    message_id TEXT PRIMARY KEY REFERENCES messages(id) ON DELETE CASCADE,
    prompt_text TEXT NOT NULL,
    token_estimate INTEGER
);

CREATE TABLE IF NOT EXISTS prs (
    repo TEXT NOT NULL,
    number INTEGER NOT NULL,
    title TEXT,
    branch TEXT,
    author TEXT,
    ci_state TEXT,
    review_state TEXT,
    merge_state TEXT,
    body TEXT,
    updated_at TEXT,
    PRIMARY KEY (repo, number)
);

CREATE TABLE IF NOT EXISTS chat_pr_links (
    conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    repo TEXT NOT NULL,
    pr_number INTEGER NOT NULL,
    linked_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    synced INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (conversation_id, repo, pr_number)
);

"""


class DBPool:
    def __init__(self, size: int = 4):
        self._connections: list[aiosqlite.Connection] = []
        self._available: asyncio.Queue[aiosqlite.Connection] = asyncio.Queue()
        self._size = size

    async def init(self):
        KITSUNE_DIR.mkdir(parents=True, exist_ok=True)
        for _ in range(self._size):
            db = await aiosqlite.connect(str(DB_PATH))
            db.row_factory = aiosqlite.Row
            await db.execute("PRAGMA journal_mode=WAL")
            await db.execute("PRAGMA foreign_keys=ON")
            self._connections.append(db)
            await self._available.put(db)
        await self._migrate(self._connections[0])
        await self._connections[0].executescript(SCHEMA)
        await self._connections[0].executescript(
            "DROP TABLE IF EXISTS prs_fts; DROP TABLE IF EXISTS conversations_fts;"
        )

    @staticmethod
    async def _migrate(db: aiosqlite.Connection):
        tables = [r[0] for r in await db.execute_fetchall("SELECT name FROM sqlite_master WHERE type='table'")]
        if "conversations" not in tables:
            return
        # Ensure projects table exists before adding FK
        if "projects" not in tables:
            await db.execute(
                """CREATE TABLE IF NOT EXISTS projects (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    path TEXT NOT NULL UNIQUE,
                    icon TEXT,
                    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
                )"""
            )
        cols = [r[1] for r in await db.execute_fetchall("PRAGMA table_info(conversations)")]
        if "project_id" not in cols:
            await db.execute("ALTER TABLE conversations ADD COLUMN project_id TEXT REFERENCES projects(id) ON DELETE SET NULL")
            await db.execute("CREATE INDEX IF NOT EXISTS idx_conversations_project ON conversations(project_id)")
            await db.commit()

    @asynccontextmanager
    async def acquire(self):
        db = await self._available.get()
        try:
            yield db
        finally:
            await self._available.put(db)

    async def close(self):
        for db in self._connections:
            await db.close()


async def get_db() -> aiosqlite.Connection:
    KITSUNE_DIR.mkdir(parents=True, exist_ok=True)
    db = await aiosqlite.connect(str(DB_PATH))
    db.row_factory = aiosqlite.Row
    await db.execute("PRAGMA journal_mode=WAL")
    await db.execute("PRAGMA foreign_keys=ON")
    await db.executescript(SCHEMA)
    return db
