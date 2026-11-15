import pytest
import aiosqlite
from unittest.mock import patch
from core.store.db import SCHEMA, DBPool, get_db


@pytest.mark.asyncio
async def test_schema_creates_tables(tmp_path):
    db_path = tmp_path / "test.db"
    conn = await aiosqlite.connect(str(db_path))
    conn.row_factory = aiosqlite.Row
    await conn.executescript(SCHEMA)
    rows = await conn.execute_fetchall(
        "SELECT name FROM sqlite_master WHERE type='table'"
    )
    tables = [r["name"] for r in rows]
    assert "conversations" in tables
    assert "messages" in tables
    assert "projects" in tables
    assert "context_snapshots" in tables
    assert "routing_decisions" in tables
    await conn.close()


@pytest.mark.asyncio
async def test_schema_idempotent(tmp_path):
    db_path = tmp_path / "test.db"
    conn = await aiosqlite.connect(str(db_path))
    await conn.executescript(SCHEMA)
    await conn.executescript(SCHEMA)
    await conn.close()


@pytest.mark.asyncio
async def test_foreign_keys(db):
    await db.execute("PRAGMA foreign_keys=ON")
    row = await db.execute_fetchall("PRAGMA foreign_keys")
    assert row[0][0] == 1


@pytest.mark.asyncio
async def test_dbpool_init_acquire_close(tmp_path):
    db_path = tmp_path / "pool_test.db"
    with patch("core.store.db.DB_PATH", db_path), \
         patch("core.store.db.KITSUNE_DIR", tmp_path):
        pool = DBPool(size=2)
        await pool.init()
        assert len(pool._connections) == 2
        async with pool.acquire() as conn:
            rows = await conn.execute_fetchall(
                "SELECT name FROM sqlite_master WHERE type='table'"
            )
            tables = [r[0] for r in rows]
            assert "conversations" in tables
        await pool.close()


@pytest.mark.asyncio
async def test_dbpool_migrate_adds_columns(tmp_path):
    db_path = tmp_path / "migrate.db"
    conn = await aiosqlite.connect(str(db_path))
    conn.row_factory = aiosqlite.Row
    await conn.execute(
        """CREATE TABLE conversations (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL DEFAULT 'New chat',
            mode TEXT NOT NULL DEFAULT 'auto',
            escalated INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
        )"""
    )
    await conn.commit()
    await DBPool._migrate(conn)
    cols = [r[1] for r in await conn.execute_fetchall("PRAGMA table_info(conversations)")]
    assert "project_id" in cols
    assert "starred" in cols
    assert "model_id" in cols
    await conn.close()


@pytest.mark.asyncio
async def test_dbpool_migrate_no_conversations(tmp_path):
    db_path = tmp_path / "empty.db"
    conn = await aiosqlite.connect(str(db_path))
    await DBPool._migrate(conn)
    await conn.close()


@pytest.mark.asyncio
async def test_dbpool_migrate_creates_projects_table(tmp_path):
    db_path = tmp_path / "noproj.db"
    conn = await aiosqlite.connect(str(db_path))
    conn.row_factory = aiosqlite.Row
    await conn.execute(
        """CREATE TABLE conversations (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL DEFAULT 'New chat',
            mode TEXT NOT NULL DEFAULT 'auto',
            escalated INTEGER NOT NULL DEFAULT 0,
            starred INTEGER NOT NULL DEFAULT 0,
            model_id TEXT,
            project_id TEXT,
            created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
        )"""
    )
    await conn.commit()
    await DBPool._migrate(conn)
    tables = [r[0] for r in await conn.execute_fetchall("SELECT name FROM sqlite_master WHERE type='table'")]
    assert "projects" in tables
    await conn.close()


@pytest.mark.asyncio
async def test_get_db(tmp_path):
    db_path = tmp_path / "standalone.db"
    with patch("core.store.db.DB_PATH", db_path), \
         patch("core.store.db.KITSUNE_DIR", tmp_path):
        conn = await get_db()
        rows = await conn.execute_fetchall(
            "SELECT name FROM sqlite_master WHERE type='table'"
        )
        tables = [r[0] for r in rows]
        assert "conversations" in tables
        await conn.close()


@pytest.mark.asyncio
async def test_schema_has_prs_and_links(tmp_path):
    db_path = tmp_path / "prs.db"
    conn = await aiosqlite.connect(str(db_path))
    conn.row_factory = aiosqlite.Row
    await conn.executescript(SCHEMA)
    rows = await conn.execute_fetchall("SELECT name FROM sqlite_master WHERE type='table'")
    tables = [r["name"] for r in rows]
    assert "prs" in tables
    assert "chat_pr_links" in tables
    await conn.close()
