import json
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Request, UploadFile, File
from fastapi.responses import JSONResponse

from core.store.conversations import create_conversation
from core.store.messages import add_message, get_messages
from core.store.conversations import get_conversation

router = APIRouter(prefix="/api")


def _now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%fZ")


@router.get("/conversations/{conversation_id}/export")
async def export_conversation(conversation_id: str, request: Request, format: str = "json"):
    async with request.app.state.db_pool.acquire() as db:
        conv = await get_conversation(db, conversation_id)
        if not conv:
            return JSONResponse({"error": "Conversation not found"}, status_code=404)
        msgs = await get_messages(db, conversation_id, limit=10000)

    if format == "markdown":
        lines = [f"# {conv['title']}\n"]
        for m in msgs:
            role = "You" if m["role"] == "user" else "Kitsune"
            lines.append(f"## {role}\n\n{m['text']}\n")
        return JSONResponse({"content": "\n---\n\n".join(lines), "filename": f"{conv['title']}.md"})

    export = {
        "format": "kitsune",
        "version": 1,
        "exported_at": _now(),
        "conversation": {
            "title": conv["title"],
            "created_at": conv["created_at"],
            "mode": conv.get("mode", "auto"),
        },
        "messages": [
            {
                "role": m["role"],
                "text": m["text"],
                "answered_by": m.get("answered_by"),
                "tokens_in": m.get("tokens_in"),
                "tokens_out": m.get("tokens_out"),
                "cost_usd": m.get("cost_usd"),
                "created_at": m["created_at"],
            }
            for m in msgs
        ],
    }
    return JSONResponse({"content": json.dumps(export, indent=2), "filename": f"{conv['title']}.json"})


@router.get("/conversations/export-all")
async def export_all(request: Request):
    async with request.app.state.db_pool.acquire() as db:
        convs = await db.execute_fetchall(
            "SELECT * FROM conversations ORDER BY created_at DESC"
        )
        all_exports = []
        for conv in convs:
            conv = dict(conv)
            msgs = await get_messages(db, conv["id"], limit=10000)
            all_exports.append({
                "conversation": {
                    "title": conv["title"],
                    "created_at": conv["created_at"],
                    "mode": conv.get("mode", "auto"),
                },
                "messages": [
                    {
                        "role": m["role"],
                        "text": m["text"],
                        "answered_by": m.get("answered_by"),
                        "created_at": m["created_at"],
                    }
                    for m in msgs
                ],
            })

    export = {
        "format": "kitsune",
        "version": 1,
        "exported_at": _now(),
        "conversations": all_exports,
    }
    return JSONResponse({"content": json.dumps(export, indent=2), "filename": "kitsune-export.json"})


@router.post("/conversations/import")
async def import_conversations(request: Request, file: UploadFile = File(...)):
    raw = await file.read()
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        return JSONResponse({"error": "Invalid JSON file"}, status_code=400)

    pool = request.app.state.db_pool
    imported = 0

    if _is_claude_export(data):
        imported = await _import_claude(data, pool)

    elif isinstance(data, dict) and data.get("format") == "kitsune":
        convs = data.get("conversations", [])
        if not convs and data.get("conversation"):
            convs = [{"conversation": data["conversation"], "messages": data["messages"]}]

        async with pool.acquire() as db:
            for entry in convs:
                conv_data = entry.get("conversation", entry)
                title = conv_data.get("title", "Imported chat")
                conv = await create_conversation(db, title=title)
                for m in entry.get("messages", []):
                    await add_message(
                        db, conv["id"], m["role"], m["text"],
                        answered_by=m.get("answered_by"),
                    )
                imported += 1

    else:
        return JSONResponse({"error": "Unrecognized export format"}, status_code=400)

    return {"imported": imported}


def _is_claude_export(data: dict) -> bool:
    if isinstance(data, list):
        return len(data) > 0 and "uuid" in data[0] and "chat_messages" in data[0]
    return "uuid" in data and "chat_messages" in data


@router.post("/conversations/import-claude")
async def import_claude_direct(request: Request, file: UploadFile = File(...)):
    raw = await file.read()
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        return JSONResponse({"error": "Invalid JSON file"}, status_code=400)

    if not _is_claude_export(data):
        return JSONResponse({"error": "Not a Claude export file"}, status_code=400)

    pool = request.app.state.db_pool
    imported = await _import_claude(data, pool)
    return {"imported": imported}


async def _import_claude(data, pool) -> int:
    conversations = data if isinstance(data, list) else [data]
    imported = 0

    async with pool.acquire() as db:
        for claude_conv in conversations:
            title = claude_conv.get("name", "Imported from Claude")
            conv = await create_conversation(db, title=title)

            chat_messages = claude_conv.get("chat_messages", [])
            chat_messages.sort(key=lambda m: m.get("created_at", ""))

            for msg in chat_messages:
                sender = msg.get("sender", "")
                if sender == "human":
                    role = "user"
                elif sender == "assistant":
                    role = "assistant"
                else:
                    continue

                text_parts = []
                for content in msg.get("content", []):
                    if isinstance(content, str):
                        text_parts.append(content)
                    elif isinstance(content, dict) and content.get("type") == "text":
                        text_parts.append(content.get("text", ""))

                text = "\n".join(text_parts).strip()
                if not text:
                    continue

                answered_by = None
                if role == "assistant":
                    model = msg.get("model", claude_conv.get("model"))
                    if model:
                        answered_by = f"claude:{model}"

                await add_message(db, conv["id"], role, text, answered_by=answered_by)

            imported += 1

    return imported
