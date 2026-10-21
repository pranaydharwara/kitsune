import uuid
from datetime import datetime, timezone

import aiosqlite


def _now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%fZ")


async def create_conversation(db: aiosqlite.Connection, title: str = "New chat") -> dict:
    cid = uuid.uuid4().hex[:12]
    now = _now()
    await db.execute(
        "INSERT INTO conversations (id, title, created_at) VALUES (?, ?, ?)",
        (cid, title, now),
    )
    await db.commit()
    return {"id": cid, "title": title, "mode": "auto", "escalated": False, "created_at": now}


async def list_conversations(db: aiosqlite.Connection, limit: int = 50) -> list[dict]:
    rows = await db.execute_fetchall(
        """SELECT c.id, c.title, c.mode, c.escalated, c.created_at,
                  (SELECT text FROM messages WHERE conversation_id = c.id
                   ORDER BY created_at DESC LIMIT 1) as last_message
           FROM conversations c ORDER BY c.created_at DESC LIMIT ?""",
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
    allowed = {"title", "mode", "escalated", "summary", "summary_updated_at"}
    updates = {k: v for k, v in fields.items() if k in allowed}
    if not updates:
        return
    sets = ", ".join(f"{k} = ?" for k in updates)
    vals = list(updates.values()) + [conversation_id]
    await db.execute(f"UPDATE conversations SET {sets} WHERE id = ?", vals)
    await db.commit()


async def delete_conversation(db: aiosqlite.Connection, conversation_id: str) -> None:
    await db.execute("DELETE FROM conversations WHERE id = ?", (conversation_id,))
    await db.commit()
