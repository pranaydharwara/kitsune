import asyncio
import json
import time

import httpx
from fastapi import APIRouter, Request
from pydantic import BaseModel
from sse_starlette.sse import EventSourceResponse

from core.config import CLAUDE_MODELS, MAIN_MODEL, OLLAMA_BASE_URL
from core.connectors.base import Prompt
from core.connectors.claude_cli import ClaudeCliConnector
from core.connectors.claude_sdk import ClaudeSdkConnector
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

_model_cache: dict = {"models": [], "ts": 0.0}
_claude_available: dict = {"ready": False, "ts": 0.0}
MODEL_CACHE_TTL = 30.0
CLAUDE_CACHE_TTL = 60.0

_active_streams: dict[str, asyncio.Event] = {}


async def _get_ollama_models(http: httpx.AsyncClient) -> list[str]:
    now = time.monotonic()
    if now - _model_cache["ts"] < MODEL_CACHE_TTL and _model_cache["models"]:
        return _model_cache["models"]
    try:
        r = await http.get("/api/tags", timeout=2)
        models = [m["name"] for m in r.json().get("models", [])]
        _model_cache["models"] = models
        _model_cache["ts"] = now
        return models
    except Exception:
        return _model_cache["models"]


def _is_claude_available() -> bool:
    now = time.monotonic()
    if now - _claude_available["ts"] < CLAUDE_CACHE_TTL:
        return _claude_available["ready"]
    ready = ClaudeSdkConnector().available().value == "ready" or ClaudeCliConnector().available().value == "ready"
    _claude_available["ready"] = ready
    _claude_available["ts"] = now
    return ready


async def _get_local_connector(http: httpx.AsyncClient) -> OllamaConnector:
    available = await _get_ollama_models(http)
    if not available:
        return OllamaConnector(http=http)
    if any(MAIN_MODEL in m for m in available):
        return OllamaConnector(model=MAIN_MODEL, http=http)
    return OllamaConnector(model=available[0], http=http)


def _get_claude_connector() -> ClaudeSdkConnector | ClaudeCliConnector:
    sdk = ClaudeSdkConnector()
    if sdk.available().value == "ready":
        return sdk
    return ClaudeCliConnector(model="sonnet")


class ChatRequest(BaseModel):
    message: str
    conversation_id: str | None = None
    mode: str = "auto"
    model: str | None = None
    retry_message_id: str | None = None
    retry_with: str | None = None  # "local" or "cloud"


@router.get("/models")
async def list_models(request: Request):
    http: httpx.AsyncClient = request.app.state.http
    local = []
    try:
        r = await http.get("/api/tags", timeout=2)
        for m in r.json().get("models", []):
            size = m.get("size", 0)
            size_label = f"{size / 1e9:.1f}GB" if size else ""
            local.append({"id": f"local:{m['name']}", "name": m["name"], "provider": "local", "size": size_label})
    except Exception:
        pass

    cloud = []
    if _is_claude_available():
        for cm in CLAUDE_MODELS:
            cloud.append({"id": f"claude:{cm['api']}", "name": cm["name"], "provider": "claude", "family": cm["family"]})

    return {"local": local, "cloud": cloud}


@router.post("/chat")
async def chat(req: ChatRequest, request: Request):
    pool = request.app.state.db_pool
    http: httpx.AsyncClient = request.app.state.http

    async with pool.acquire() as db:
        if req.conversation_id:
            conv = await get_conversation(db, req.conversation_id)
            if not conv:
                conv = await create_conversation(db, title=req.message[:60])
        else:
            conv = await create_conversation(db, title=req.message[:60])

        if not req.retry_message_id:
            await add_message(db, conv["id"], "user", req.message)

        history = await get_messages(db, conv["id"])
        mode = req.retry_with or req.mode
        connector, route_reason = await _pick_connector(mode, history, conv, http, model=req.model)

        is_claude = isinstance(connector, (ClaudeSdkConnector, ClaudeCliConnector))
        if is_claude:
            summary = conv.get("summary")
            system, prompt_text = assemble(history, summary=summary)
            await update_conversation(db, conv["id"], escalated=True)
            messages = None
        else:
            messages = _build_local_messages(history)
            prompt_text = messages[-1]["content"] if messages else ""
            system = LOCAL_SYSTEM

    conv_id = conv["id"]
    cancel_event = asyncio.Event()
    _active_streams[conv_id] = cancel_event

    async def event_stream():
        full_text = ""
        start = time.monotonic()
        source = f"claude:{connector.model}" if isinstance(connector, (ClaudeSdkConnector, ClaudeCliConnector)) else f"local:{connector.model}"

        yield {
            "event": "route",
            "data": json.dumps({"source": source, "reason": route_reason}),
        }

        cancelled = False
        try:
            async for chunk in connector.stream(Prompt(text=prompt_text, system=system, messages=messages)):
                if cancel_event.is_set():
                    cancelled = True
                    break
                full_text += chunk.text
                yield {
                    "event": "token",
                    "data": json.dumps({"text": chunk.text, "done": chunk.done}),
                }
        except Exception as e:
            # Save partial response on error
            if full_text.strip():
                async with pool.acquire() as db:
                    latency = int((time.monotonic() - start) * 1000)
                    await add_message(
                        db, conv_id, "assistant", full_text,
                        answered_by=source, latency_ms=latency,
                    )
            yield {
                "event": "error",
                "data": json.dumps({"error": str(e)}),
            }
            return
        finally:
            _active_streams.pop(conv_id, None)

        if cancelled:
            if full_text.strip():
                async with pool.acquire() as db:
                    latency = int((time.monotonic() - start) * 1000)
                    await add_message(
                        db, conv_id, "assistant", full_text + "\n\n*(cancelled)*",
                        answered_by=source, latency_ms=latency,
                    )
            yield {
                "event": "cancelled",
                "data": json.dumps({"partial_text": full_text}),
            }
            return

        latency = int((time.monotonic() - start) * 1000)
        async with pool.acquire() as db:
            msg = await add_message(
                db, conv_id, "assistant", full_text,
                answered_by=source, latency_ms=latency,
                _commit=False,
            )
            await db.execute(
                "INSERT OR REPLACE INTO context_snapshots (message_id, prompt_text, token_estimate) VALUES (?, ?, ?)",
                (msg["id"], prompt_text, len(prompt_text) // 4),
            )
            await db.commit()

        yield {
            "event": "done",
            "data": json.dumps({
                "message": msg,
                "conversation_id": conv_id,
                "route": {"source": source, "reason": route_reason},
            }),
        }

        asyncio.get_event_loop().create_task(
            _background_summary(pool, conv_id)
        )

    return EventSourceResponse(event_stream())


@router.post("/chat/{conversation_id}/cancel")
async def cancel_stream(conversation_id: str):
    event = _active_streams.get(conversation_id)
    if event:
        event.set()
        return {"ok": True, "status": "cancelling"}
    return {"ok": False, "status": "no_active_stream"}


@router.get("/chat/{message_id}/context")
async def get_context_snapshot(message_id: str, request: Request):
    async with request.app.state.db_pool.acquire() as db:
        rows = await db.execute_fetchall(
            "SELECT * FROM context_snapshots WHERE message_id = ?", (message_id,)
        )
        if not rows:
            return {"prompt_text": None, "token_estimate": None}
        return dict(rows[0])


async def _pick_connector(mode: str, history: list[dict], conv: dict, http: httpx.AsyncClient, model: str | None = None):
    if model:
        provider, model_name = model.split(":", 1)
        if provider == "claude":
            sdk = ClaudeSdkConnector(model=model_name)
            if sdk.available().value == "ready":
                return sdk, f"Model: Claude {model_name}"
            return ClaudeCliConnector(model=model_name), f"Model: Claude {model_name} (CLI)"
        else:
            return OllamaConnector(model=model_name, http=http), f"Model: {model_name}"

    claude = _get_claude_connector()
    local = await _get_local_connector(http)
    claude_ready = _is_claude_available()

    if mode == "cloud":
        if claude_ready:
            return claude, "User selected Cloud mode"
        return local, "Cloud requested but claude CLI unavailable, falling back to local"

    if mode == "local":
        return local, "User selected Local mode"

    if not history:
        return local, "New conversation, starting local"

    last_msg = history[-1]["text"] if history else ""

    if len(last_msg) > 2000 and claude_ready:
        return claude, "Long/complex message detected"

    escalation_keywords = [
        "review this pr", "code review", "architecture",
        "security audit", "refactor", "design pattern",
        "explain this codebase", "write a spec",
    ]
    lower = last_msg.lower()
    for kw in escalation_keywords:
        if kw in lower and claude_ready:
            return claude, f"Escalation keyword: '{kw}'"

    return local, "Auto: handled locally"


def _build_local_messages(history: list[dict]) -> list[dict]:
    return [{"role": msg["role"], "content": msg["text"]} for msg in history]


async def _background_summary(pool, conversation_id: str):
    try:
        async with pool.acquire() as db:
            history = await get_messages(db, conversation_id)
            await maybe_update_summary(db, conversation_id, history)
    except Exception:
        pass
