import pytest
from unittest.mock import MagicMock, patch, AsyncMock

import httpx
from fastapi import FastAPI

from core.api.context import router


class FakePool:
    def __init__(self, db):
        self._db = db

    def acquire(self):
        return FakeAcquire(self._db)


class FakeAcquire:
    def __init__(self, db):
        self._db = db

    async def __aenter__(self):
        return self._db

    async def __aexit__(self, *args):
        pass


def make_app(db):
    app = FastAPI()
    app.state.db_pool = FakePool(db)
    app.include_router(router)
    return app


@pytest.mark.asyncio
async def test_search_files_project_not_found(db):
    app = make_app(db)
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post("/api/search/files", json={
            "project_id": "nonexistent", "query": "test"
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["results"] == []
        assert "error" in data


@pytest.mark.asyncio
async def test_search_files_project_found(db):
    await db.execute(
        "INSERT INTO projects (id, name, path) VALUES (?, ?, ?)",
        ("proj-1", "Test", "/tmp/test-project"),
    )
    await db.commit()

    mock_idx = MagicMock()
    mock_result = MagicMock()
    mock_result.path = "test.py"
    mock_result.name = "test.py"
    mock_result.ext = ".py"
    mock_result.size = 100
    mock_result.is_dir = False
    mock_idx.search.return_value = [mock_result]

    app = make_app(db)
    transport = httpx.ASGITransport(app=app)
    with patch("core.api.context.get_or_build_index", return_value=mock_idx):
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.post("/api/search/files", json={
                "project_id": "proj-1", "query": "test"
            })
            assert resp.status_code == 200
            data = resp.json()
            assert len(data["results"]) == 1
            assert data["results"][0]["name"] == "test.py"


@pytest.mark.asyncio
async def test_search_content_project_not_found(db):
    app = make_app(db)
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post("/api/search/content", json={
            "project_id": "nonexistent", "query": "test"
        })
        assert resp.status_code == 200
        assert resp.json()["results"] == []


@pytest.mark.asyncio
async def test_search_content_project_found(db):
    await db.execute(
        "INSERT INTO projects (id, name, path) VALUES (?, ?, ?)",
        ("proj-2", "Test2", "/tmp/test-project-2"),
    )
    await db.commit()

    mock_idx = MagicMock()
    mock_idx.search_content.return_value = [{"path": "test.py", "line": 1, "text": "hello"}]

    app = make_app(db)
    transport = httpx.ASGITransport(app=app)
    with patch("core.api.context.get_or_build_index", return_value=mock_idx):
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.post("/api/search/content", json={
                "project_id": "proj-2", "query": "hello"
            })
            assert resp.status_code == 200
            assert len(resp.json()["results"]) == 1


@pytest.mark.asyncio
async def test_mention_completions_no_project(db):
    app = make_app(db)
    transport = httpx.ASGITransport(app=app)
    with patch("core.api.context.get_mention_completions", return_value=[]):
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.post("/api/mentions/complete", json={"query": "tes"})
            assert resp.status_code == 200
            assert "completions" in resp.json()


@pytest.mark.asyncio
async def test_mention_completions_with_project(db):
    await db.execute(
        "INSERT INTO projects (id, name, path) VALUES (?, ?, ?)",
        ("proj-3", "Test3", "/tmp/test-project-3"),
    )
    await db.commit()

    app = make_app(db)
    transport = httpx.ASGITransport(app=app)
    with patch("core.api.context.get_mention_completions", return_value=[{"label": "test.py", "type": "file"}]):
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.post("/api/mentions/complete", json={
                "project_id": "proj-3", "query": "test"
            })
            assert resp.status_code == 200
            assert len(resp.json()["completions"]) == 1


@pytest.mark.asyncio
async def test_rebuild_index_project_not_found(db):
    app = make_app(db)
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post("/api/index/rebuild", json={
            "project_id": "nonexistent", "query": "test"
        })
        assert resp.status_code == 200
        assert resp.json()["ok"] is False


@pytest.mark.asyncio
async def test_rebuild_index_success(db):
    await db.execute(
        "INSERT INTO projects (id, name, path) VALUES (?, ?, ?)",
        ("proj-4", "Test4", "/tmp/test-project-4"),
    )
    await db.commit()

    mock_file = MagicMock()
    mock_file.is_dir = False
    mock_dir = MagicMock()
    mock_dir.is_dir = True
    mock_idx = MagicMock()
    mock_idx.files = [mock_file, mock_file, mock_dir]

    app = make_app(db)
    transport = httpx.ASGITransport(app=app)
    with patch("core.api.context.invalidate_index") as mock_inv:
        with patch("core.api.context.get_or_build_index", return_value=mock_idx):
            async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
                resp = await client.post("/api/index/rebuild", json={
                    "project_id": "proj-4", "query": "test"
                })
                assert resp.status_code == 200
                data = resp.json()
                assert data["ok"] is True
                assert data["files"] == 2
                assert data["directories"] == 1
                mock_inv.assert_called_once()
