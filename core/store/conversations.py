import uuid
from datetime import datetime, timezone

import aiosqlite


def _now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%fZ")


async def create_conversation(db: aiosqlite.Connection, title: str = "New chat", project_id: str | None = None) -> dict:
    cid = uuid.uuid4().hex[:12]
    now = _now()
    await db.execute(
        "INSERT INTO conversations (id, title, project_id, created_at) VALUES (?, ?, ?, ?)",
        (cid, title, project_id, now),
    )
    await db.commit()
    return {"id": cid, "title": title, "project_id": project_id, "mode": "auto", "escalated": False, "created_at": now}


async def list_conversations(db: aiosqlite.Connection, limit: int = 50, project_id: str | None = None) -> list[dict]:
    if project_id is not None:
        rows = await db.execute_fetchall(
            """SELECT c.id, c.title, c.project_id, c.mode, c.escalated, c.starred, c.created_at,
                      (SELECT text FROM messages WHERE conversation_id = c.id
                       ORDER BY created_at DESC LIMIT 1) as last_message
               FROM conversations c WHERE c.project_id = ? ORDER BY c.starred DESC, c.created_at DESC LIMIT ?""",
            (project_id, limit),
        )
    else:
        rows = await db.execute_fetchall(
            """SELECT c.id, c.title, c.project_id, c.mode, c.escalated, c.starred, c.created_at,
                      (SELECT text FROM messages WHERE conversation_id = c.id
                       ORDER BY created_at DESC LIMIT 1) as last_message
               FROM conversations c ORDER BY c.starred DESC, c.created_at DESC LIMIT ?""",
            (limit,),
        )
    return [dict(r) for r in rows]


async def get_conversation(db: aiosqlite.Connection, conversation_id: str) -> dict | None:
    row = await db.execute_fetchall(
        "SELECT * FROM conversations WHERE id = ?", (conversation_id,)
    )
    return dict(row[0]) if row else None


async def update_conversation(
    db: aiosqlite.Connection, conversation_id: str, **fields
) -> None:
    allowed = {"title", "mode", "escalated", "starred", "model_id", "summary", "summary_updated_at", "project_id"}
    updates = {k: v for k, v in fields.items() if k in allowed}
    if not updates:
        return
    sets = ", ".join(f"{k} = ?" for k in updates)
    vals = list(updates.values()) + [conversation_id]
    await db.execute(f"UPDATE conversations SET {sets} WHERE id = ?", vals)
    await db.commit()


async def fork_conversation(db: aiosqlite.Connection, conversation_id: str, up_to_message_id: str) -> dict:
    conv = await get_conversation(db, conversation_id)
    if not conv:
        raise ValueError("Conversation not found")

    msg_row = await db.execute_fetchall(
        "SELECT created_at FROM messages WHERE id = ?", (up_to_message_id,)
    )
    if not msg_row:
        raise ValueError("Message not found")
    cutoff = msg_row[0][0]

    new_id = uuid.uuid4().hex[:12]
    now = _now()
    title = f"{conv['title']} (fork)"
    await db.execute(
        "INSERT INTO conversations (id, title, project_id, mode, model_id, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        (new_id, title, conv.get("project_id"), conv.get("mode", "auto"), conv.get("model_id"), now),
    )

    messages = await db.execute_fetchall(
        "SELECT role, text, answered_by, latency_ms, tokens_in, tokens_out, cost_usd FROM messages WHERE conversation_id = ? AND created_at <= ? ORDER BY created_at ASC",
        (conversation_id, cutoff),
    )
    for msg in messages:
        mid = uuid.uuid4().hex[:16]
        await db.execute(
            "INSERT INTO messages (id, conversation_id, role, text, answered_by, latency_ms, tokens_in, tokens_out, cost_usd, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (mid, new_id, msg[0], msg[1], msg[2], msg[3], msg[4], msg[5], msg[6], _now()),
        )

    await db.commit()
    return {"id": new_id, "title": title, "project_id": conv.get("project_id"), "mode": conv.get("mode", "auto"), "created_at": now}


async def delete_conversation(db: aiosqlite.Connection, conversation_id: str) -> None:
    await db.execute("DELETE FROM conversations WHERE id = ?", (conversation_id,))
    await db.commit()
