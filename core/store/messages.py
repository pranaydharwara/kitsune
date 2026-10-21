import uuid
from datetime import datetime, timezone

import aiosqlite


def _now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%fZ")


async def add_message(
    db: aiosqlite.Connection,
    conversation_id: str,
    role: str,
    text: str,
    answered_by: str | None = None,
    latency_ms: int | None = None,
) -> dict:
    mid = uuid.uuid4().hex[:16]
    now = _now()
    await db.execute(
        """INSERT INTO messages (id, conversation_id, role, text, answered_by, latency_ms, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)""",
        (mid, conversation_id, role, text, answered_by, latency_ms, now),
    )
    await db.commit()
    return {
        "id": mid,
        "conversation_id": conversation_id,
        "role": role,
        "text": text,
        "answered_by": answered_by,
        "latency_ms": latency_ms,
        "created_at": now,
    }


async def get_messages(
    db: aiosqlite.Connection, conversation_id: str, limit: int = 100
) -> list[dict]:
    rows = await db.execute_fetchall(
        """SELECT * FROM messages WHERE conversation_id = ?
           ORDER BY created_at ASC LIMIT ?""",
        (conversation_id, limit),
    )
    return [dict(r) for r in rows]


async def update_message(db: aiosqlite.Connection, message_id: str, **fields) -> None:
    allowed = {"text", "answered_by", "latency_ms", "tokens_in", "tokens_out", "cost_usd"}
    updates = {k: v for k, v in fields.items() if k in allowed}
    if not updates:
        return
    sets = ", ".join(f"{k} = ?" for k in updates)
    vals = list(updates.values()) + [message_id]
    await db.execute(f"UPDATE messages SET {sets} WHERE id = ?", vals)
    await db.commit()
