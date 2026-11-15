from core.context.redact import redact


def test_redact_private_key():
    text = "-----BEGIN RSA PRIVATE KEY-----\nMIIE...\n-----END RSA PRIVATE KEY-----"
    assert "[redacted: private key]" in redact(text)


def test_redact_ec_private_key():
    text = "-----BEGIN EC PRIVATE KEY-----\ndata\n-----END EC PRIVATE KEY-----"
    assert "[redacted: private key]" in redact(text)


def test_redact_github_token():
    assert "[redacted: github token]" in redact("ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmn")


def test_redact_slack_token():
    assert "[redacted: slack token]" in redact("xoxb-123456789012-123456789012-abc")


def test_redact_aws_key():
    assert "[redacted: aws key]" in redact("AKIAIOSFODNN7EXAMPLE")


def test_redact_api_key():
    assert "[redacted: api key]" in redact("sk-1234567890abcdefghijklmn")


def test_redact_api_key_variations():
    assert "[redacted: api key]" in redact("pk_test_abcdefghijklmnopqrst")
    assert "[redacted: api key]" in redact("api-key_abcdefghijklmnopqrst")
    assert "[redacted: api key]" in redact("token_abcdefghijklmnopqrst")


def test_redact_password():
    assert "[redacted: credential]" in redact("password=mysecretpass")
    assert "[redacted: credential]" in redact("passwd: secretvalue")
    assert "[redacted: credential]" in redact("SECRET=verysecret")


def test_redact_email():
    assert "[redacted: email]" in redact("contact user@company.com for help")


def test_redact_email_preserves_example():
    text = "user@example.com"
    assert text == redact(text)


def test_redact_ip_address():
    assert "[redacted: ip address]" in redact("connect to 192.168.1.100 on port 80")


def test_redact_preserves_safe_text():
    safe = "This is a normal message with no secrets."
    assert redact(safe) == safe


def test_redact_multiple_secrets():
    text = "key ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmn and password=secret123"
    result = redact(text)
    assert "[redacted: github token]" in result
    assert "[redacted: credential]" in result


def test_redact_empty_string():
    assert redact("") == ""
