"""Rolling summary — local model summarises older turns in the background."""

import asyncio
import logging

import httpx

from core.config import CLASSIFIER_MODEL, OLLAMA_BASE_URL

log = logging.getLogger(__name__)

SUMMARY_PROMPT = (
    "Summarise this conversation so far in bullet points. "
    "Include: key decisions, facts established, open questions, and action items. "
    "Be concise — max 800 tokens. Use plain English."
)

SUMMARY_INTERVAL = 6  # every N assistant messages
CHARS_PER_TOKEN = 4
MAX_SUMMARY_CHARS = 800 * CHARS_PER_TOKEN


def should_summarise(messages: list[dict], current_summary: str | None) -> bool:
    assistant_count = sum(1 for m in messages if m["role"] == "assistant")
    if assistant_count < SUMMARY_INTERVAL:
        return False
    if current_summary and assistant_count % SUMMARY_INTERVAL != 0:
        return False
    total_chars = sum(len(m["text"]) for m in messages)
    if total_chars < 8_000 * CHARS_PER_TOKEN:
        return False
    return True


async def generate_summary(messages: list[dict]) -> str | None:
    transcript = []
    for msg in messages:
        prefix = "User" if msg["role"] == "user" else "Assistant"
        transcript.append(f"{prefix}: {msg['text']}")
    conversation_text = "\n\n".join(transcript)

    prompt = f"{SUMMARY_PROMPT}\n\n---\n\n{conversation_text}"

    try:
        async with httpx.AsyncClient(base_url=OLLAMA_BASE_URL, timeout=60) as client:
            resp = await client.post(
                "/api/generate",
                json={
                    "model": CLASSIFIER_MODEL,
                    "prompt": prompt,
                    "stream": False,
                    "keep_alive": "30s",
                },
            )
            resp.raise_for_status()
            summary = resp.json().get("response", "").strip()
            if len(summary) > MAX_SUMMARY_CHARS:
                summary = summary[:MAX_SUMMARY_CHARS]
            return summary or None
    except Exception:
        log.warning("Failed to generate rolling summary", exc_info=True)
        return None


async def maybe_update_summary(db, conversation_id: str, messages: list[dict]) -> None:
    from core.store.conversations import get_conversation, update_conversation

    conv = await get_conversation(db, conversation_id)
    if not conv:
        return
    current = conv.get("summary")
    if not should_summarise(messages, current):
        return

    summary = await generate_summary(messages)
    if summary:
        await update_conversation(
            db, conversation_id,
            summary=summary,
            summary_updated_at=__import__("datetime").datetime.now(
                __import__("datetime").timezone.utc
            ).strftime("%Y-%m-%dT%H:%M:%S.%fZ"),
        )
