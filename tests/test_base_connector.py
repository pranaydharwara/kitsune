from core.connectors.base import Status, Chunk, Usage, Prompt


def test_status_values():
    assert Status.READY.value == "ready"
    assert Status.UNAVAILABLE.value == "unavailable"
    assert Status.RATE_LIMITED.value == "rate_limited"


def test_chunk_creation():
    c = Chunk(text="hello", done=False)
    assert c.text == "hello"
    assert c.done is False


def test_chunk_done():
    c = Chunk(text="end", done=True)
    assert c.done is True


def test_usage_creation():
    u = Usage(tokens_in=100, tokens_out=50)
    assert u.tokens_in == 100
    assert u.tokens_out == 50


def test_prompt_creation():
    p = Prompt(text="Hello")
    assert p.text == "Hello"
    assert p.system is None
    assert p.messages is None


def test_prompt_with_all_fields():
    msgs = [{"role": "user", "content": "hi"}]
    p = Prompt(text="Hello", system="Be helpful", messages=msgs)
    assert p.system == "Be helpful"
    assert p.messages == msgs
