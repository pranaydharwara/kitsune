"""Context assembler — build a sized prompt for Claude from conversation history."""

from core.config import CLAUDE_HANDOFF_BUDGET
from core.context.redact import redact

CHARS_PER_TOKEN = 4
PREAMBLE = (
    "You are Kitsune, a helpful AI assistant. The user's local model couldn't "
    "handle this request, so it has been escalated to you. Be concise and helpful. "
    "Always respond in English."
)


def _estimate_tokens(text: str) -> int:
    return len(text) // CHARS_PER_TOKEN


def assemble(
    messages: list[dict],
    summary: str | None = None,
    budget_tokens: int = CLAUDE_HANDOFF_BUDGET,
) -> tuple[str, str]:
    """Build (system_prompt, user_prompt) that fits within budget_tokens.

    Assembly order (highest priority first):
    1. Preamble (system prompt)
    2. Current ask (last user message)
    3. Recent turns verbatim (newest first until budget)
    4. Rolling summary of older turns
    """
    budget = budget_tokens
    budget -= _estimate_tokens(PREAMBLE)

    if not messages:
        return PREAMBLE, ""

    current_ask = messages[-1]["text"] if messages[-1]["role"] == "user" else ""
    budget -= _estimate_tokens(current_ask)

    # Pack recent turns newest-first (excluding the current ask)
    history = messages[:-1] if current_ask else messages
    recent_parts = []
    for msg in reversed(history):
        prefix = "User" if msg["role"] == "user" else "Assistant"
        line = f"{prefix}: {msg['text']}"
        cost = _estimate_tokens(line)
        if budget - cost < 0:
            break
        recent_parts.insert(0, line)
        budget -= cost

    parts = []

    # Add rolling summary if we have one and couldn't fit all history
    if summary and len(recent_parts) < len(history):
        summary_line = f"[Conversation summary]\n{summary}"
        cost = _estimate_tokens(summary_line)
        if budget - cost >= 0:
            parts.append(summary_line)
            budget -= cost

    parts.extend(recent_parts)

    if current_ask:
        parts.append(f"User: {current_ask}")

    prompt = redact("\n\n".join(parts))
    return PREAMBLE, prompt
