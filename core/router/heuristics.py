"""Heuristic scoring — fast, no-model checks for routing decisions."""

import re

_PRIVACY_PATTERNS = [
    re.compile(r"-----BEGIN (?:RSA |EC |DSA )?PRIVATE KEY-----"),
    re.compile(r"ghp_[A-Za-z0-9]{36,}"),
    re.compile(r"xoxb-[A-Za-z0-9\-]+"),
    re.compile(r"AKIA[0-9A-Z]{16}"),
    re.compile(r"(?:sk|pk|api|token)[_-][A-Za-z0-9_\-]{20,}", re.IGNORECASE),
    re.compile(r"(?:password|passwd|secret)\s*[:=]\s*\S+", re.IGNORECASE),
]


def has_secrets(text: str) -> bool:
    return any(p.search(text) for p in _PRIVACY_PATTERNS)


def heuristic_score(text: str) -> tuple[int, str]:
    """Score message complexity using fast heuristics. Returns (score, reason)."""
    score = 0
    reasons = []

    if len(text) > 2000:
        score += 2
        reasons.append("long message")
    elif len(text) > 800:
        score += 1
        reasons.append("medium length")

    if text.count("```") >= 2:
        score += 2
        reasons.append("code blocks")
    elif text.count("`") >= 4:
        score += 1
        reasons.append("inline code")

    steps = sum(
        1 for line in text.split("\n")
        if line.strip()[:2] in ("1.", "2.", "3.", "4.", "5.", "6.", "7.", "8.", "9.", "- ", "* ")
    )
    if steps >= 4:
        score += 2
        reasons.append(f"{steps} steps")
    elif steps >= 2:
        score += 1
        reasons.append(f"{steps} steps")

    strong_keywords = [
        "review this pr", "code review", "security audit", "explain this codebase",
        "write a spec", "detailed analysis", "pros and cons", "trade-offs",
    ]
    medium_keywords = [
        "architecture", "refactor", "design pattern", "compare", "analyze",
        "in depth", "in detail", "comprehensive", "step by step",
        "explain", "how does", "how do", "why does", "why do",
    ]
    lower = text.lower()
    for kw in strong_keywords:
        if kw in lower:
            score += 3
            reasons.append(f"'{kw}'")
            break
    else:
        matched = [kw for kw in medium_keywords if kw in lower]
        if len(matched) >= 2:
            score += 3
            reasons.append(f"multiple: {', '.join(matched[:3])}")
        elif matched:
            score += 2
            reasons.append(f"'{matched[0]}'")

    if len(text.split()) > 50 and ("?" in text) and text.count("?") >= 3:
        score += 1
        reasons.append("multi-question")

    return score, ", ".join(reasons) if reasons else "simple"
