from core.context.assembler import _estimate_tokens, _compress_code_blocks, assemble, CHARS_PER_TOKEN


def test_chars_per_token_constant():
    assert CHARS_PER_TOKEN == 4


def test_estimate_tokens():
    assert _estimate_tokens("abcd") == 1
    assert _estimate_tokens("abcdefgh") == 2
    assert _estimate_tokens("") == 0


def test_compress_code_blocks_short():
    text = "Hello\n```python\nprint('hi')\n```\nDone"
    assert _compress_code_blocks(text) == text


def test_compress_code_blocks_long():
    code = "x = 1\n" * 200
    text = f"Before\n```python\n{code}\n```\nAfter"
    result = _compress_code_blocks(text)
    assert "[code block" in result or len(result) < len(text)


def test_assemble_basic():
    messages = [
        {"role": "user", "text": "Hello"},
        {"role": "assistant", "text": "Hi there!"},
        {"role": "user", "text": "How are you?"},
    ]
    system, prompt = assemble(messages)
    assert isinstance(system, str)
    assert isinstance(prompt, str)


def test_assemble_with_summary():
    messages = [{"role": "user", "text": f"Msg {i}"} for i in range(20)] + [
        {"role": "user", "text": "Latest question"},
    ]
    system, prompt = assemble(messages, summary="Previously we discussed Python.", budget_tokens=200)
    full = system + prompt
    assert "Previously" in full


def test_assemble_respects_budget():
    messages = [{"role": "user", "text": f"Message {i} " + "x" * 500} for i in range(50)]
    system, prompt = assemble(messages, budget_tokens=100)
    total_chars = len(system) + len(prompt)
    assert total_chars < 50 * 500


def test_assemble_empty_messages():
    system, prompt = assemble([])
    assert isinstance(system, str)
    assert isinstance(prompt, str)
