import asyncio
import json
import time

import httpx
from fastapi import APIRouter, Request
from pydantic import BaseModel
from sse_starlette.sse import EventSourceResponse

from core.config import API_TO_CLI, CLAUDE_MODELS, MAIN_MODEL, OLLAMA_BASE_URL
from core.connectors.base import Prompt
from core.connectors.claude_cli import ClaudeCliConnector
from core.connectors.claude_sdk import ClaudeSdkConnector
from core.connectors.ollama import OllamaConnector
from core.context.assembler import assemble
from core.context.summary import maybe_update_summary
from core.router.decide import decide as router_decide
from core.context.project import build_project_context
from core.store.conversations import create_conversation, get_conversation, update_conversation
from core.store.messages import add_message, get_messages
from core.store.projects import get_project

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
    project_id: str | None = None
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
                conv = await create_conversation(db, title=req.message[:60], project_id=req.project_id)
        else:
            conv = await create_conversation(db, title=req.message[:60], project_id=req.project_id)

        if not req.retry_message_id:
            await add_message(db, conv["id"], "user", req.message)

        history = await get_messages(db, conv["id"])
        mode = req.retry_with or req.mode
        connector, route_reason = await _pick_connector(mode, history, conv, http, model=req.model)

        project_context = None
        pid = conv.get("project_id")
        if pid:
            proj = await get_project(db, pid)
            if proj:
                project_context = build_project_context(proj["path"])

        is_claude = isinstance(connector, (ClaudeSdkConnector, ClaudeCliConnector))
        if is_claude:
            summary = conv.get("summary")
            system, prompt_text = assemble(history, summary=summary)
            if project_context:
                system += f"\n\n## Project context\nThe user is working in the following project:\n{project_context}"
            await update_conversation(db, conv["id"], escalated=True)
            messages = None
        else:
            messages = _build_local_messages(history)
            prompt_text = messages[-1]["content"] if messages else ""
            system = LOCAL_SYSTEM
            if project_context:
                system += f"\n\nYou have context about the user's current project:\n{project_context}"

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
        usage = getattr(connector, "last_usage", None)
        tokens_in = usage.tokens_in if usage else None
        tokens_out = usage.tokens_out if usage else None
        cost = None
        if tokens_in and tokens_out:
            cost = _estimate_cost(connector.model, tokens_in, tokens_out)

        elapsed_s = (time.monotonic() - start) or 0.001
        tok_count = tokens_out or (len(full_text) // 4)
        speed = round(tok_count / elapsed_s, 1)

        async with pool.acquire() as db:
            msg = await add_message(
                db, conv_id, "assistant", full_text,
                answered_by=source, latency_ms=latency,
                tokens_in=tokens_in, tokens_out=tokens_out, cost_usd=cost,
                _commit=False,
            )
            await db.execute(
                "INSERT OR REPLACE INTO context_snapshots (message_id, prompt_text, token_estimate) VALUES (?, ?, ?)",
                (msg["id"], prompt_text, len(prompt_text) // 4),
            )
            await db.execute(
                "INSERT OR REPLACE INTO routing_decisions (message_id, chosen, reason) VALUES (?, ?, ?)",
                (msg["id"], source, route_reason),
            )
            await db.commit()

        yield {
            "event": "done",
            "data": json.dumps({
                "message": msg,
                "conversation_id": conv_id,
                "route": {"source": source, "reason": route_reason},
                "speed": speed,
            }),
        }

        asyncio.get_event_loop().create_task(
            _background_summary(pool, conv_id)
        )
        asyncio.get_event_loop().create_task(
            _background_auto_title(pool, http, conv_id)
        )

    return EventSourceResponse(event_stream())


@router.post("/chat/{conversation_id}/cancel")
async def cancel_stream(conversation_id: str):
    event = _active_streams.get(conversation_id)
    if event:
        event.set()
        return {"ok": True, "status": "cancelling"}
    return {"ok": False, "status": "no_active_stream"}


class FeedbackRequest(BaseModel):
    feedback: str  # "up" or "down"


@router.post("/chat/{message_id}/feedback")
async def submit_feedback(message_id: str, req: FeedbackRequest, request: Request):
    if req.feedback not in ("up", "down"):
        return {"ok": False, "error": "feedback must be 'up' or 'down'"}
    async with request.app.state.db_pool.acquire() as db:
        row = await db.execute_fetchall(
            "SELECT id FROM messages WHERE id = ?", (message_id,)
        )
        if not row:
            return {"ok": False, "error": "message not found"}
        await db.execute(
            """INSERT INTO routing_decisions (message_id, chosen, reason, feedback)
               VALUES (?, '', '', ?)
               ON CONFLICT(message_id) DO UPDATE SET feedback = ?""",
            (message_id, req.feedback, req.feedback),
        )
        await db.commit()
    return {"ok": True}


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
            cli_model = API_TO_CLI.get(model_name)
            if not cli_model:
                raise RuntimeError(f"Model {model_name} requires an API key (not available via CLI)")
            return ClaudeCliConnector(model=cli_model), f"Model: Claude {model_name} (CLI)"
        else:
            return OllamaConnector(model=model_name, http=http), f"Model: {model_name}"

    local = await _get_local_connector(http)
    claude_ready = _is_claude_available()

    if mode == "cloud":
        if claude_ready:
            return _get_claude_connector(), "User selected Cloud mode"
        return local, "Cloud requested but claude CLI unavailable, falling back to local"

    if mode == "local":
        return local, "User selected Local mode"

    if not history:
        return local, "New conversation, starting local"

    last_msg = history[-1]["text"] if history else ""
    decision = await router_decide(last_msg, history, conv, claude_ready)

    if decision["target"] == "cloud" and claude_ready:
        hint = decision.get("model_hint")
        if hint == "opus":
            connector = _get_claude_connector_for_model("opus")
        else:
            connector = _get_claude_connector()
        return connector, decision["reason"]

    return local, decision["reason"]


def _get_claude_connector_for_model(hint: str) -> ClaudeSdkConnector | ClaudeCliConnector:
    if hint == "opus":
        sdk = ClaudeSdkConnector(model="claude-opus-4-6-20250514")
        if sdk.available().value == "ready":
            return sdk
        return ClaudeCliConnector(model="opus")
    return _get_claude_connector()


def _build_local_messages(history: list[dict]) -> list[dict]:
    return [{"role": msg["role"], "content": msg["text"]} for msg in history]


COST_PER_M = {
    "claude-sonnet-5-5-20250514": (3.0, 15.0),
    "claude-opus-5-5-20250514": (15.0, 75.0),
    "claude-haiku-5-5-20250514": (0.8, 4.0),
    "claude-opus-4-6-20250514": (15.0, 75.0),
    "claude-sonnet-4-5-20250514": (3.0, 15.0),
    "claude-sonnet-4-20250514": (3.0, 15.0),
    "claude-haiku-3-5-20241022": (0.8, 4.0),
}


def _estimate_cost(model: str, tokens_in: int, tokens_out: int) -> float | None:
    rates = COST_PER_M.get(model)
    if not rates:
        return None
    return round((tokens_in * rates[0] + tokens_out * rates[1]) / 1_000_000, 6)


async def _background_summary(pool, conversation_id: str):
    try:
        async with pool.acquire() as db:
            history = await get_messages(db, conversation_id)
            await maybe_update_summary(db, conversation_id, history)
    except Exception:
        pass


async def _background_auto_title(pool, http: httpx.AsyncClient, conversation_id: str):
    try:
        async with pool.acquire() as db:
            conv = await get_conversation(db, conversation_id)
            if not conv:
                return
            history = await get_messages(db, conversation_id)
            if len(history) != 2:
                return
            user_msg = history[0]["text"] if history[0]["role"] == "user" else ""
            assistant_msg = history[1]["text"] if len(history) > 1 else ""
            if not user_msg:
                return
            if conv["title"] != user_msg[:60]:
                return

        prompt = (
            f"Generate a short title (3-6 words, no quotes) for this conversation:\n"
            f"User: {user_msg[:300]}\nAssistant: {assistant_msg[:300]}"
        )
        try:
            r = await http.post("/api/chat", json={
                "model": MAIN_MODEL,
                "messages": [{"role": "user", "content": prompt}],
                "stream": False,
                "keep_alive": "5m",
            }, timeout=10)
            data = r.json()
            title = data.get("message", {}).get("content", "").strip().strip('"\'')
            if title and 2 < len(title) < 60:
                async with pool.acquire() as db:
                    await update_conversation(db, conversation_id, title=title)
        except Exception:
            pass
    except Exception:
        pass
