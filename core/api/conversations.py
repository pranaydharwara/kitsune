from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from core.store.conversations import (
    create_conversation,
    delete_conversation,
    get_conversation,
    list_conversations,
    update_conversation,
)
from core.store.messages import delete_messages_after, get_messages, update_message

router = APIRouter(prefix="/api")


class ConversationUpdate(BaseModel):
    title: str | None = None
    mode: str | None = None
    project_id: str | None = None
    starred: bool | None = None
    model_id: str | None = None


class EditMessageRequest(BaseModel):
    text: str


@router.get("/conversations")
async def list_convs(request: Request, limit: int = 50):
    async with request.app.state.db_pool.acquire() as db:
        return await list_conversations(db, limit)


@router.post("/conversations")
async def create_conv(request: Request):
    async with request.app.state.db_pool.acquire() as db:
        return await create_conversation(db)


@router.get("/conversations/{conversation_id}")
async def get_conv(conversation_id: str, request: Request):
    async with request.app.state.db_pool.acquire() as db:
        conv = await get_conversation(db, conversation_id)
        if not conv:
            raise HTTPException(status_code=404, detail="Conversation not found")
        return conv


@router.get("/conversations/{conversation_id}/messages")
async def get_conv_messages(conversation_id: str, request: Request, limit: int = 200):
    async with request.app.state.db_pool.acquire() as db:
        return await get_messages(db, conversation_id, limit)


@router.patch("/conversations/{conversation_id}")
async def update_conv(conversation_id: str, body: ConversationUpdate, request: Request):
    async with request.app.state.db_pool.acquire() as db:
        fields = body.model_dump(exclude_none=True)
        if "starred" in fields:
            fields["starred"] = int(fields["starred"])
        await update_conversation(db, conversation_id, **fields)
        return {"ok": True}


@router.delete("/conversations/{conversation_id}")
async def delete_conv(conversation_id: str, request: Request):
    async with request.app.state.db_pool.acquire() as db:
        await delete_conversation(db, conversation_id)
        return {"ok": True}


@router.get("/conversations/{conversation_id}/usage")
async def get_conv_usage(conversation_id: str, request: Request):
    async with request.app.state.db_pool.acquire() as db:
        row = await db.execute_fetchall(
            "SELECT "
            "  COUNT(*) as total_messages, "
            "  SUM(CASE WHEN answered_by LIKE 'claude:%%' THEN 1 ELSE 0 END) as cloud_messages, "
            "  SUM(CASE WHEN answered_by LIKE 'local:%%' THEN 1 ELSE 0 END) as local_messages, "
            "  SUM(tokens_in) as total_tokens_in, "
            "  SUM(tokens_out) as total_tokens_out, "
            "  SUM(cost_usd) as total_cost "
            "FROM messages WHERE conversation_id = ? AND role = 'assistant'",
            (conversation_id,),
        )
        stats = dict(row[0]) if row else {}
        return {k: v or 0 for k, v in stats.items()}


@router.put("/conversations/{conversation_id}/messages/{message_id}")
async def edit_message(conversation_id: str, message_id: str, body: EditMessageRequest, request: Request):
    async with request.app.state.db_pool.acquire() as db:
        deleted = await delete_messages_after(db, conversation_id, message_id)
        await update_message(db, message_id, text=body.text)
        return {"ok": True, "deleted_after": deleted}
