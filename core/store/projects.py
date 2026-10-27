"""CRUD for projects — folders or repos that group conversations."""

import uuid
from datetime import datetime, timezone
from pathlib import Path

import aiosqlite


def _now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%fZ")


def _derive_name(path: str) -> str:
    p = Path(path)
    return p.name or path


async def create_project(db: aiosqlite.Connection, path: str, name: str | None = None) -> dict:
    pid = uuid.uuid4().hex[:12]
    now = _now()
    display_name = name or _derive_name(path)
    await db.execute(
        "INSERT INTO projects (id, name, path, created_at) VALUES (?, ?, ?, ?)",
        (pid, display_name, path, now),
    )
    await db.commit()
    return {"id": pid, "name": display_name, "path": path, "icon": None, "created_at": now}


async def list_projects(db: aiosqlite.Connection) -> list[dict]:
    rows = await db.execute_fetchall(
        """SELECT p.*, COUNT(c.id) as conversation_count
           FROM projects p
           LEFT JOIN conversations c ON c.project_id = p.id
           GROUP BY p.id
           ORDER BY p.name COLLATE NOCASE"""
    )
    return [dict(r) for r in rows]


async def get_project(db: aiosqlite.Connection, project_id: str) -> dict | None:
    rows = await db.execute_fetchall("SELECT * FROM projects WHERE id = ?", (project_id,))
    return dict(rows[0]) if rows else None


async def update_project(db: aiosqlite.Connection, project_id: str, **fields) -> None:
    allowed = {"name", "path", "icon"}
    updates = {k: v for k, v in fields.items() if k in allowed}
    if not updates:
        return
    sets = ", ".join(f"{k} = ?" for k in updates)
    vals = list(updates.values()) + [project_id]
    await db.execute(f"UPDATE projects SET {sets} WHERE id = ?", vals)
    await db.commit()


async def delete_project(db: aiosqlite.Connection, project_id: str) -> None:
    await db.execute("DELETE FROM projects WHERE id = ?", (project_id,))
    await db.commit()
