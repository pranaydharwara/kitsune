from core.router.heuristics import has_secrets, heuristic_score


def test_has_secrets_with_password():
    assert has_secrets("password=hunter2")


def test_has_secrets_clean_text():
    assert not has_secrets("Just a normal message")


def test_heuristic_score_short_simple():
    score, reason = heuristic_score("Hello there")
    assert score == 0


def test_heuristic_score_long_text():
    text = "x" * 2500
    score, reason = heuristic_score(text)
    assert score >= 1


def test_heuristic_score_code_blocks():
    text = "Here:\n```python\nprint('hello')\n```\nAnd:\n```js\nconsole.log('hi')\n```"
    score, reason = heuristic_score(text)
    assert score >= 1


def test_heuristic_score_numbered_steps():
    text = "Steps:\n1. First\n2. Second\n3. Third\n4. Fourth"
    score, reason = heuristic_score(text)
    assert score >= 1


def test_heuristic_score_combined():
    text = "x" * 3000 + "\n```py\ncode\n```\n```js\ncode\n```\n1. A\n2. B\n3. C\n4. D\nPlease refactor"
    score, reason = heuristic_score(text)
    assert score >= 3
    assert reason != ""


def test_has_secrets_private_key():
    assert has_secrets("-----BEGIN RSA PRIVATE KEY-----\nMIIE...")


def test_has_secrets_ec_key():
    assert has_secrets("-----BEGIN EC PRIVATE KEY-----\nMHQ...")


def test_has_secrets_github_token():
    assert has_secrets("ghp_ABCDEFghijklmnopqrstuvwxyz1234567890")


def test_has_secrets_slack_token():
    assert has_secrets("xoxb-123-456-abcdef")


def test_has_secrets_aws_key():
    assert has_secrets("AKIAIOSFODNN7EXAMPLE")


def test_has_secrets_sk_key():
    assert has_secrets("sk-proj-abcdefghijklmnopqrstuvwxyz")


def test_has_secrets_safe_text():
    assert not has_secrets("Just discussing API design patterns")


def test_heuristic_score_strong_keyword():
    score, reason = heuristic_score("Please do a code review of this PR")
    assert score >= 3
    assert "code review" in reason


def test_heuristic_score_security_audit():
    score, reason = heuristic_score("security audit of the auth module")
    assert score >= 3


def test_heuristic_score_multiple_medium_keywords():
    score, reason = heuristic_score("Please analyze and compare these design patterns in detail")
    assert score >= 3
    assert "multiple" in reason


def test_heuristic_score_single_medium_keyword():
    score, reason = heuristic_score("Please explain this concept to me")
    assert score >= 2


def test_heuristic_score_multi_question():
    words = " ".join(["word"] * 50)
    text = f"{words}? What about this? And this? Also this?"
    score, reason = heuristic_score(text)
    assert score >= 1
    assert "multi-question" in reason


def test_heuristic_score_inline_code():
    text = "Check `foo` and `bar` and `baz` and `qux` and more"
    score, reason = heuristic_score(text)
    assert score >= 1
    assert "inline code" in reason


def test_heuristic_score_medium_length():
    text = "x" * 1000
    score, reason = heuristic_score(text)
    assert score >= 1
    assert "medium length" in reason


def test_heuristic_score_two_steps():
    text = "Steps:\n1. First\n2. Second"
    score, reason = heuristic_score(text)
    assert score >= 1
    assert "2 steps" in reason
