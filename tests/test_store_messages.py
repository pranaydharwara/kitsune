import pytest
from core.store.conversations import create_conversation
from core.store.messages import add_message, get_messages, delete_messages_after, update_message


@pytest.mark.asyncio
async def test_add_message(db):
    conv = await create_conversation(db)
    msg = await add_message(db, conv["id"], "user", "Hello")
    assert msg["id"]
    assert msg["role"] == "user"
    assert msg["text"] == "Hello"


@pytest.mark.asyncio
async def test_add_message_with_metadata(db):
    conv = await create_conversation(db)
    msg = await add_message(
        db, conv["id"], "assistant", "Reply",
        answered_by="local:qwen3", latency_ms=150,
        tokens_in=10, tokens_out=20, cost_usd=0.001,
    )
    assert msg["answered_by"] == "local:qwen3"


@pytest.mark.asyncio
async def test_get_messages(db):
    conv = await create_conversation(db)
    await add_message(db, conv["id"], "user", "Msg 1")
    await add_message(db, conv["id"], "assistant", "Msg 2")
    await add_message(db, conv["id"], "user", "Msg 3")

    msgs = await get_messages(db, conv["id"])
    assert len(msgs) == 3
    assert msgs[0]["text"] == "Msg 1"


@pytest.mark.asyncio
async def test_get_messages_limit(db):
    conv = await create_conversation(db)
    for i in range(10):
        await add_message(db, conv["id"], "user", f"Msg {i}")

    msgs = await get_messages(db, conv["id"], limit=5)
    assert len(msgs) == 5


@pytest.mark.asyncio
async def test_delete_messages_after(db):
    conv = await create_conversation(db)
    msg1 = await add_message(db, conv["id"], "user", "Keep 1")
    msg2 = await add_message(db, conv["id"], "assistant", "Keep 2")
    msg3 = await add_message(db, conv["id"], "user", "Delete this")
    msg4 = await add_message(db, conv["id"], "assistant", "Delete this too")

    deleted = await delete_messages_after(db, conv["id"], msg2["id"])
    assert deleted >= 2

    msgs = await get_messages(db, conv["id"])
    assert len(msgs) == 2


@pytest.mark.asyncio
async def test_update_message(db):
    conv = await create_conversation(db)
    msg = await add_message(db, conv["id"], "user", "Original")
    await update_message(db, msg["id"], text="Updated")

    msgs = await get_messages(db, conv["id"])
    assert msgs[0]["text"] == "Updated"
