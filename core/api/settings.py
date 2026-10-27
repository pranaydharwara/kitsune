from fastapi import APIRouter, Request
from pydantic import BaseModel

from core import settings

router = APIRouter(prefix="/api")


class SettingsUpdate(BaseModel):
    anthropic_api_key: str | None = None
    default_mode: str | None = None
    default_model: str | None = None
    theme: str | None = None


@router.get("/settings")
async def get_settings():
    data = settings.load()
    safe = {**data}
    key = safe.get("anthropic_api_key", "")
    if key:
        safe["anthropic_api_key"] = key[:8] + "..." + key[-4:] if len(key) > 16 else "***"
        safe["has_api_key"] = True
    else:
        safe["has_api_key"] = False
    return safe


@router.put("/settings")
async def update_settings(body: SettingsUpdate):
    updates = body.model_dump(exclude_none=True)
    settings.save(updates)
    settings.invalidate()
    return {"ok": True}


@router.delete("/settings/api-key")
async def clear_api_key():
    settings.save({"anthropic_api_key": ""})
    settings.invalidate()
    return {"ok": True}


@router.get("/usage")
async def get_usage(request: Request):
    async with request.app.state.db_pool.acquire() as db:
        row = await db.execute_fetchall(
            "SELECT "
            "  COUNT(*) as total_messages, "
            "  SUM(CASE WHEN answered_by LIKE 'claude:%' THEN 1 ELSE 0 END) as cloud_messages, "
            "  SUM(CASE WHEN answered_by LIKE 'local:%' THEN 1 ELSE 0 END) as local_messages, "
            "  SUM(tokens_in) as total_tokens_in, "
            "  SUM(tokens_out) as total_tokens_out, "
            "  SUM(cost_usd) as total_cost "
            "FROM messages WHERE role = 'assistant'"
        )
        stats = dict(row[0]) if row else {}
        return {k: v or 0 for k, v in stats.items()}
