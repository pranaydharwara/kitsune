import json
import pytest
import httpx
from unittest.mock import AsyncMock, MagicMock, patch

from core.connectors.ollama import parse_text_tool_calls, OllamaConnector
from core.connectors.base import Chunk, Prompt, Status, Usage


def test_parse_text_tool_calls_basic():
    text = '<tool_call>{"name": "read_file", "arguments": {"path": "test.py"}}</tool_call>'
    calls = parse_text_tool_calls(text)
    assert calls is not None
    assert len(calls) >= 1
    assert calls[0]["function"]["name"] == "read_file"


def test_parse_text_tool_calls_none():
    calls = parse_text_tool_calls("No tool calls here")
    assert calls is None or len(calls) == 0


def test_parse_text_tool_calls_multiple():
    text = (
        '<tool_call>{"name": "read_file", "arguments": {"path": "a.py"}}</tool_call>'
        'Some text in between'
        '<tool_call>{"name": "list_files", "arguments": {"path": "."}}</tool_call>'
    )
    calls = parse_text_tool_calls(text)
    assert calls is not None
    assert len(calls) == 2


def test_parse_text_tool_calls_malformed():
    text = '<tool_call>not valid json</tool_call>'
    calls = parse_text_tool_calls(text)
    assert calls is None or len(calls) == 0


def test_ollama_connector_available():
    mock_http = MagicMock()
    connector = OllamaConnector(http=mock_http)
    status = connector.available()
    assert isinstance(status, Status)


@pytest.mark.asyncio
async def test_ollama_connector_is_available():
    mock_response = MagicMock()
    mock_response.json.return_value = {
        "models": [{"name": "qwen3:8b"}, {"name": "llama3:8b"}]
    }
    mock_http = AsyncMock()
    mock_http.get.return_value = mock_response
    connector = OllamaConnector(model="qwen3:8b", http=mock_http)
    result = await connector.is_available()
    assert isinstance(result, bool)


@pytest.mark.asyncio
async def test_ollama_chat_with_tools():
    mock_response = MagicMock()
    mock_response.json.return_value = {
        "message": {
            "content": "I'll read the file.",
            "tool_calls": [
                {"function": {"name": "read_file", "arguments": {"path": "test.py"}}}
            ],
        },
        "done": True,
    }
    mock_response.raise_for_status = MagicMock()
    mock_http = AsyncMock()
    mock_http.post.return_value = mock_response
    connector = OllamaConnector(model="qwen3:8b", http=mock_http)
    tools = [{"type": "function", "function": {"name": "read_file", "parameters": {}}}]
    result = await connector.chat_with_tools(
        [{"role": "user", "content": "read test.py"}],
        tools,
    )
    assert "content" in result or "tool_calls" in result


def test_ollama_connector_defaults():
    connector = OllamaConnector()
    assert connector.id == "ollama"
    assert connector.max_context_tokens == 32_000


def test_ollama_connector_custom_model():
    connector = OllamaConnector(model="llama3:70b", base_url="http://localhost:12345")
    assert connector.model == "llama3:70b"
    assert connector.base_url == "http://localhost:12345"


def test_ollama_usage_valid():
    connector = OllamaConnector()
    event = {"prompt_eval_count": 100, "eval_count": 50}
    usage = connector.usage(event)
    assert usage is not None
    assert usage.tokens_in == 100
    assert usage.tokens_out == 50


def test_ollama_usage_empty():
    connector = OllamaConnector()
    assert connector.usage({}) is None


def test_ollama_usage_none():
    connector = OllamaConnector()
    assert connector.usage(None) is None


def test_parse_text_tool_calls_arguments_as_string():
    text = '<tool_call>{"name": "read_file", "arguments": "{\\"path\\": \\"test.py\\"}"}</tool_call>'
    calls = parse_text_tool_calls(text)
    assert calls is not None
    assert calls[0]["function"]["arguments"]["path"] == "test.py"


def test_parse_text_tool_calls_no_name():
    text = '<tool_call>{"arguments": {"path": "test.py"}}</tool_call>'
    calls = parse_text_tool_calls(text)
    assert calls is None


@pytest.mark.asyncio
async def test_ollama_is_available_failure():
    mock_http = AsyncMock()
    mock_http.get.side_effect = Exception("Connection refused")
    connector = OllamaConnector(http=mock_http)
    result = await connector.is_available()
    assert result is False


@pytest.mark.asyncio
async def test_ollama_chat_with_text_tool_calls():
    tool_text = '<tool_call>{"name": "read_file", "arguments": {"path": "x.py"}}</tool_call>'
    mock_response = MagicMock()
    mock_response.json.return_value = {
        "message": {"content": tool_text, "tool_calls": None},
        "done": True,
    }
    mock_response.raise_for_status = MagicMock()
    mock_http = AsyncMock()
    mock_http.post.return_value = mock_response
    connector = OllamaConnector(model="qwen3:8b", http=mock_http)
    result = await connector.chat_with_tools(
        [{"role": "user", "content": "read x.py"}],
        [{"type": "function", "function": {"name": "read_file", "parameters": {}}}],
    )
    assert result.get("tool_calls") is not None


def test_ollama_available_success():
    with patch("core.connectors.ollama.httpx.get") as mock_get:
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {"models": [{"name": "qwen3:8b"}]}
        mock_get.return_value = mock_resp
        connector = OllamaConnector(model="qwen3:8b")
        assert connector.available() == Status.READY


def test_ollama_available_no_model():
    with patch("core.connectors.ollama.httpx.get") as mock_get:
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {"models": [{"name": "llama3:8b"}]}
        mock_get.return_value = mock_resp
        connector = OllamaConnector(model="nonexistent")
        assert connector.available() == Status.UNAVAILABLE


def test_ollama_available_connection_error():
    with patch("core.connectors.ollama.httpx.get", side_effect=httpx.ConnectError("Connection refused")):
        connector = OllamaConnector()
        assert connector.available() == Status.UNAVAILABLE


@pytest.mark.asyncio
async def test_ollama_stream_with_messages():
    async def mock_aiter_lines():
        yield json.dumps({"message": {"content": "Hello"}, "done": False})
        yield json.dumps({"message": {"content": " world"}, "done": False})
        yield json.dumps({"message": {"content": ""}, "done": True})

    mock_resp = MagicMock()
    mock_resp.raise_for_status = MagicMock()
    mock_resp.aiter_lines = mock_aiter_lines
    mock_resp.__aenter__ = AsyncMock(return_value=mock_resp)
    mock_resp.__aexit__ = AsyncMock(return_value=False)

    mock_http = MagicMock()
    mock_http.stream = MagicMock(return_value=mock_resp)

    connector = OllamaConnector(model="qwen3:8b", http=mock_http)
    chunks = []
    async for chunk in connector.stream(Prompt(
        text="test",
        system="sys",
        messages=[{"role": "user", "content": "hi"}],
    )):
        chunks.append(chunk)
    assert any(c.text == "Hello" for c in chunks)
    assert any(c.done for c in chunks)


@pytest.mark.asyncio
async def test_ollama_stream_text_only():
    async def mock_aiter_lines():
        yield json.dumps({"message": {"content": "Answer"}, "done": False})
        yield ""
        yield json.dumps({"message": {"content": ""}, "done": True})

    mock_resp = MagicMock()
    mock_resp.raise_for_status = MagicMock()
    mock_resp.aiter_lines = mock_aiter_lines
    mock_resp.__aenter__ = AsyncMock(return_value=mock_resp)
    mock_resp.__aexit__ = AsyncMock(return_value=False)

    mock_http = MagicMock()
    mock_http.stream = MagicMock(return_value=mock_resp)

    connector = OllamaConnector(model="qwen3:8b", http=mock_http)
    chunks = []
    async for chunk in connector.stream(Prompt(text="q", system="s")):
        chunks.append(chunk)
    assert any(c.text == "Answer" for c in chunks)


@pytest.mark.asyncio
async def test_ollama_stream_owns_client():
    async def mock_aiter_lines():
        yield json.dumps({"message": {"content": "ok"}, "done": True})

    mock_resp = MagicMock()
    mock_resp.raise_for_status = MagicMock()
    mock_resp.aiter_lines = mock_aiter_lines
    mock_resp.__aenter__ = AsyncMock(return_value=mock_resp)
    mock_resp.__aexit__ = AsyncMock(return_value=False)

    mock_client = MagicMock()
    mock_client.stream = MagicMock(return_value=mock_resp)
    mock_client.aclose = AsyncMock()

    with patch("httpx.AsyncClient", return_value=mock_client):
        connector = OllamaConnector(model="qwen3:8b")
        chunks = []
        async for chunk in connector.stream(Prompt(text="q")):
            chunks.append(chunk)
        mock_client.aclose.assert_called_once()


@pytest.mark.asyncio
async def test_ollama_stream_after_tools():
    async def mock_aiter_lines():
        yield json.dumps({"message": {"content": "Result"}, "done": False})
        yield json.dumps({"message": {"content": ""}, "done": True})

    mock_resp = MagicMock()
    mock_resp.raise_for_status = MagicMock()
    mock_resp.aiter_lines = mock_aiter_lines
    mock_resp.__aenter__ = AsyncMock(return_value=mock_resp)
    mock_resp.__aexit__ = AsyncMock(return_value=False)

    mock_http = MagicMock()
    mock_http.stream = MagicMock(return_value=mock_resp)

    connector = OllamaConnector(model="qwen3:8b", http=mock_http)
    chunks = []
    async for chunk in connector.stream_after_tools(
        [{"role": "user", "content": "done"}]
    ):
        chunks.append(chunk)
    assert any(c.text == "Result" for c in chunks)


@pytest.mark.asyncio
async def test_ollama_stream_after_tools_owns_client():
    async def mock_aiter_lines():
        yield json.dumps({"message": {"content": ""}, "done": True})

    mock_resp = MagicMock()
    mock_resp.raise_for_status = MagicMock()
    mock_resp.aiter_lines = mock_aiter_lines
    mock_resp.__aenter__ = AsyncMock(return_value=mock_resp)
    mock_resp.__aexit__ = AsyncMock(return_value=False)

    mock_client = MagicMock()
    mock_client.stream = MagicMock(return_value=mock_resp)
    mock_client.aclose = AsyncMock()

    with patch("httpx.AsyncClient", return_value=mock_client):
        connector = OllamaConnector(model="q")
        async for _ in connector.stream_after_tools([]):
            pass
        mock_client.aclose.assert_called_once()


@pytest.mark.asyncio
async def test_ollama_pull_model():
    async def mock_aiter_lines():
        yield json.dumps({"status": "downloading", "total": 1000, "completed": 500})
        yield json.dumps({"status": "success"})

    mock_resp = MagicMock()
    mock_resp.raise_for_status = MagicMock()
    mock_resp.aiter_lines = mock_aiter_lines
    mock_resp.__aenter__ = AsyncMock(return_value=mock_resp)
    mock_resp.__aexit__ = AsyncMock(return_value=False)

    mock_http = MagicMock()
    mock_http.stream = MagicMock(return_value=mock_resp)

    connector = OllamaConnector(model="qwen3:8b", http=mock_http)
    events = []
    async for ev in connector.pull_model():
        events.append(ev)
    assert len(events) == 2
    assert events[0]["total"] == 1000


@pytest.mark.asyncio
async def test_ollama_pull_model_owns_client():
    async def mock_aiter_lines():
        yield json.dumps({"status": "success"})

    mock_resp = MagicMock()
    mock_resp.raise_for_status = MagicMock()
    mock_resp.aiter_lines = mock_aiter_lines
    mock_resp.__aenter__ = AsyncMock(return_value=mock_resp)
    mock_resp.__aexit__ = AsyncMock(return_value=False)

    mock_client = MagicMock()
    mock_client.stream = MagicMock(return_value=mock_resp)
    mock_client.aclose = AsyncMock()

    with patch("httpx.AsyncClient", return_value=mock_client):
        connector = OllamaConnector(model="q")
        async for _ in connector.pull_model():
            pass
        mock_client.aclose.assert_called_once()


@pytest.mark.asyncio
async def test_ollama_chat_with_tools_owns_client():
    mock_response = MagicMock()
    mock_response.json.return_value = {
        "message": {"content": "ok", "tool_calls": None},
        "done": True,
    }
    mock_response.raise_for_status = MagicMock()

    mock_client = AsyncMock()
    mock_client.post.return_value = mock_response

    with patch("httpx.AsyncClient", return_value=mock_client):
        connector = OllamaConnector(model="q")
        result = await connector.chat_with_tools(
            [{"role": "user", "content": "hi"}], [],
        )
        mock_client.aclose.assert_called_once()
        assert result["content"] == "ok"


@pytest.mark.asyncio
async def test_ollama_is_available_owns_client():
    mock_response = MagicMock()
    mock_response.json.return_value = {"models": [{"name": "q:latest"}]}

    mock_client = AsyncMock()
    mock_client.get.return_value = mock_response

    with patch("httpx.AsyncClient", return_value=mock_client):
        connector = OllamaConnector(model="q")
        result = await connector.is_available()
        assert result is True
        mock_client.aclose.assert_called_once()


def test_ollama_usage_missing_keys():
    connector = OllamaConnector()
    usage = connector.usage({"prompt_eval_count": 100})
    assert usage is not None
    assert usage.tokens_in == 100
    assert usage.tokens_out is None
