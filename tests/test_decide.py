import pytest
from unittest.mock import AsyncMock, patch

from core.router.decide import decide, ESCALATION_THRESHOLD


def test_escalation_threshold():
    assert ESCALATION_THRESHOLD == 4


@pytest.mark.asyncio
async def test_decide_new_conversation():
    result = await decide("hello", [], {}, claude_ready=False)
    assert "target" in result
    assert "reason" in result
    assert result["target"] == "local"


@pytest.mark.asyncio
async def test_decide_no_claude():
    history = [{"role": "user", "text": "complex refactoring"}] * 5
    result = await decide("test", history, {}, claude_ready=False)
    assert result["target"] == "local"


@pytest.mark.asyncio
async def test_decide_already_escalated():
    result = await decide(
        "continue",
        [{"role": "user", "text": "x"}],
        {"escalated": True},
        claude_ready=True,
    )
    assert result["target"] == "cloud"


@pytest.mark.asyncio
async def test_decide_secrets_always_local():
    result = await decide(
        "password=hunter2", [], {}, claude_ready=True
    )
    assert result["target"] == "local"
    assert "secrets" in result["reason"].lower() or "secrets" in result["heuristic_flags"]


@pytest.mark.asyncio
async def test_decide_simple_text_local():
    result = await decide("hi", [], {}, claude_ready=True)
    assert result["target"] == "local"
    assert result["heuristic_score"] == 0


@pytest.mark.asyncio
async def test_decide_complex_with_classifier_cloud():
    with patch("core.router.decide.classify", new_callable=AsyncMock) as mock_classify:
        mock_classify.return_value = {"complexity": 5, "domain": "engineering"}
        with patch("core.router.decide.heuristic_score", return_value=(3, "code blocks")):
            result = await decide(
                "Please review this PR and do a security audit",
                [], {}, claude_ready=True,
            )
            assert result["target"] == "cloud"
            assert result["complexity"] == 5


@pytest.mark.asyncio
async def test_decide_classifier_low_complexity():
    with patch("core.router.decide.classify", new_callable=AsyncMock) as mock_classify:
        mock_classify.return_value = {"complexity": 2, "domain": "general"}
        with patch("core.router.decide.heuristic_score", return_value=(1, "medium length")):
            result = await decide("explain this", [], {}, claude_ready=True)
            assert result["target"] == "local"
            assert result["complexity"] == 2


@pytest.mark.asyncio
async def test_decide_classifier_fails_high_heuristic():
    with patch("core.router.decide.classify", new_callable=AsyncMock) as mock_classify:
        mock_classify.return_value = None
        with patch("core.router.decide.heuristic_score", return_value=(4, "code blocks, long message")):
            result = await decide("complex", [], {}, claude_ready=True)
            assert result["target"] == "cloud"


@pytest.mark.asyncio
async def test_decide_classifier_fails_low_heuristic():
    with patch("core.router.decide.classify", new_callable=AsyncMock) as mock_classify:
        mock_classify.return_value = None
        with patch("core.router.decide.heuristic_score", return_value=(2, "medium length")):
            result = await decide("something", [], {}, claude_ready=True)
            assert result["target"] == "local"


def test_result_keys():
    from core.router.decide import _result
    r = _result("local", reason="test")
    assert set(r.keys()) == {
        "target", "model_hint", "reason", "complexity",
        "domain", "heuristic_score", "heuristic_flags", "classifier_json"
    }
