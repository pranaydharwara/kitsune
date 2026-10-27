"""Context assembler — build a sized prompt for Claude from conversation history."""

import re

from core.config import CLAUDE_HANDOFF_BUDGET
from core.context.redact import redact

CHARS_PER_TOKEN = 4
SAFETY_MARGIN = 0.9
RECENT_BUDGET_RATIO = 0.6

PREAMBLE = (
    "You are Kitsune, a helpful AI assistant. You are answering inside Kitsune, "
    "a local-first chat app. Earlier turns in this conversation may have been "
    "answered by a smaller local model. Answer the user's latest message. "
    "Be concise and helpful. Always respond in English."
)

_CODE_BLOCK_RE = re.compile(r"```(\w*)\n(.*?)```", re.DOTALL)


def _estimate_tokens(text: str) -> int:
    return len(text) // CHARS_PER_TOKEN


def _compress_code_blocks(text: str, keep_lines: int = 6) -> str:
    """Replace large code blocks with placeholders showing language and line count."""
    def _replace(m: re.Match) -> str:
        lang = m.group(1) or "code"
        code = m.group(2)
        lines = code.strip().splitlines()
        if len(lines) <= keep_lines:
            return m.group(0)
        return f"[code: {len(lines)} lines {lang} — omitted]"
    return _CODE_BLOCK_RE.sub(_replace, text)


def _format_message(msg: dict, compress_code: bool = False) -> str:
    prefix = "User" if msg["role"] == "user" else "Assistant"
    text = msg["text"]
    if compress_code:
        text = _compress_code_blocks(text)
    model = ""
    if msg["role"] == "assistant" and msg.get("answered_by"):
        model = f' model="{msg["answered_by"]}"'
    return f"<{msg['role']}{model}>{text}</{msg['role']}>"


def assemble(
    messages: list[dict],
    summary: str | None = None,
    budget_tokens: int = CLAUDE_HANDOFF_BUDGET,
) -> tuple[str, str]:
    """Build (system_prompt, user_prompt) that fits within budget_tokens.

    Assembly order (highest priority first):
    1. Preamble (system prompt) — fixed
    2. Current ask (last user message) — always full
    3. Recent turns verbatim (newest first, up to 60% of remaining budget)
    4. Rolling summary of older turns
    5. Older code blocks compressed to placeholders
    """
    budget = int(budget_tokens * SAFETY_MARGIN)
    budget -= _estimate_tokens(PREAMBLE)

    if not messages:
        return PREAMBLE, ""

    # Current ask is always included in full
    current_ask = ""
    if messages[-1]["role"] == "user":
        current_ask = messages[-1]["text"]
        budget -= _estimate_tokens(current_ask)

    # History = everything except the current ask
    history = messages[:-1] if current_ask else messages

    # Budget for recent turns: 60% of what's left
    recent_budget = int(budget * RECENT_BUDGET_RATIO)
    summary_budget = budget - recent_budget

    # Pack recent turns newest-first
    recent_parts: list[str] = []
    recent_used = 0
    included_count = 0
    for msg in reversed(history):
        line = _format_message(msg, compress_code=False)
        cost = _estimate_tokens(line)
        if recent_used + cost > recent_budget:
            break
        recent_parts.insert(0, line)
        recent_used += cost
        included_count += 1

    # Build prompt with XML structure
    sections: list[str] = []

    # Summary of older turns (if we couldn't fit everything)
    if summary and included_count < len(history):
        summary_text = f"<conversation_summary>\n{summary}\n</conversation_summary>"
        cost = _estimate_tokens(summary_text)
        if cost <= summary_budget:
            sections.append(summary_text)

    # Recent messages
    if recent_parts:
        # Compress code in messages that are far from the current ask
        compressed_parts = []
        for i, part in enumerate(recent_parts):
            if i < len(recent_parts) - 4:
                compressed_parts.append(_compress_code_blocks(part))
            else:
                compressed_parts.append(part)

        sections.append(
            "<recent_messages>\n"
            + "\n".join(compressed_parts)
            + "\n</recent_messages>"
        )

    # Current question
    if current_ask:
        sections.append(f"<question>\n{current_ask}\n</question>")

    prompt = redact("\n\n".join(sections))
    return PREAMBLE, prompt
