import os
import pytest
from unittest.mock import patch, MagicMock, AsyncMock

from core.connectors.claude_sdk import ClaudeSdkConnector, _get_api_key
from core.connectors.base import Chunk, Prompt, Status, Usage


def test_get_api_key_from_env():
    with patch.dict(os.environ, {"ANTHROPIC_API_KEY": "sk-test-key"}):
        key = _get_api_key()
        assert key == "sk-test-key"


def test_get_api_key_empty_env():
    with patch.dict(os.environ, {"ANTHROPIC_API_KEY": ""}, clear=False):
        key = _get_api_key()
        assert isinstance(key, str)


def test_available_no_key():
    with patch("core.connectors.claude_sdk._get_api_key", return_value=""):
        connector = ClaudeSdkConnector()
        assert connector.available() == Status.UNAVAILABLE


def test_available_with_key():
    with patch("core.connectors.claude_sdk._get_api_key", return_value="sk-test"):
        connector = ClaudeSdkConnector()
        assert connector.available() == Status.READY


def test_model_custom():
    with patch("core.connectors.claude_sdk._get_api_key", return_value="sk-test"):
        connector = ClaudeSdkConnector(model="claude-opus-4-6-20250514")
        assert connector.model == "claude-opus-4-6-20250514"


def test_class_attributes():
    connector = ClaudeSdkConnector()
    assert connector.id == "claude"
    assert connector.max_context_tokens == 200_000
    assert connector.last_usage is None


def test_get_api_key_from_settings():
    with patch.dict(os.environ, {"ANTHROPIC_API_KEY": ""}, clear=False):
        with patch("core.settings.get", return_value="sk-from-settings"):
            key = _get_api_key()
            assert key == "sk-from-settings"


def test_default_model():
    connector = ClaudeSdkConnector()
    assert "claude" in connector.model


def test_get_client():
    with patch("core.connectors.claude_sdk._get_api_key", return_value="sk-test"):
        connector = ClaudeSdkConnector()
        client = connector._get_client()
        assert client is not None
        assert connector._client is client
        client2 = connector._get_client()
        assert client2 is client


@pytest.mark.asyncio
async def test_stream_with_messages():
    mock_stream_ctx = AsyncMock()

    async def text_iter():
        yield "Hello "
        yield "World"

    mock_stream_ctx.text_stream = text_iter()
    mock_response = MagicMock()
    mock_response.usage.input_tokens = 100
    mock_response.usage.output_tokens = 50
    mock_stream_ctx.get_final_message = AsyncMock(return_value=mock_response)

    mock_stream_cm = MagicMock()
    mock_stream_cm.__aenter__ = AsyncMock(return_value=mock_stream_ctx)
    mock_stream_cm.__aexit__ = AsyncMock(return_value=False)

    mock_client = MagicMock()
    mock_client.messages.stream = MagicMock(return_value=mock_stream_cm)

    with patch("core.connectors.claude_sdk._get_api_key", return_value="sk-test"):
        connector = ClaudeSdkConnector()
        connector._client = mock_client

        chunks = []
        async for chunk in connector.stream(Prompt(
            text="test",
            system="sys",
            messages=[{"role": "user", "content": "hi"}],
        )):
            chunks.append(chunk)

        assert any(c.text == "Hello " for c in chunks)
        assert any(c.done for c in chunks)
        assert connector.last_usage.tokens_in == 100


@pytest.mark.asyncio
async def test_stream_text_only():
    mock_stream_ctx = AsyncMock()

    async def text_iter():
        yield "Answer"

    mock_stream_ctx.text_stream = text_iter()
    mock_response = MagicMock()
    mock_response.usage.input_tokens = 10
    mock_response.usage.output_tokens = 5
    mock_stream_ctx.get_final_message = AsyncMock(return_value=mock_response)

    mock_stream_cm = MagicMock()
    mock_stream_cm.__aenter__ = AsyncMock(return_value=mock_stream_ctx)
    mock_stream_cm.__aexit__ = AsyncMock(return_value=False)

    mock_client = MagicMock()
    mock_client.messages.stream = MagicMock(return_value=mock_stream_cm)

    with patch("core.connectors.claude_sdk._get_api_key", return_value="sk-test"):
        connector = ClaudeSdkConnector()
        connector._client = mock_client

        chunks = []
        async for chunk in connector.stream(Prompt(text="q")):
            chunks.append(chunk)
        assert any(c.text == "Answer" for c in chunks)


@pytest.mark.asyncio
async def test_chat_with_tools():
    text_block = MagicMock()
    text_block.type = "text"
    text_block.text = "Let me help"

    tool_block = MagicMock()
    tool_block.type = "tool_use"
    tool_block.id = "tool_1"
    tool_block.name = "read_file"
    tool_block.input = {"path": "test.py"}

    mock_response = MagicMock()
    mock_response.content = [text_block, tool_block]
    mock_response.stop_reason = "tool_use"
    mock_response.usage.input_tokens = 200
    mock_response.usage.output_tokens = 100

    mock_client = AsyncMock()
    mock_client.messages.create = AsyncMock(return_value=mock_response)

    with patch("core.connectors.claude_sdk._get_api_key", return_value="sk-test"):
        connector = ClaudeSdkConnector()
        connector._client = mock_client

        tools = [{"type": "function", "function": {"name": "read_file", "parameters": {}}}]
        result = await connector.chat_with_tools(
            [{"role": "user", "content": "read test.py"}],
            tools,
            system="system prompt",
        )
        assert result["content"] == "Let me help"
        assert len(result["tool_calls"]) == 1
        assert result["tool_calls"][0]["function"]["name"] == "read_file"
        assert connector.last_usage.tokens_in == 200


@pytest.mark.asyncio
async def test_chat_with_tools_no_tools():
    text_block = MagicMock()
    text_block.type = "text"
    text_block.text = "Just text"

    mock_response = MagicMock()
    mock_response.content = [text_block]
    mock_response.stop_reason = "end_turn"
    mock_response.usage.input_tokens = 50
    mock_response.usage.output_tokens = 20

    mock_client = AsyncMock()
    mock_client.messages.create = AsyncMock(return_value=mock_response)

    with patch("core.connectors.claude_sdk._get_api_key", return_value="sk-test"):
        connector = ClaudeSdkConnector()
        connector._client = mock_client

        result = await connector.chat_with_tools(
            [{"role": "user", "content": "hello"}],
            [],
        )
        assert result["content"] == "Just text"
        assert result["tool_calls"] is None


@pytest.mark.asyncio
async def test_stream_after_tools():
    mock_stream_ctx = AsyncMock()

    async def text_iter():
        yield "Final "
        yield "answer"

    mock_stream_ctx.text_stream = text_iter()
    mock_response = MagicMock()
    mock_response.usage.input_tokens = 300
    mock_response.usage.output_tokens = 60
    mock_stream_ctx.get_final_message = AsyncMock(return_value=mock_response)

    mock_stream_cm = MagicMock()
    mock_stream_cm.__aenter__ = AsyncMock(return_value=mock_stream_ctx)
    mock_stream_cm.__aexit__ = AsyncMock(return_value=False)

    mock_client = MagicMock()
    mock_client.messages.stream = MagicMock(return_value=mock_stream_cm)

    with patch("core.connectors.claude_sdk._get_api_key", return_value="sk-test"):
        connector = ClaudeSdkConnector()
        connector._client = mock_client

        chunks = []
        async for chunk in connector.stream_after_tools(
            [{"role": "user", "content": "continue"}],
            system="sys prompt",
        ):
            chunks.append(chunk)
        assert any(c.text == "Final " for c in chunks)
        assert any(c.done for c in chunks)
        assert connector.last_usage.tokens_in == 300
