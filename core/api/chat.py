import json
import time

import httpx
from fastapi import APIRouter, Request
from pydantic import BaseModel
from sse_starlette.sse import EventSourceResponse

from core.config import MAIN_MODEL, OLLAMA_BASE_URL
from core.connectors.base import Prompt
from core.connectors.claude_cli import ClaudeCliConnector
from core.connectors.ollama import OllamaConnector
from core.context.assembler import assemble
from core.context.summary import maybe_update_summary
from core.store.conversations import create_conversation, get_conversation, update_conversation
from core.store.messages import add_message, get_messages

router = APIRouter(prefix="/api")

LOCAL_SYSTEM = (
    "You are Kitsune, a helpful AI assistant. Always respond in English. "
    "Be concise and helpful. Do not include thinking tags or internal reasoning."
)


def _get_local_connector() -> OllamaConnector:
    try:
        r = httpx.get(f"{OLLAMA_BASE_URL}/api/tags", timeout=2)
        available = [m["name"] for m in r.json().get("models", [])]
    except Exception:
        return OllamaConnector()

    if any(MAIN_MODEL in m for m in available):
        return OllamaConnector(model=MAIN_MODEL)
    if available:
        return OllamaConnector(model=available[0])
    return OllamaConnector()


def _get_claude_connector() -> ClaudeCliConnector:
    return ClaudeCliConnector(model="sonnet")


class ChatRequest(BaseModel):
    message: str
    conversation_id: str | None = None
    mode: str = "auto"
    retry_message_id: str | None = None
    retry_with: str | None = None  # "local" or "cloud"


@router.post("/chat")
async def chat(req: ChatRequest, request: Request):
    db = request.app.state.db

    if req.conversation_id:
        conv = await get_conversation(db, req.conversation_id)
        if not conv:
            conv = await create_conversation(db, title=req.message[:60])
    else:
        conv = await create_conversation(db, title=req.message[:60])

    # On retry, don't re-add the user message
    if not req.retry_message_id:
        await add_message(db, conv["id"], "user", req.message)

    history = await get_messages(db, conv["id"])
    mode = req.retry_with or req.mode
    connector, route_reason = _pick_connector(mode, history, conv)

    if isinstance(connector, ClaudeCliConnector):
        summary = conv.get("summary")
        system, prompt_text = assemble(history, summary=summary)
        await update_conversation(db, conv["id"], escalated=True)
    else:
        prompt_text = _build_local_prompt(history)
        system = LOCAL_SYSTEM

    async def event_stream():
        full_text = ""
        start = time.monotonic()
        source = f"claude:{connector.model}" if isinstance(connector, ClaudeCliConnector) else f"local:{connector.model}"

        yield {
            "event": "route",
            "data": json.dumps({"source": source, "reason": route_reason}),
        }

        try:
            async for chunk in connector.stream(Prompt(text=prompt_text, system=system)):
                full_text += chunk.text
                yield {
                    "event": "token",
                    "data": json.dumps({"text": chunk.text, "done": chunk.done}),
                }
        except Exception as e:
            yield {
                "event": "error",
                "data": json.dumps({"error": str(e)}),
            }
            return

        latency = int((time.monotonic() - start) * 1000)
        msg = await add_message(
            db, conv["id"], "assistant", full_text,
            answered_by=source, latency_ms=latency,
        )

        # Store what was sent for the inspector
        from core.store.db import get_db as _
        await db.execute(
            "INSERT OR REPLACE INTO context_snapshots (message_id, prompt_text, token_estimate) VALUES (?, ?, ?)",
            (msg["id"], prompt_text, len(prompt_text) // 4),
        )
        await db.commit()

        yield {
            "event": "done",
            "data": json.dumps({
                "message": msg,
                "conversation_id": conv["id"],
                "route": {"source": source, "reason": route_reason},
            }),
        }

        # Background: update rolling summary if needed
        try:
            updated_history = await get_messages(db, conv["id"])
            await maybe_update_summary(db, conv["id"], updated_history)
        except Exception:
            pass

    return EventSourceResponse(event_stream())


@router.get("/chat/{message_id}/context")
async def get_context_snapshot(message_id: str, request: Request):
    db = request.app.state.db
    rows = await db.execute_fetchall(
        "SELECT * FROM context_snapshots WHERE message_id = ?", (message_id,)
    )
    if not rows:
        return {"prompt_text": None, "token_estimate": None}
    row = dict(rows[0])
    return row


def _pick_connector(mode: str, history: list[dict], conv: dict):
    claude = _get_claude_connector()
    local = _get_local_connector()

    if mode == "cloud":
        if claude.available().value == "ready":
            return claude, "User selected Cloud mode"
        return local, "Cloud requested but claude CLI unavailable, falling back to local"

    if mode == "local":
        return local, "User selected Local mode"

    # Auto mode: use heuristics
    if not history:
        return local, "New conversation, starting local"

    last_msg = history[-1]["text"] if history else ""

    # Heuristic: long messages or complex requests go to Claude
    if len(last_msg) > 2000:
        if claude.available().value == "ready":
            return claude, "Long/complex message detected"

    # Heuristic: if user mentions code review, architecture, etc.
    escalation_keywords = [
        "review this pr", "code review", "architecture",
        "security audit", "refactor", "design pattern",
        "explain this codebase", "write a spec",
    ]
    lower = last_msg.lower()
    for kw in escalation_keywords:
        if kw in lower:
            if claude.available().value == "ready":
                return claude, f"Escalation keyword: '{kw}'"

    return local, "Auto: handled locally"


def _build_local_prompt(history: list[dict]) -> str:
    parts = []
    for msg in history:
        prefix = "User" if msg["role"] == "user" else "Assistant"
        parts.append(f"{prefix}: {msg['text']}")
    return "\n\n".join(parts)
