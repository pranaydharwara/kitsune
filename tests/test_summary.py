import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from core.context.summary import (
    should_summarise,
    generate_summary,
    maybe_update_summary,
    SUMMARY_INTERVAL,
    CHARS_PER_TOKEN,
    MAX_SUMMARY_CHARS,
    SUMMARY_PROMPT,
)


def test_constants():
    assert SUMMARY_INTERVAL == 6
    assert CHARS_PER_TOKEN == 4
    assert MAX_SUMMARY_CHARS == 800 * 4
    assert len(SUMMARY_PROMPT) > 0


def test_should_summarise_too_few():
    history = [
        {"role": "user", "text": "hi"},
        {"role": "assistant", "text": "hello"},
    ]
    assert not should_summarise(history, None)


def test_should_summarise_enough():
    history = []
    for i in range(12):
        role = "user" if i % 2 == 0 else "assistant"
        history.append({"role": role, "text": "x" * 6000})
    assert should_summarise(history, None)


def test_should_summarise_many_messages_short():
    history = []
    for i in range(14):
        role = "user" if i % 2 == 0 else "assistant"
        history.append({"role": role, "text": "short"})
    assert not should_summarise(history, None)


def test_should_summarise_few_messages_long():
    history = [
        {"role": "user", "text": "x" * 40000},
        {"role": "assistant", "text": "y" * 40000},
    ]
    assert not should_summarise(history, None)


def test_should_summarise_with_current_summary_not_at_interval():
    history = []
    for i in range(14):
        role = "user" if i % 2 == 0 else "assistant"
        history.append({"role": role, "text": "x" * 6000})
    assert not should_summarise(history, "existing summary")


def test_should_summarise_with_current_summary_at_interval():
    history = []
    for i in range(12):
        role = "user" if i % 2 == 0 else "assistant"
        history.append({"role": role, "text": "x" * 6000})
    assert should_summarise(history, "existing summary")


@pytest.mark.asyncio
async def test_generate_summary_success():
    with patch("core.context.summary.httpx.AsyncClient") as MockClient:
        mock_client = AsyncMock()
        mock_response = MagicMock()
        mock_response.json.return_value = {"response": "Summary of conversation"}
        mock_response.raise_for_status = MagicMock()
        mock_client.post.return_value = mock_response
        MockClient.return_value.__aenter__ = AsyncMock(return_value=mock_client)
        MockClient.return_value.__aexit__ = AsyncMock(return_value=None)

        messages = [
            {"role": "user", "text": "Hello"},
            {"role": "assistant", "text": "Hi"},
        ]
        result = await generate_summary(messages)
        assert result == "Summary of conversation"


@pytest.mark.asyncio
async def test_generate_summary_error():
    with patch("core.context.summary.httpx.AsyncClient") as MockClient:
        mock_client = AsyncMock()
        mock_client.post.side_effect = Exception("Connection refused")
        MockClient.return_value.__aenter__ = AsyncMock(return_value=mock_client)
        MockClient.return_value.__aexit__ = AsyncMock(return_value=None)

        result = await generate_summary([{"role": "user", "text": "test"}])
        assert result is None


@pytest.mark.asyncio
async def test_generate_summary_empty_response():
    with patch("core.context.summary.httpx.AsyncClient") as MockClient:
        mock_client = AsyncMock()
        mock_response = MagicMock()
        mock_response.json.return_value = {"response": ""}
        mock_response.raise_for_status = MagicMock()
        mock_client.post.return_value = mock_response
        MockClient.return_value.__aenter__ = AsyncMock(return_value=mock_client)
        MockClient.return_value.__aexit__ = AsyncMock(return_value=None)

        result = await generate_summary([{"role": "user", "text": "test"}])
        assert result is None


@pytest.mark.asyncio
async def test_generate_summary_truncates_long():
    long_summary = "x" * (MAX_SUMMARY_CHARS + 1000)
    with patch("core.context.summary.httpx.AsyncClient") as MockClient:
        mock_client = AsyncMock()
        mock_response = MagicMock()
        mock_response.json.return_value = {"response": long_summary}
        mock_response.raise_for_status = MagicMock()
        mock_client.post.return_value = mock_response
        MockClient.return_value.__aenter__ = AsyncMock(return_value=mock_client)
        MockClient.return_value.__aexit__ = AsyncMock(return_value=None)

        result = await generate_summary([{"role": "user", "text": "test"}])
        assert result is not None
        assert len(result) <= MAX_SUMMARY_CHARS


@pytest.mark.asyncio
async def test_maybe_update_summary_no_conv(db):
    await maybe_update_summary(db, "nonexistent-id", [])


@pytest.mark.asyncio
async def test_maybe_update_summary_not_needed(db):
    from core.store.conversations import create_conversation
    conv = await create_conversation(db, title="Test")
    messages = [{"role": "user", "text": "short"}]
    await maybe_update_summary(db, conv["id"], messages)
