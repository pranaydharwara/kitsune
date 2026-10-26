"""Privacy redaction — strip secrets before anything leaves the machine."""

import re

_PATTERNS = [
    (re.compile(r"-----BEGIN (?:RSA |EC |DSA )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |DSA )?PRIVATE KEY-----"), "[redacted: private key]"),
    (re.compile(r"ghp_[A-Za-z0-9]{36,}"), "[redacted: github token]"),
    (re.compile(r"xoxb-[A-Za-z0-9\-]+"), "[redacted: slack token]"),
    (re.compile(r"AKIA[0-9A-Z]{16}"), "[redacted: aws key]"),
    (re.compile(r"(?:sk|pk|api|token)[_-][A-Za-z0-9_\-]{20,}", re.IGNORECASE), "[redacted: api key]"),
    (re.compile(r"(?:password|passwd|secret)\s*[:=]\s*\S+", re.IGNORECASE), "[redacted: credential]"),
    (re.compile(r"\b[A-Za-z0-9._%+-]+@(?!example\.com)[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b"), "[redacted: email]"),
    (re.compile(r"\b(?:\d{1,3}\.){3}\d{1,3}(?::\d+)?\b"), "[redacted: ip address]"),
]


def redact(text: str) -> str:
    for pattern, replacement in _PATTERNS:
        text = pattern.sub(replacement, text)
    return text
