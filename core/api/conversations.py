from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from core.store.conversations import (
    create_conversation,
    delete_conversation,
    get_conversation,
    list_conversations,
    update_conversation,
)
from core.store.messages import get_messages

router = APIRouter(prefix="/api")


class ConversationUpdate(BaseModel):
    title: str | None = None
    mode: str | None = None


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
        await update_conversation(db, conversation_id, **fields)
        return {"ok": True}


@router.delete("/conversations/{conversation_id}")
async def delete_conv(conversation_id: str, request: Request):
    async with request.app.state.db_pool.acquire() as db:
        await delete_conversation(db, conversation_id)
        return {"ok": True}
