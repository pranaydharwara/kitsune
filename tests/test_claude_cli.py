import asyncio
import json
import pytest
from unittest.mock import patch, AsyncMock, MagicMock

from core.connectors.claude_cli import ClaudeCliConnector, _find_claude
from core.connectors.base import Chunk, Prompt, Status, Usage


def test_find_claude_in_path():
    with patch("shutil.which", return_value="/usr/local/bin/claude"):
        result = _find_claude()
        assert result is not None


def test_available_no_claude():
    with patch("core.connectors.claude_cli._find_claude", return_value=None):
        connector = ClaudeCliConnector()
        assert connector.available() == Status.UNAVAILABLE


def test_available_with_claude():
    with patch("core.connectors.claude_cli._find_claude", return_value="/usr/local/bin/claude"):
        connector = ClaudeCliConnector()
        assert connector.available() == Status.READY


def test_model_default():
    with patch("core.connectors.claude_cli._find_claude", return_value="/usr/local/bin/claude"):
        connector = ClaudeCliConnector()
        assert connector.model == "sonnet"


def test_model_custom():
    with patch("core.connectors.claude_cli._find_claude", return_value="/usr/local/bin/claude"):
        connector = ClaudeCliConnector(model="opus")
        assert connector.model == "opus"


def test_class_attributes():
    with patch("core.connectors.claude_cli._find_claude", return_value="/usr/local/bin/claude"):
        connector = ClaudeCliConnector()
        assert connector.id == "claude"
        assert connector.max_context_tokens == 200_000
        assert connector.last_usage is None


def test_find_claude_not_found():
    with patch("shutil.which", return_value=None):
        with patch("os.path.isfile", return_value=False):
            with patch("os.access", return_value=False):
                _find_claude()


def test_find_claude_in_extra_path():
    with patch("shutil.which", return_value=None):
        with patch("os.path.isfile", return_value=True):
            with patch("os.access", return_value=True):
                result = _find_claude()
                assert result is not None


def test_extra_paths_exist():
    from core.connectors.claude_cli import _EXTRA_PATHS
    assert isinstance(_EXTRA_PATHS, list)
    assert len(_EXTRA_PATHS) >= 3


@pytest.mark.asyncio
async def test_stream_no_bin():
    with patch("core.connectors.claude_cli._find_claude", return_value=None):
        connector = ClaudeCliConnector()
        with pytest.raises(RuntimeError, match="claude CLI not found"):
            async for _ in connector.stream(Prompt(text="hi")):
                pass


@pytest.mark.asyncio
async def test_stream_text_content():
    mock_proc = AsyncMock()
    mock_proc.returncode = None
    mock_proc.terminate = MagicMock()
    mock_proc.wait = AsyncMock()

    lines = [
        json.dumps({"type": "content_block_delta", "delta": {"type": "text_delta", "text": "Hello"}}).encode() + b"\n",
        json.dumps({"type": "result", "is_error": False, "usage": {"input_tokens": 10, "output_tokens": 5}}).encode() + b"\n",
    ]

    async def mock_iter():
        for line in lines:
            yield line

    mock_proc.stdout = mock_iter()

    with patch("core.connectors.claude_cli._find_claude", return_value="/usr/local/bin/claude"):
        connector = ClaudeCliConnector()
        with patch("asyncio.create_subprocess_exec", return_value=mock_proc):
            chunks = []
            async for chunk in connector.stream(Prompt(text="hi", system="sys")):
                chunks.append(chunk)
            assert any(c.text == "Hello" for c in chunks)
            assert any(c.done for c in chunks)
            assert connector.last_usage is not None
            assert connector.last_usage.tokens_in == 10


@pytest.mark.asyncio
async def test_stream_assistant_message():
    mock_proc = AsyncMock()
    mock_proc.returncode = None
    mock_proc.terminate = MagicMock()
    mock_proc.wait = AsyncMock()

    lines = [
        json.dumps({
            "type": "assistant",
            "message": {"content": [{"type": "text", "text": "World"}]},
        }).encode() + b"\n",
        json.dumps({"type": "result", "is_error": False, "usage": {}}).encode() + b"\n",
    ]

    async def mock_iter():
        for line in lines:
            yield line

    mock_proc.stdout = mock_iter()

    with patch("core.connectors.claude_cli._find_claude", return_value="/usr/bin/claude"):
        connector = ClaudeCliConnector()
        with patch("asyncio.create_subprocess_exec", return_value=mock_proc):
            chunks = []
            async for chunk in connector.stream(Prompt(text="test")):
                chunks.append(chunk)
            assert any(c.text == "World" for c in chunks)


@pytest.mark.asyncio
async def test_stream_auth_error():
    mock_proc = AsyncMock()
    mock_proc.returncode = None
    mock_proc.terminate = MagicMock()
    mock_proc.wait = AsyncMock()

    lines = [
        json.dumps({
            "type": "assistant",
            "error": "authentication_failed",
            "message": {"content": [{"type": "text", "text": "Auth required"}]},
        }).encode() + b"\n",
    ]

    async def mock_iter():
        for line in lines:
            yield line

    mock_proc.stdout = mock_iter()

    with patch("core.connectors.claude_cli._find_claude", return_value="/usr/bin/claude"):
        connector = ClaudeCliConnector()
        with patch("asyncio.create_subprocess_exec", return_value=mock_proc):
            with pytest.raises(RuntimeError, match="Claude auth failed"):
                async for _ in connector.stream(Prompt(text="test")):
                    pass


@pytest.mark.asyncio
async def test_stream_result_error():
    mock_proc = AsyncMock()
    mock_proc.returncode = None
    mock_proc.terminate = MagicMock()
    mock_proc.wait = AsyncMock()

    lines = [
        json.dumps({"type": "result", "is_error": True, "result": "Something broke"}).encode() + b"\n",
    ]

    async def mock_iter():
        for line in lines:
            yield line

    mock_proc.stdout = mock_iter()

    with patch("core.connectors.claude_cli._find_claude", return_value="/usr/bin/claude"):
        connector = ClaudeCliConnector()
        with patch("asyncio.create_subprocess_exec", return_value=mock_proc):
            with pytest.raises(RuntimeError, match="Something broke"):
                async for _ in connector.stream(Prompt(text="test")):
                    pass


@pytest.mark.asyncio
async def test_stream_skips_empty_and_invalid():
    mock_proc = AsyncMock()
    mock_proc.returncode = None
    mock_proc.terminate = MagicMock()
    mock_proc.wait = AsyncMock()

    lines = [
        b"\n",
        b"not json\n",
        json.dumps({"type": "unknown_type"}).encode() + b"\n",
        json.dumps({"type": "content_block_delta", "delta": {"type": "text_delta", "text": "ok"}}).encode() + b"\n",
        json.dumps({"type": "result", "is_error": False, "usage": {}}).encode() + b"\n",
    ]

    async def mock_iter():
        for line in lines:
            yield line

    mock_proc.stdout = mock_iter()

    with patch("core.connectors.claude_cli._find_claude", return_value="/usr/bin/claude"):
        connector = ClaudeCliConnector()
        with patch("asyncio.create_subprocess_exec", return_value=mock_proc):
            chunks = []
            async for chunk in connector.stream(Prompt(text="test")):
                chunks.append(chunk)
            texts = [c.text for c in chunks if c.text]
            assert "ok" in texts


@pytest.mark.asyncio
async def test_stream_terminates_process():
    mock_proc = AsyncMock()
    mock_proc.returncode = None
    mock_proc.terminate = MagicMock()
    mock_proc.wait = AsyncMock()

    async def mock_iter():
        yield json.dumps({"type": "result", "is_error": False, "usage": {}}).encode() + b"\n"

    mock_proc.stdout = mock_iter()

    with patch("core.connectors.claude_cli._find_claude", return_value="/usr/bin/claude"):
        connector = ClaudeCliConnector()
        with patch("asyncio.create_subprocess_exec", return_value=mock_proc):
            async for _ in connector.stream(Prompt(text="test")):
                pass
            mock_proc.terminate.assert_called_once()
