import json
import time

import httpx
from fastapi import APIRouter, Request
from pydantic import BaseModel
from sse_starlette.sse import EventSourceResponse

from core.config import MAIN_MODEL, OLLAMA_BASE_URL
from core.connectors.base import Prompt
from core.connectors.ollama import OllamaConnector
from core.store.conversations import create_conversation, get_conversation
from core.store.messages import add_message, get_messages

router = APIRouter(prefix="/api")

SYSTEM_PROMPT = (
    "You are Kitsune, a helpful AI assistant. Always respond in English. "
    "Be concise and helpful. Do not include thinking tags or internal reasoning."
)


def _get_connector() -> OllamaConnector:
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


class ChatRequest(BaseModel):
    message: str
    conversation_id: str | None = None


@router.post("/chat")
async def chat(req: ChatRequest, request: Request):
    db = request.app.state.db

    if req.conversation_id:
        conv = await get_conversation(db, req.conversation_id)
        if not conv:
            conv = await create_conversation(db, title=req.message[:60])
    else:
        conv = await create_conversation(db, title=req.message[:60])

    await add_message(db, conv["id"], "user", req.message)

    history = await get_messages(db, conv["id"])
    prompt_text = _build_prompt(history)
    connector = _get_connector()

    async def event_stream():
        full_text = ""
        start = time.monotonic()
        try:
            async for chunk in connector.stream(
                Prompt(text=prompt_text, system=SYSTEM_PROMPT)
            ):
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
            db,
            conv["id"],
            "assistant",
            full_text,
            answered_by=f"local:{connector.model}",
            latency_ms=latency,
        )
        yield {
            "event": "done",
            "data": json.dumps({
                "message": msg,
                "conversation_id": conv["id"],
            }),
        }

    return EventSourceResponse(event_stream())


def _build_prompt(history: list[dict]) -> str:
    parts = []
    for msg in history:
        prefix = "User" if msg["role"] == "user" else "Assistant"
        parts.append(f"{prefix}: {msg['text']}")
    return "\n\n".join(parts)
