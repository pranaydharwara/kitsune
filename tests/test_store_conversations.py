import pytest
from core.store.conversations import (
    create_conversation,
    list_conversations,
    get_conversation,
    update_conversation,
    fork_conversation,
    delete_conversation,
)
from core.store.messages import add_message


@pytest.mark.asyncio
async def test_create_conversation(db):
    conv = await create_conversation(db, title="Test Chat")
    assert conv["id"]
    assert conv["title"] == "Test Chat"


@pytest.mark.asyncio
async def test_create_conversation_default_title(db):
    conv = await create_conversation(db)
    assert conv["title"] == "New chat"


@pytest.mark.asyncio
async def test_create_conversation_with_project(db):
    await db.execute("INSERT INTO projects (id, name, path) VALUES ('proj-1', 'Test', '/tmp/test')")
    await db.commit()
    conv = await create_conversation(db, title="Proj Chat", project_id="proj-1")
    assert conv["project_id"] == "proj-1"


@pytest.mark.asyncio
async def test_list_conversations(db):
    await create_conversation(db, title="Chat 1")
    await create_conversation(db, title="Chat 2")
    convs = await list_conversations(db)
    assert len(convs) >= 2


@pytest.mark.asyncio
async def test_list_conversations_limit(db):
    for i in range(5):
        await create_conversation(db, title=f"Chat {i}")
    convs = await list_conversations(db, limit=3)
    assert len(convs) == 3


@pytest.mark.asyncio
async def test_get_conversation(db):
    conv = await create_conversation(db, title="Find Me")
    found = await get_conversation(db, conv["id"])
    assert found is not None
    assert found["title"] == "Find Me"


@pytest.mark.asyncio
async def test_get_conversation_not_found(db):
    found = await get_conversation(db, "nonexistent-id")
    assert found is None


@pytest.mark.asyncio
async def test_update_conversation(db):
    conv = await create_conversation(db, title="Old Title")
    await update_conversation(db, conv["id"], title="New Title")
    found = await get_conversation(db, conv["id"])
    assert found["title"] == "New Title"


@pytest.mark.asyncio
async def test_update_conversation_escalated(db):
    conv = await create_conversation(db)
    await update_conversation(db, conv["id"], escalated=True)
    found = await get_conversation(db, conv["id"])
    assert found["escalated"]


@pytest.mark.asyncio
async def test_delete_conversation(db):
    conv = await create_conversation(db, title="Delete Me")
    await delete_conversation(db, conv["id"])
    found = await get_conversation(db, conv["id"])
    assert found is None


@pytest.mark.asyncio
async def test_fork_conversation(db):
    conv = await create_conversation(db, title="Original")
    msg1 = await add_message(db, conv["id"], "user", "Hello")
    msg2 = await add_message(db, conv["id"], "assistant", "Hi there")
    msg3 = await add_message(db, conv["id"], "user", "Follow up")

    result = await fork_conversation(db, conv["id"], msg2["id"])
    assert result["id"] != conv["id"]
    assert "Fork" in result["title"] or "Original" in result["title"]


@pytest.mark.asyncio
async def test_fork_conversation_invalid_message(db):
    conv = await create_conversation(db, title="Test")
    with pytest.raises(ValueError):
        await fork_conversation(db, conv["id"], "nonexistent-msg")
