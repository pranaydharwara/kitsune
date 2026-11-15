import asyncio
import json
import pytest
import pytest_asyncio
import httpx
import aiosqlite
from fastapi import FastAPI
from unittest.mock import patch, AsyncMock, MagicMock
from contextlib import asynccontextmanager

from core.api.chat import router as chat_router
from core.api.conversations import router as conv_router
from core.api.projects import router as proj_router
from core.api.settings import router as settings_router
from core.api.transfer import router as transfer_router
from core.connectors.base import Chunk, Prompt
from core.store.db import SCHEMA


class FakePool:
    def __init__(self, conn):
        self._conn = conn

    @asynccontextmanager
    async def acquire(self):
        yield self._conn


@pytest_asyncio.fixture
async def client(tmp_path):
    app = FastAPI()
    app.include_router(chat_router)
    app.include_router(transfer_router)
    app.include_router(conv_router)
    app.include_router(proj_router)
    app.include_router(settings_router)
    db_path = tmp_path / "test.db"
    conn = await aiosqlite.connect(str(db_path))
    conn.row_factory = aiosqlite.Row
    await conn.execute("PRAGMA foreign_keys=ON")
    await conn.executescript(SCHEMA)
    app.state.db_pool = FakePool(conn)
    app.state.http = httpx.AsyncClient(base_url="http://localhost:11434")
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as c:
        yield c
    await conn.close()


# --- Conversations ---

@pytest.mark.asyncio
async def test_create_conversation(client):
    r = await client.post("/api/conversations")
    assert r.status_code == 200
    data = r.json()
    assert "id" in data


@pytest.mark.asyncio
async def test_list_conversations(client):
    await client.post("/api/conversations")
    r = await client.get("/api/conversations")
    assert r.status_code == 200
    assert isinstance(r.json(), list)


@pytest.mark.asyncio
async def test_get_conversation(client):
    cr = await client.post("/api/conversations")
    conv_id = cr.json()["id"]
    r = await client.get(f"/api/conversations/{conv_id}")
    assert r.status_code == 200
    assert r.json()["id"] == conv_id


@pytest.mark.asyncio
async def test_get_conversation_not_found(client):
    r = await client.get("/api/conversations/nonexistent")
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_update_conversation(client):
    cr = await client.post("/api/conversations")
    conv_id = cr.json()["id"]
    r = await client.patch(
        f"/api/conversations/{conv_id}",
        json={"title": "Updated Title"},
    )
    assert r.status_code == 200
    assert r.json()["ok"] is True


@pytest.mark.asyncio
async def test_delete_conversation(client):
    cr = await client.post("/api/conversations")
    conv_id = cr.json()["id"]
    r = await client.delete(f"/api/conversations/{conv_id}")
    assert r.status_code == 200


@pytest.mark.asyncio
async def test_get_conversation_usage(client):
    cr = await client.post("/api/conversations")
    conv_id = cr.json()["id"]
    r = await client.get(f"/api/conversations/{conv_id}/usage")
    assert r.status_code == 200
    data = r.json()
    assert "total_messages" in data


@pytest.mark.asyncio
async def test_fork_conversation_not_found(client):
    cr = await client.post("/api/conversations")
    conv_id = cr.json()["id"]
    r = await client.post(
        f"/api/conversations/{conv_id}/fork",
        json={"message_id": "nonexistent"},
    )
    assert r.status_code == 404


# --- Projects ---

@pytest.mark.asyncio
async def test_create_project(client):
    r = await client.post("/api/projects", json={"path": "/tmp/test-proj"})
    assert r.status_code == 200
    assert r.json()["path"] == "/tmp/test-proj"


@pytest.mark.asyncio
async def test_list_projects(client):
    await client.post("/api/projects", json={"path": "/tmp/p1"})
    r = await client.get("/api/projects")
    assert r.status_code == 200
    assert len(r.json()) >= 1


@pytest.mark.asyncio
async def test_get_project(client):
    cr = await client.post("/api/projects", json={"path": "/tmp/gp"})
    pid = cr.json()["id"]
    r = await client.get(f"/api/projects/{pid}")
    assert r.status_code == 200


@pytest.mark.asyncio
async def test_get_project_not_found(client):
    r = await client.get("/api/projects/nonexistent")
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_update_project(client):
    cr = await client.post("/api/projects", json={"path": "/tmp/up"})
    pid = cr.json()["id"]
    r = await client.patch(f"/api/projects/{pid}", json={"name": "Renamed"})
    assert r.status_code == 200


@pytest.mark.asyncio
async def test_delete_project(client):
    cr = await client.post("/api/projects", json={"path": "/tmp/dp"})
    pid = cr.json()["id"]
    r = await client.delete(f"/api/projects/{pid}")
    assert r.status_code == 200


# --- Settings ---

@pytest.mark.asyncio
async def test_get_settings(client):
    with patch("core.api.settings.settings") as mock:
        mock.load.return_value = {"theme": "dark", "anthropic_api_key": "", "default_mode": "auto", "default_model": None}
        r = await client.get("/api/settings")
        assert r.status_code == 200
        assert "has_api_key" in r.json()


@pytest.mark.asyncio
async def test_get_settings_with_key(client):
    with patch("core.api.settings.settings") as mock:
        mock.load.return_value = {"anthropic_api_key": "sk-ant-1234567890abcdefgh", "theme": "dark", "default_mode": "auto", "default_model": None}
        r = await client.get("/api/settings")
        data = r.json()
        assert data["has_api_key"] is True
        assert "..." in data["anthropic_api_key"]


@pytest.mark.asyncio
async def test_update_settings(client):
    with patch("core.api.settings.settings") as mock:
        r = await client.put("/api/settings", json={"theme": "light"})
        assert r.status_code == 200
        mock.save.assert_called_once()


@pytest.mark.asyncio
async def test_clear_api_key(client):
    with patch("core.api.settings.settings") as mock:
        r = await client.delete("/api/settings/api-key")
        assert r.status_code == 200


# --- Usage ---

@pytest.mark.asyncio
async def test_get_usage(client):
    r = await client.get("/api/usage")
    assert r.status_code == 200
    data = r.json()
    assert "total_messages" in data


# --- Transfer ---

@pytest.mark.asyncio
async def test_export_conversation(client):
    cr = await client.post("/api/conversations")
    conv_id = cr.json()["id"]
    r = await client.get(f"/api/conversations/{conv_id}/export")
    assert r.status_code == 200
    data = r.json()
    assert "content" in data
    assert "filename" in data


@pytest.mark.asyncio
async def test_export_conversation_markdown(client):
    cr = await client.post("/api/conversations")
    conv_id = cr.json()["id"]
    r = await client.get(f"/api/conversations/{conv_id}/export?format=markdown")
    assert r.status_code == 200


@pytest.mark.asyncio
async def test_export_conversation_not_found(client):
    r = await client.get("/api/conversations/nonexistent/export")
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_export_all(client):
    await client.post("/api/conversations")
    r = await client.get("/api/conversations/export-all")
    assert r.status_code == 200
    data = r.json()
    assert "content" in data


@pytest.mark.asyncio
async def test_import_kitsune_format(client):
    export_data = json.dumps({
        "format": "kitsune",
        "version": 1,
        "conversations": [{
            "conversation": {"title": "Imported"},
            "messages": [
                {"role": "user", "text": "Hello"},
                {"role": "assistant", "text": "Hi"},
            ],
        }],
    })
    r = await client.post(
        "/api/conversations/import",
        files={"file": ("export.json", export_data.encode(), "application/json")},
    )
    assert r.status_code == 200
    assert r.json()["imported"] == 1


@pytest.mark.asyncio
async def test_import_invalid_json(client):
    r = await client.post(
        "/api/conversations/import",
        files={"file": ("bad.json", b"not json", "application/json")},
    )
    assert r.status_code == 400


@pytest.mark.asyncio
async def test_import_unknown_format(client):
    r = await client.post(
        "/api/conversations/import",
        files={"file": ("data.json", json.dumps({"unknown": True}).encode(), "application/json")},
    )
    assert r.status_code == 400


@pytest.mark.asyncio
async def test_import_claude_format(client):
    claude_data = json.dumps([{
        "uuid": "abc",
        "name": "Claude Chat",
        "chat_messages": [
            {"sender": "human", "content": [{"type": "text", "text": "Hello"}], "created_at": "2024-01-01"},
            {"sender": "assistant", "content": [{"type": "text", "text": "Hi"}], "model": "claude-3", "created_at": "2024-01-01"},
        ],
    }])
    r = await client.post(
        "/api/conversations/import",
        files={"file": ("claude.json", claude_data.encode(), "application/json")},
    )
    assert r.status_code == 200
    assert r.json()["imported"] == 1


# --- Chat cancel and feedback ---

@pytest.mark.asyncio
async def test_cancel_no_active_stream(client):
    r = await client.post("/api/chat/nonexistent/cancel")
    assert r.status_code == 200
    assert r.json()["ok"] is False


@pytest.mark.asyncio
async def test_cancel_active_stream(client):
    import asyncio
    from core.api.chat import _active_streams
    event = asyncio.Event()
    _active_streams["test-conv-cancel"] = event
    r = await client.post("/api/chat/test-conv-cancel/cancel")
    assert r.status_code == 200
    assert r.json()["ok"] is True
    assert event.is_set()
    _active_streams.pop("test-conv-cancel", None)


@pytest.mark.asyncio
async def test_feedback_invalid(client):
    r = await client.post("/api/chat/msg-1/feedback", json={"feedback": "invalid"})
    assert r.status_code == 200
    assert r.json()["ok"] is False


@pytest.mark.asyncio
async def test_feedback_message_not_found(client):
    r = await client.post("/api/chat/nonexistent/feedback", json={"feedback": "up"})
    assert r.status_code == 200
    assert r.json()["ok"] is False


@pytest.mark.asyncio
async def test_context_snapshot_not_found(client):
    r = await client.get("/api/chat/nonexistent/context")
    assert r.status_code == 200
    assert r.json().get("snapshot") is None


@pytest.mark.asyncio
async def test_list_models(client):
    with patch("core.api.chat._is_claude_available", return_value=False):
        r = await client.get("/api/models")
        assert r.status_code == 200
        data = r.json()
        assert "local" in data
        assert "cloud" in data


@pytest.mark.asyncio
async def test_list_models_with_claude(client):
    with patch("core.api.chat._is_claude_available", return_value=True):
        r = await client.get("/api/models")
        assert r.status_code == 200
        data = r.json()
        assert len(data["cloud"]) > 0
        assert data["cloud"][0]["provider"] == "claude"


# --- Project instructions ---

@pytest.mark.asyncio
async def test_get_project_instructions(client, tmp_path):
    cr = await client.post("/api/projects", json={"path": str(tmp_path)})
    pid = cr.json()["id"]
    with patch("core.api.projects.get_instructions_info", return_value={"has_instructions": False, "content": "", "file": None}):
        r = await client.get(f"/api/projects/{pid}/instructions")
        assert r.status_code == 200
        assert "has_instructions" in r.json()


@pytest.mark.asyncio
async def test_get_project_instructions_not_found(client):
    r = await client.get("/api/projects/nonexistent/instructions")
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_set_project_instructions(client, tmp_path):
    cr = await client.post("/api/projects", json={"path": str(tmp_path)})
    pid = cr.json()["id"]
    with patch("core.api.projects.save_project_instructions", return_value=str(tmp_path / ".kitsune")):
        r = await client.put(
            f"/api/projects/{pid}/instructions",
            json={"content": "Always respond concisely"},
        )
        assert r.status_code == 200
        assert r.json()["ok"] is True


@pytest.mark.asyncio
async def test_set_project_instructions_not_found(client):
    r = await client.put(
        "/api/projects/nonexistent/instructions",
        json={"content": "test"},
    )
    assert r.status_code == 404


# --- Feedback with valid message ---

@pytest.mark.asyncio
async def test_feedback_valid_message(client):
    cr = await client.post("/api/conversations")
    conv_id = cr.json()["id"]
    from core.store.messages import add_message
    from core.store.db import SCHEMA
    pool = client._transport.app.state.db_pool
    async with pool.acquire() as db:
        msg = await add_message(db, conv_id, "assistant", "Test response")
        msg_id = msg["id"]
    r = await client.post(f"/api/chat/{msg_id}/feedback", json={"feedback": "up"})
    assert r.status_code == 200
    assert r.json()["ok"] is True


@pytest.mark.asyncio
async def test_feedback_down_valid(client):
    cr = await client.post("/api/conversations")
    conv_id = cr.json()["id"]
    from core.store.messages import add_message
    pool = client._transport.app.state.db_pool
    async with pool.acquire() as db:
        msg = await add_message(db, conv_id, "assistant", "Bad response")
        msg_id = msg["id"]
    r = await client.post(f"/api/chat/{msg_id}/feedback", json={"feedback": "down"})
    assert r.status_code == 200
    assert r.json()["ok"] is True


# --- Star/unstar conversation ---

@pytest.mark.asyncio
async def test_star_conversation(client):
    cr = await client.post("/api/conversations")
    conv_id = cr.json()["id"]
    r = await client.patch(
        f"/api/conversations/{conv_id}",
        json={"starred": True},
    )
    assert r.status_code == 200


# --- Chat SSE stream integration ---

def _parse_sse(text: str) -> list[dict]:
    events = []
    current_event = None
    current_data = []
    for raw_line in text.replace("\r\n", "\n").split("\n"):
        line = raw_line.strip()
        if line.startswith("event:"):
            current_event = line[6:].strip()
        elif line.startswith("data:"):
            current_data.append(line[5:].strip())
        elif line == "" and current_event:
            data_str = "\n".join(current_data)
            try:
                data = json.loads(data_str)
            except (json.JSONDecodeError, ValueError):
                data = data_str
            events.append({"event": current_event, "data": data})
            current_event = None
            current_data = []
    return events


@pytest.mark.asyncio
async def test_chat_stream_local_simple(client):
    """Test the chat endpoint with a mocked local connector streaming response."""
    async def mock_stream(prompt):
        yield Chunk(text="Hello ", done=False)
        yield Chunk(text="world!", done=False)
        yield Chunk(text="", done=True)

    mock_connector = MagicMock()
    mock_connector.model = "test-model"
    mock_connector.stream = mock_stream
    mock_connector.last_usage = None

    with patch("core.api.chat._pick_connector", new_callable=AsyncMock) as mock_pick:
        mock_pick.return_value = (mock_connector, "Test reason")
        r = await client.post("/api/chat", json={"message": "Hello"})
        assert r.status_code == 200
        events = _parse_sse(r.text)
        event_types = [e["event"] for e in events]
        assert "route" in event_types
        assert "token" in event_types
        assert "done" in event_types


@pytest.mark.asyncio
async def test_chat_stream_with_conversation(client):
    cr = await client.post("/api/conversations")
    conv_id = cr.json()["id"]

    async def mock_stream(prompt):
        yield Chunk(text="Reply", done=False)
        yield Chunk(text="", done=True)

    mock_connector = MagicMock()
    mock_connector.model = "test-model"
    mock_connector.stream = mock_stream
    mock_connector.last_usage = None

    with patch("core.api.chat._pick_connector", new_callable=AsyncMock) as mock_pick:
        mock_pick.return_value = (mock_connector, "Existing conv")
        r = await client.post("/api/chat", json={"message": "Hi", "conversation_id": conv_id})
        assert r.status_code == 200
        events = _parse_sse(r.text)
        done_events = [e for e in events if e["event"] == "done"]
        assert len(done_events) == 1
        assert done_events[0]["data"]["conversation_id"] == conv_id


@pytest.mark.asyncio
async def test_chat_stream_with_project(client, tmp_path):
    cr = await client.post("/api/projects", json={"path": str(tmp_path)})
    pid = cr.json()["id"]

    async def mock_stream(prompt):
        yield Chunk(text="Project reply", done=False)
        yield Chunk(text="", done=True)

    mock_connector = MagicMock()
    mock_connector.model = "test-model"
    mock_connector.stream = mock_stream
    mock_connector.last_usage = None

    with patch("core.api.chat._pick_connector", new_callable=AsyncMock) as mock_pick:
        mock_pick.return_value = (mock_connector, "With project")
        r = await client.post("/api/chat", json={"message": "Hello", "project_id": pid})
        assert r.status_code == 200
        events = _parse_sse(r.text)
        assert any(e["event"] == "done" for e in events)


@pytest.mark.asyncio
async def test_chat_stream_claude_connector(client):
    """Test chat with a Claude-type connector for the Claude code path."""
    from core.connectors.claude_sdk import ClaudeSdkConnector

    async def mock_stream(prompt):
        yield Chunk(text="Claude says hi", done=False)
        yield Chunk(text="", done=True)

    mock_connector = MagicMock(spec=ClaudeSdkConnector)
    mock_connector.model = "claude-sonnet-4-20250514"
    mock_connector.stream = mock_stream
    mock_connector.last_usage = MagicMock()
    mock_connector.last_usage.tokens_in = 100
    mock_connector.last_usage.tokens_out = 50

    with patch("core.api.chat._pick_connector", new_callable=AsyncMock) as mock_pick:
        mock_pick.return_value = (mock_connector, "Cloud mode")
        r = await client.post("/api/chat", json={"message": "Hello"})
        assert r.status_code == 200
        events = _parse_sse(r.text)
        assert any(e["event"] == "done" for e in events)
        route_events = [e for e in events if e["event"] == "route"]
        assert len(route_events) == 1
        assert "claude" in route_events[0]["data"]["source"]


@pytest.mark.asyncio
async def test_chat_stream_error(client):
    """Test that errors during streaming are reported as SSE error events."""
    async def mock_stream(prompt):
        yield Chunk(text="partial", done=False)
        raise RuntimeError("Connection lost")

    mock_connector = MagicMock()
    mock_connector.model = "test-model"
    mock_connector.stream = mock_stream
    mock_connector.last_usage = None

    with patch("core.api.chat._pick_connector", new_callable=AsyncMock) as mock_pick:
        mock_pick.return_value = (mock_connector, "Test")
        r = await client.post("/api/chat", json={"message": "Hello"})
        assert r.status_code == 200
        events = _parse_sse(r.text)
        assert any(e["event"] == "error" for e in events)


@pytest.mark.asyncio
async def test_chat_stream_with_usage(client):
    """Test that usage data (tokens, cost, speed) is included in the done event."""
    from core.connectors.base import Usage

    async def mock_stream(prompt):
        yield Chunk(text="Reply with usage", done=False)
        yield Chunk(text="", done=True)

    mock_connector = MagicMock()
    mock_connector.model = "test-model"
    mock_connector.stream = mock_stream
    mock_connector.last_usage = Usage(tokens_in=500, tokens_out=200)

    with patch("core.api.chat._pick_connector", new_callable=AsyncMock) as mock_pick:
        mock_pick.return_value = (mock_connector, "Test")
        r = await client.post("/api/chat", json={"message": "Hello"})
        assert r.status_code == 200
        events = _parse_sse(r.text)
        done_events = [e for e in events if e["event"] == "done"]
        assert len(done_events) == 1
        assert "speed" in done_events[0]["data"]


@pytest.mark.asyncio
async def test_chat_stream_model_pull(client):
    """Test that model pull events are streamed when model not available."""
    from core.connectors.ollama import OllamaConnector

    async def mock_stream(prompt):
        yield Chunk(text="After pull", done=False)
        yield Chunk(text="", done=True)

    async def mock_pull():
        yield {"status": "downloading", "total": 1000, "completed": 500}
        yield {"status": "success"}

    mock_connector = MagicMock(spec=OllamaConnector)
    mock_connector.model = "test-model"
    mock_connector.stream = mock_stream
    mock_connector.is_available = AsyncMock(return_value=False)
    mock_connector.pull_model = mock_pull
    mock_connector.last_usage = None

    with patch("core.api.chat._pick_connector", new_callable=AsyncMock) as mock_pick:
        mock_pick.return_value = (mock_connector, "Local mode")
        r = await client.post("/api/chat", json={"message": "Hello"})
        assert r.status_code == 200
        events = _parse_sse(r.text)
        event_types = [e["event"] for e in events]
        assert "model_pull" in event_types


@pytest.mark.asyncio
async def test_chat_stream_retry(client):
    """Test retry with different mode."""
    cr = await client.post("/api/conversations")
    conv_id = cr.json()["id"]
    pool = client._transport.app.state.db_pool
    from core.store.messages import add_message as _add_msg
    async with pool.acquire() as db:
        await _add_msg(db, conv_id, "user", "Original question")
        msg = await _add_msg(db, conv_id, "assistant", "Bad answer")

    async def mock_stream(prompt):
        yield Chunk(text="Better answer", done=False)
        yield Chunk(text="", done=True)

    mock_connector = MagicMock()
    mock_connector.model = "retry-model"
    mock_connector.stream = mock_stream
    mock_connector.last_usage = None

    with patch("core.api.chat._pick_connector", new_callable=AsyncMock) as mock_pick:
        mock_pick.return_value = (mock_connector, "Retry cloud")
        r = await client.post("/api/chat", json={
            "message": "Original question",
            "conversation_id": conv_id,
            "retry_message_id": msg["id"],
            "retry_with": "cloud",
        })
        assert r.status_code == 200
        events = _parse_sse(r.text)
        assert any(e["event"] == "done" for e in events)
