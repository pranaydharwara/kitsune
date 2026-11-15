import asyncio
import json
import time
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from contextlib import asynccontextmanager

import httpx
import aiosqlite
from fastapi import FastAPI

from core.api.chat import (
    _estimate_cost,
    _build_local_messages,
    _strip_tool_tags,
    _tool_summary,
    _handle_text_tool_calls,
    _get_ollama_models,
    _is_claude_available,
    _get_local_connector,
    _get_claude_connector,
    _get_claude_connector_for_model,
    _pick_connector,
    _background_summary,
    _background_auto_title,
    _tool_loop,
    _claude_tool_loop,
    _active_streams,
    COST_PER_M,
    LOCAL_SYSTEM,
    MODEL_CACHE_TTL,
    CLAUDE_CACHE_TTL,
    TOOL_SYSTEM_SUFFIX,
    MAX_TOOL_ROUNDS,
    ChatRequest,
    router as chat_router,
)
from core.api.transfer import _is_claude_export
from core.store.db import SCHEMA
from core.connectors.ollama import OllamaConnector
from core.connectors.claude_sdk import ClaudeSdkConnector
from core.connectors.claude_cli import ClaudeCliConnector


# ---- Helpers ----

class FakePool:
    def __init__(self, conn):
        self._conn = conn

    @asynccontextmanager
    async def acquire(self):
        yield self._conn


# ---- Cost estimation ----

def test_estimate_cost_known_model():
    cost = _estimate_cost("claude-sonnet-5-5-20250514", 1000, 500)
    assert cost is not None
    assert cost > 0


def test_estimate_cost_unknown_model():
    cost = _estimate_cost("unknown-model", 1000, 500)
    assert cost is None


def test_estimate_cost_zero():
    cost = _estimate_cost("claude-sonnet-5-5-20250514", 0, 0)
    assert cost == 0


def test_cost_per_m_has_entries():
    assert len(COST_PER_M) >= 3


def test_estimate_cost_all_models():
    for model in COST_PER_M:
        cost = _estimate_cost(model, 1000, 1000)
        assert cost is not None
        assert cost > 0


# ---- Messages ----

def test_build_local_messages():
    history = [
        {"role": "user", "text": "Hello"},
        {"role": "assistant", "text": "Hi"},
    ]
    msgs = _build_local_messages(history)
    assert len(msgs) == 2
    assert msgs[0]["role"] == "user"
    assert msgs[0]["content"] == "Hello"


def test_build_local_messages_empty():
    assert _build_local_messages([]) == []


# ---- Strip tool tags ----

def test_strip_tool_tags():
    text = 'Before <tool_call>{"name": "test"}</tool_call> After'
    result = _strip_tool_tags(text)
    assert "<tool_call>" not in result
    assert "Before" in result
    assert "After" in result


def test_strip_tool_tags_no_tags():
    assert _strip_tool_tags("No tool tags here") == "No tool tags here"


def test_strip_tool_tags_empty():
    assert _strip_tool_tags("") == ""


def test_strip_tool_tags_multiple():
    text = '<tool_call>{"name":"a"}</tool_call> middle <tool_call>{"name":"b"}</tool_call>'
    result = _strip_tool_tags(text)
    assert "middle" in result
    assert "<tool_call>" not in result


# ---- Tool summary ----

def test_tool_summary_error():
    result = _tool_summary("read_file", {"path": "test.py"}, {"error": "Not found"})
    assert "failed" in result.lower()


def test_tool_summary_create_file():
    result = _tool_summary("create_file", {"path": "new.py"}, {"size": 100})
    assert "Created" in result
    assert "new.py" in result


def test_tool_summary_edit_file():
    result = _tool_summary("edit_file", {"path": "edit.py"}, {})
    assert "Edited" in result


def test_tool_summary_run_command():
    result = _tool_summary("run_command", {"command": "echo hi"}, {"output": "hi", "exit_code": 0})
    assert "Ran" in result
    assert "echo hi" in result


def test_tool_summary_run_command_failure():
    result = _tool_summary("run_command", {"command": "bad"}, {"output": "err", "exit_code": 1})
    assert "exit code" in result


def test_tool_summary_read_file():
    result = _tool_summary("read_file", {"path": "x.py"}, {"size": 500})
    assert "Read" in result


def test_tool_summary_list_files():
    result = _tool_summary("list_files", {"path": "."}, {"entries": ["a.py", "b.py"]})
    assert "Listed" in result


def test_tool_summary_list_files_many():
    entries = [f"file_{i}.py" for i in range(40)]
    result = _tool_summary("list_files", {"path": "src"}, {"entries": entries})
    assert "40 total" in result


def test_tool_summary_git_operation():
    result = _tool_summary("git_operation", {"operation": "status"}, {"output": "clean", "exit_code": 0})
    assert "Git" in result


def test_tool_summary_git_operation_error():
    result = _tool_summary("git_operation", {"operation": "commit"}, {"output": "err", "exit_code": 128})
    assert "exit code" in result


def test_tool_summary_think():
    result = _tool_summary("think", {}, {"steps": ["Step 1", "Step 2"]})
    assert "Plan" in result


def test_tool_summary_verify():
    result = _tool_summary("verify", {"check": "tests pass"}, {"result": "pass"})
    assert "Verify" in result


def test_tool_summary_verify_fail():
    result = _tool_summary("verify", {"check": "lint"}, {"result": "fail", "details": "3 errors"})
    assert "3 errors" in result


def test_tool_summary_verify_partial():
    result = _tool_summary("verify", {"check": "tests"}, {"result": "partial"})
    assert "~" in result


def test_tool_summary_unknown():
    result = _tool_summary("unknown_tool", {}, {})
    assert "Used" in result


def test_tool_summary_run_command_long_output():
    output = "x" * 600
    result = _tool_summary("run_command", {"command": "cat big"}, {"output": output, "exit_code": 0})
    assert "..." in result


# ---- Handle text tool calls ----

def test_handle_text_tool_calls_no_project():
    text = '<tool_call>{"name": "read_file", "arguments": {"path": "test.py"}}</tool_call>'
    events = _handle_text_tool_calls(text, None)
    assert any("no project" in e.get("data", "").lower() for e in events)


def test_handle_text_tool_calls_with_project(tmp_path):
    (tmp_path / "test.py").write_text("print('hello')")
    text = '<tool_call>{"name": "read_file", "arguments": {"path": "test.py"}}</tool_call>'
    events = _handle_text_tool_calls(text, str(tmp_path))
    assert any('"tool_use"' in str(e) or e.get("event") == "tool_use" for e in events)


def test_handle_text_tool_calls_with_plain_text():
    text = 'Some text <tool_call>{"name": "think", "arguments": {"plan": "test", "steps": []}}</tool_call> more text'
    events = _handle_text_tool_calls(text, "/tmp")
    token_events = [e for e in events if e.get("event") == "token"]
    assert len(token_events) >= 1


def test_handle_text_tool_calls_malformed_json():
    text = '<tool_call>not valid json</tool_call>'
    events = _handle_text_tool_calls(text, "/tmp")
    assert isinstance(events, list)


def test_handle_text_tool_calls_no_name():
    text = '<tool_call>{"arguments": {"path": "test.py"}}</tool_call>'
    events = _handle_text_tool_calls(text, "/tmp")
    assert isinstance(events, list)


def test_handle_text_tool_calls_with_conv_id(tmp_path):
    (tmp_path / "test.py").write_text("print('hello')")
    text = '<tool_call>{"name": "read_file", "arguments": {"path": "test.py"}}</tool_call>'
    events = _handle_text_tool_calls(text, str(tmp_path), conv_id="test-conv")
    assert any(e.get("event") == "tool_use" for e in events)


def test_handle_text_tool_calls_error_recording(tmp_path):
    text = '<tool_call>{"name": "read_file", "arguments": {"path": "nonexistent.py"}}</tool_call>'
    events = _handle_text_tool_calls(text, str(tmp_path), conv_id="error-conv")
    tool_events = [e for e in events if e.get("event") == "tool_use"]
    assert len(tool_events) >= 1


def test_handle_text_tool_calls_string_arguments():
    text = '<tool_call>{"name": "read_file", "arguments": "{\\"path\\": \\"test.py\\"}"}</tool_call>'
    events = _handle_text_tool_calls(text, None)
    assert isinstance(events, list)


# ---- Ollama models ----

@pytest.mark.asyncio
async def test_get_ollama_models_success():
    mock_http = AsyncMock()
    mock_response = MagicMock()
    mock_response.json.return_value = {"models": [{"name": "qwen3:8b"}, {"name": "llama3:8b"}]}
    mock_http.get.return_value = mock_response

    from core.api.chat import _model_cache
    _model_cache["ts"] = 0
    _model_cache["models"] = []

    models = await _get_ollama_models(mock_http)
    assert "qwen3:8b" in models


@pytest.mark.asyncio
async def test_get_ollama_models_cached():
    from core.api.chat import _model_cache
    _model_cache["ts"] = time.monotonic()
    _model_cache["models"] = ["cached:model"]

    mock_http = AsyncMock()
    models = await _get_ollama_models(mock_http)
    assert models == ["cached:model"]
    mock_http.get.assert_not_called()


@pytest.mark.asyncio
async def test_get_ollama_models_error():
    mock_http = AsyncMock()
    mock_http.get.side_effect = Exception("Connection refused")

    from core.api.chat import _model_cache
    _model_cache["ts"] = 0
    _model_cache["models"] = ["fallback"]

    models = await _get_ollama_models(mock_http)
    assert models == ["fallback"]


# ---- Claude availability ----

def test_is_claude_available_cached():
    from core.api.chat import _claude_available
    _claude_available["ts"] = time.monotonic()
    _claude_available["ready"] = True
    assert _is_claude_available() is True


def test_is_claude_available_uncached():
    from core.api.chat import _claude_available
    _claude_available["ts"] = time.monotonic() - 120
    _claude_available["ready"] = False

    with patch("core.api.chat.ClaudeSdkConnector") as MockSdk, \
         patch("core.api.chat.ClaudeCliConnector") as MockCli:
        sdk_inst = MagicMock()
        sdk_inst.available.return_value.value = "unavailable"
        MockSdk.return_value = sdk_inst
        cli_inst = MagicMock()
        cli_inst.available.return_value.value = "ready"
        MockCli.return_value = cli_inst

        result = _is_claude_available()
        assert result is True


def test_is_claude_available_none_ready():
    from core.api.chat import _claude_available
    _claude_available["ts"] = time.monotonic() - 120

    with patch("core.api.chat.ClaudeSdkConnector") as MockSdk, \
         patch("core.api.chat.ClaudeCliConnector") as MockCli:
        sdk_inst = MagicMock()
        sdk_inst.available.return_value.value = "unavailable"
        MockSdk.return_value = sdk_inst
        cli_inst = MagicMock()
        cli_inst.available.return_value.value = "unavailable"
        MockCli.return_value = cli_inst

        result = _is_claude_available()
        assert result is False


# ---- Local connector ----

@pytest.mark.asyncio
async def test_get_local_connector_no_models():
    mock_http = AsyncMock()
    from core.api.chat import _model_cache
    _model_cache["ts"] = time.monotonic()
    _model_cache["models"] = []
    connector = await _get_local_connector(mock_http)
    assert connector is not None


@pytest.mark.asyncio
async def test_get_local_connector_with_main_model():
    mock_http = AsyncMock()
    from core.api.chat import _model_cache
    from core.config import MAIN_MODEL
    _model_cache["ts"] = time.monotonic()
    _model_cache["models"] = [MAIN_MODEL, "other:model"]
    connector = await _get_local_connector(mock_http)
    assert connector.model == MAIN_MODEL


@pytest.mark.asyncio
async def test_get_local_connector_fallback_model():
    mock_http = AsyncMock()
    from core.api.chat import _model_cache
    _model_cache["ts"] = time.monotonic()
    _model_cache["models"] = ["different:model"]
    connector = await _get_local_connector(mock_http)
    assert connector.model == "different:model"


# ---- Claude connector ----

def test_get_claude_connector():
    with patch("core.api.chat.ClaudeSdkConnector") as MockSdk:
        mock_instance = MagicMock()
        mock_instance.available.return_value.value = "ready"
        MockSdk.return_value = mock_instance
        result = _get_claude_connector()
        assert result is not None


def test_get_claude_connector_fallback_cli():
    with patch("core.api.chat.ClaudeSdkConnector") as MockSdk:
        mock_instance = MagicMock()
        mock_instance.available.return_value.value = "unavailable"
        MockSdk.return_value = mock_instance
        with patch("core.api.chat.ClaudeCliConnector") as MockCli:
            cli_instance = MagicMock()
            MockCli.return_value = cli_instance
            result = _get_claude_connector()
            assert result is cli_instance


def test_get_claude_connector_for_model_opus():
    with patch("core.api.chat.ClaudeSdkConnector") as MockSdk:
        mock_instance = MagicMock()
        mock_instance.available.return_value.value = "ready"
        MockSdk.return_value = mock_instance
        result = _get_claude_connector_for_model("opus")
        assert result is not None


def test_get_claude_connector_for_model_opus_fallback():
    with patch("core.api.chat.ClaudeSdkConnector") as MockSdk:
        mock_instance = MagicMock()
        mock_instance.available.return_value.value = "unavailable"
        MockSdk.return_value = mock_instance
        with patch("core.api.chat.ClaudeCliConnector") as MockCli:
            cli_instance = MagicMock()
            MockCli.return_value = cli_instance
            result = _get_claude_connector_for_model("opus")
            assert result is cli_instance


def test_get_claude_connector_for_model_non_opus():
    with patch("core.api.chat._get_claude_connector") as mock_get:
        mock_get.return_value = MagicMock()
        result = _get_claude_connector_for_model("sonnet")
        mock_get.assert_called_once()


# ---- Pick connector ----

@pytest.mark.asyncio
async def test_pick_connector_explicit_claude_model():
    mock_http = AsyncMock()
    with patch("core.api.chat.ClaudeSdkConnector") as MockSdk:
        inst = MagicMock()
        inst.available.return_value.value = "ready"
        MockSdk.return_value = inst
        connector, reason = await _pick_connector("auto", [], {}, mock_http, model="claude:claude-sonnet-4-20250514")
        assert "Claude" in reason


@pytest.mark.asyncio
async def test_pick_connector_explicit_claude_model_cli_fallback():
    mock_http = AsyncMock()
    with patch("core.api.chat.ClaudeSdkConnector") as MockSdk:
        inst = MagicMock()
        inst.available.return_value.value = "unavailable"
        MockSdk.return_value = inst
        with patch("core.api.chat.API_TO_CLI", {"claude-sonnet-4-20250514": "sonnet"}):
            connector, reason = await _pick_connector("auto", [], {}, mock_http, model="claude:claude-sonnet-4-20250514")
            assert "CLI" in reason


@pytest.mark.asyncio
async def test_pick_connector_explicit_claude_model_no_cli():
    mock_http = AsyncMock()
    with patch("core.api.chat.ClaudeSdkConnector") as MockSdk:
        inst = MagicMock()
        inst.available.return_value.value = "unavailable"
        MockSdk.return_value = inst
        with patch("core.api.chat.API_TO_CLI", {}):
            with pytest.raises(RuntimeError, match="requires an API key"):
                await _pick_connector("auto", [], {}, mock_http, model="claude:claude-sonnet-4-20250514")


@pytest.mark.asyncio
async def test_pick_connector_explicit_local_model():
    mock_http = AsyncMock()
    connector, reason = await _pick_connector("auto", [], {}, mock_http, model="local:llama3:8b")
    assert isinstance(connector, OllamaConnector)
    assert "llama3" in reason


@pytest.mark.asyncio
async def test_pick_connector_cloud_mode():
    mock_http = AsyncMock()
    from core.api.chat import _model_cache
    _model_cache["ts"] = time.monotonic()
    _model_cache["models"] = ["test:model"]

    with patch("core.api.chat._is_claude_available", return_value=True), \
         patch("core.api.chat._get_claude_connector") as mock_get:
        mock_get.return_value = MagicMock()
        connector, reason = await _pick_connector("cloud", [], {}, mock_http)
        assert "Cloud" in reason


@pytest.mark.asyncio
async def test_pick_connector_cloud_mode_no_claude():
    mock_http = AsyncMock()
    from core.api.chat import _model_cache
    _model_cache["ts"] = time.monotonic()
    _model_cache["models"] = ["test:model"]

    with patch("core.api.chat._is_claude_available", return_value=False):
        connector, reason = await _pick_connector("cloud", [], {}, mock_http)
        assert "unavailable" in reason.lower()


@pytest.mark.asyncio
async def test_pick_connector_local_mode():
    mock_http = AsyncMock()
    from core.api.chat import _model_cache
    _model_cache["ts"] = time.monotonic()
    _model_cache["models"] = ["test:model"]

    with patch("core.api.chat._is_claude_available", return_value=True):
        connector, reason = await _pick_connector("local", [], {}, mock_http)
        assert "Local" in reason


@pytest.mark.asyncio
async def test_pick_connector_auto_new_conversation():
    mock_http = AsyncMock()
    from core.api.chat import _model_cache
    _model_cache["ts"] = time.monotonic()
    _model_cache["models"] = ["test:model"]

    with patch("core.api.chat._is_claude_available", return_value=True):
        connector, reason = await _pick_connector("auto", [], {}, mock_http)
        assert "New conversation" in reason


@pytest.mark.asyncio
async def test_pick_connector_auto_with_history():
    mock_http = AsyncMock()
    from core.api.chat import _model_cache
    _model_cache["ts"] = time.monotonic()
    _model_cache["models"] = ["test:model"]
    history = [{"role": "user", "text": "Hello"}, {"role": "assistant", "text": "Hi"}]

    with patch("core.api.chat._is_claude_available", return_value=True), \
         patch("core.api.chat.router_decide", new_callable=AsyncMock) as mock_decide:
        mock_decide.return_value = {"target": "cloud", "reason": "Complex query", "model_hint": None}
        with patch("core.api.chat._get_claude_connector") as mock_get:
            mock_get.return_value = MagicMock()
            connector, reason = await _pick_connector("auto", history, {}, mock_http)
            assert reason == "Complex query"


@pytest.mark.asyncio
async def test_pick_connector_auto_opus_hint():
    mock_http = AsyncMock()
    from core.api.chat import _model_cache
    _model_cache["ts"] = time.monotonic()
    _model_cache["models"] = ["test:model"]
    history = [{"role": "user", "text": "Hard problem"}]

    with patch("core.api.chat._is_claude_available", return_value=True), \
         patch("core.api.chat.router_decide", new_callable=AsyncMock) as mock_decide:
        mock_decide.return_value = {"target": "cloud", "reason": "Needs opus", "model_hint": "opus"}
        with patch("core.api.chat._get_claude_connector_for_model") as mock_get:
            mock_get.return_value = MagicMock()
            connector, reason = await _pick_connector("auto", history, {}, mock_http)
            mock_get.assert_called_once_with("opus")


@pytest.mark.asyncio
async def test_pick_connector_auto_local_decision():
    mock_http = AsyncMock()
    from core.api.chat import _model_cache
    _model_cache["ts"] = time.monotonic()
    _model_cache["models"] = ["test:model"]
    history = [{"role": "user", "text": "Simple question"}]

    with patch("core.api.chat._is_claude_available", return_value=True), \
         patch("core.api.chat.router_decide", new_callable=AsyncMock) as mock_decide:
        mock_decide.return_value = {"target": "local", "reason": "Simple query"}
        connector, reason = await _pick_connector("auto", history, {}, mock_http)
        assert reason == "Simple query"


# ---- Background tasks ----

@pytest.mark.asyncio
async def test_background_summary(tmp_path):
    db_path = tmp_path / "bg.db"
    conn = await aiosqlite.connect(str(db_path))
    conn.row_factory = aiosqlite.Row
    await conn.execute("PRAGMA foreign_keys=ON")
    await conn.executescript(SCHEMA)
    pool = FakePool(conn)

    from core.store.conversations import create_conversation
    from core.store.messages import add_message
    async with pool.acquire() as db:
        conv = await create_conversation(db, title="Test")
        await add_message(db, conv["id"], "user", "Hello")
        await add_message(db, conv["id"], "assistant", "Hi there")

    with patch("core.api.chat.maybe_update_summary", new_callable=AsyncMock):
        await _background_summary(pool, conv["id"])

    await conn.close()


@pytest.mark.asyncio
async def test_background_summary_exception(tmp_path):
    db_path = tmp_path / "bg_err.db"
    conn = await aiosqlite.connect(str(db_path))
    conn.row_factory = aiosqlite.Row
    await conn.executescript(SCHEMA)
    pool = FakePool(conn)

    await _background_summary(pool, "nonexistent-id")
    await conn.close()


@pytest.mark.asyncio
async def test_background_auto_title(tmp_path):
    db_path = tmp_path / "title.db"
    conn = await aiosqlite.connect(str(db_path))
    conn.row_factory = aiosqlite.Row
    await conn.execute("PRAGMA foreign_keys=ON")
    await conn.executescript(SCHEMA)
    pool = FakePool(conn)

    from core.store.conversations import create_conversation
    from core.store.messages import add_message
    async with pool.acquire() as db:
        conv = await create_conversation(db, title="Hello world how are you")
        await add_message(db, conv["id"], "user", "Hello world how are you")
        await add_message(db, conv["id"], "assistant", "I'm doing great")

    mock_http = AsyncMock()
    mock_response = MagicMock()
    mock_response.json.return_value = {"message": {"content": "Greeting Chat"}}
    mock_http.post.return_value = mock_response

    await _background_auto_title(pool, mock_http, conv["id"])
    await conn.close()


@pytest.mark.asyncio
async def test_background_auto_title_skips_renamed(tmp_path):
    db_path = tmp_path / "title2.db"
    conn = await aiosqlite.connect(str(db_path))
    conn.row_factory = aiosqlite.Row
    await conn.execute("PRAGMA foreign_keys=ON")
    await conn.executescript(SCHEMA)
    pool = FakePool(conn)

    from core.store.conversations import create_conversation, update_conversation
    from core.store.messages import add_message
    async with pool.acquire() as db:
        conv = await create_conversation(db, title="Original")
        await update_conversation(db, conv["id"], title="Custom Title")
        await add_message(db, conv["id"], "user", "Hello")
        await add_message(db, conv["id"], "assistant", "Hi")

    mock_http = AsyncMock()
    await _background_auto_title(pool, mock_http, conv["id"])
    mock_http.post.assert_not_called()
    await conn.close()


@pytest.mark.asyncio
async def test_background_auto_title_nonexistent():
    pool = MagicMock()
    pool.acquire = MagicMock()

    @asynccontextmanager
    async def fake_acquire():
        mock_db = AsyncMock()
        mock_db.execute_fetchall = AsyncMock(return_value=[])
        yield mock_db

    pool.acquire = fake_acquire
    mock_http = AsyncMock()
    await _background_auto_title(pool, mock_http, "nonexistent")


# ---- Tool loop ----

@pytest.mark.asyncio
async def test_tool_loop_text_only():
    connector = MagicMock()
    connector.chat_with_tools = AsyncMock(return_value={
        "content": "Just a text response",
        "tool_calls": None,
    })

    cancel = asyncio.Event()
    events = []
    async for event in _tool_loop(connector, [{"role": "user", "content": "hi"}], "sys", "/tmp", cancel):
        events.append(event)

    assert any(e["event"] == "token" for e in events)


@pytest.mark.asyncio
async def test_tool_loop_with_tool_call(tmp_path):
    (tmp_path / "test.py").write_text("print('hello')")

    call_count = 0
    async def mock_chat_with_tools(msgs, tools):
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            return {
                "content": "Let me read that",
                "tool_calls": [{"function": {"name": "read_file", "arguments": {"path": "test.py"}}}],
            }
        return {"content": "Done!", "tool_calls": None}

    connector = MagicMock()
    connector.chat_with_tools = mock_chat_with_tools

    cancel = asyncio.Event()
    events = []
    async for event in _tool_loop(connector, [{"role": "user", "content": "read test.py"}], "sys", str(tmp_path), cancel):
        events.append(event)

    tool_events = [e for e in events if e.get("event") == "tool_use"]
    assert len(tool_events) >= 1


@pytest.mark.asyncio
async def test_tool_loop_cancelled():
    connector = MagicMock()
    cancel = asyncio.Event()
    cancel.set()

    events = []
    async for event in _tool_loop(connector, [], "sys", "/tmp", cancel):
        events.append(event)
    assert len(events) == 0


@pytest.mark.asyncio
async def test_tool_loop_no_content_no_tools():
    connector = MagicMock()
    connector.chat_with_tools = AsyncMock(return_value={
        "content": "",
        "tool_calls": None,
    })

    cancel = asyncio.Event()
    events = []
    async for event in _tool_loop(connector, [{"role": "user", "content": "hi"}], "sys", "/tmp", cancel):
        events.append(event)
    assert len(events) == 0


# ---- Claude tool loop ----

@pytest.mark.asyncio
async def test_claude_tool_loop_text_only():
    connector = MagicMock(spec=ClaudeSdkConnector)
    connector.chat_with_tools = AsyncMock(return_value={
        "content": "Text response",
        "tool_calls": None,
    })

    cancel = asyncio.Event()
    events = []
    async for event in _claude_tool_loop(connector, [{"role": "user", "content": "hi"}], "sys", "/tmp", cancel):
        events.append(event)

    assert any(e["event"] == "token" for e in events)


@pytest.mark.asyncio
async def test_claude_tool_loop_with_tool(tmp_path):
    (tmp_path / "test.py").write_text("content")

    call_count = 0
    async def mock_chat(msgs, tools, system=None):
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            return {
                "content": "Reading",
                "tool_calls": [{"id": "t1", "function": {"name": "read_file", "arguments": {"path": "test.py"}}}],
            }
        return {"content": "Done", "tool_calls": None}

    connector = MagicMock(spec=ClaudeSdkConnector)
    connector.chat_with_tools = mock_chat

    cancel = asyncio.Event()
    events = []
    async for event in _claude_tool_loop(connector, [{"role": "user", "content": "read"}], "sys", str(tmp_path), cancel):
        events.append(event)

    tool_events = [e for e in events if e.get("event") == "tool_use"]
    assert len(tool_events) >= 1


@pytest.mark.asyncio
async def test_claude_tool_loop_cancelled():
    connector = MagicMock(spec=ClaudeSdkConnector)
    cancel = asyncio.Event()
    cancel.set()

    events = []
    async for event in _claude_tool_loop(connector, [], "sys", "/tmp", cancel):
        events.append(event)
    assert len(events) == 0


# ---- Constants and models ----

def test_local_system_prompt():
    assert "Kitsune" in LOCAL_SYSTEM


def test_chat_request_defaults():
    req = ChatRequest(message="hello")
    assert req.mode == "auto"
    assert req.conversation_id is None
    assert req.project_id is None
    assert req.model is None


def test_chat_request_retry():
    req = ChatRequest(message="hello", retry_message_id="msg-1", retry_with="cloud")
    assert req.retry_message_id == "msg-1"
    assert req.retry_with == "cloud"


def test_cache_ttl_constants():
    assert MODEL_CACHE_TTL > 0
    assert CLAUDE_CACHE_TTL > 0


def test_tool_system_suffix():
    assert "MUST use the tools" in TOOL_SYSTEM_SUFFIX


def test_max_tool_rounds():
    assert MAX_TOOL_ROUNDS >= 5


# ---- Transfer helpers ----

def test_is_claude_export_single():
    data = {"uuid": "abc", "chat_messages": []}
    assert _is_claude_export(data) is True


def test_is_claude_export_list():
    data = [{"uuid": "abc", "chat_messages": []}]
    assert _is_claude_export(data) is True


def test_is_claude_export_not():
    data = {"format": "kitsune", "conversations": []}
    assert _is_claude_export(data) is False


def test_is_claude_export_empty_list():
    assert _is_claude_export([]) is False
