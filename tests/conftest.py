import pytest
import pytest_asyncio
import aiosqlite
from core.store.db import SCHEMA


@pytest_asyncio.fixture
async def db(tmp_path):
    db_path = tmp_path / "test.db"
    conn = await aiosqlite.connect(str(db_path))
    conn.row_factory = aiosqlite.Row
    await conn.execute("PRAGMA foreign_keys=ON")
    await conn.executescript(SCHEMA)
    yield conn
    await conn.close()
