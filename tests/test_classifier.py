import json
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from core.router.classifier import classify


@pytest.mark.asyncio
async def test_classify_returns_dict():
    mock_response = MagicMock()
    mock_response.json.return_value = {
        "response": json.dumps({"complexity": 2, "domain": "general"})
    }
    mock_response.raise_for_status = MagicMock()

    mock_client = AsyncMock()
    mock_client.post.return_value = mock_response

    with patch("core.router.classifier.httpx.AsyncClient") as MockClient:
        MockClient.return_value.__aenter__ = AsyncMock(return_value=mock_client)
        MockClient.return_value.__aexit__ = AsyncMock(return_value=None)

        result = await classify("What is Python?")
        assert isinstance(result, dict)
        assert result["complexity"] == 2
        assert result["domain"] == "general"


@pytest.mark.asyncio
async def test_classify_error_returns_none():
    mock_client = AsyncMock()
    mock_client.post.side_effect = Exception("Connection error")

    with patch("core.router.classifier.httpx.AsyncClient") as MockClient:
        MockClient.return_value.__aenter__ = AsyncMock(return_value=mock_client)
        MockClient.return_value.__aexit__ = AsyncMock(return_value=None)

        result = await classify("test")
        assert result is None
