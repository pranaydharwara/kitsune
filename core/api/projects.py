from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from core.context.instructions import get_instructions_info, save_project_instructions
from core.store.projects import (
    create_project,
    delete_project,
    get_project,
    list_projects,
    update_project,
)

router = APIRouter(prefix="/api")


class ProjectCreate(BaseModel):
    path: str
    name: str | None = None


class ProjectUpdate(BaseModel):
    name: str | None = None
    icon: str | None = None


class InstructionsUpdate(BaseModel):
    content: str


@router.get("/projects")
async def list_projs(request: Request):
    async with request.app.state.db_pool.acquire() as db:
        return await list_projects(db)


@router.post("/projects")
async def create_proj(body: ProjectCreate, request: Request):
    async with request.app.state.db_pool.acquire() as db:
        return await create_project(db, path=body.path, name=body.name)


@router.get("/projects/{project_id}")
async def get_proj(project_id: str, request: Request):
    async with request.app.state.db_pool.acquire() as db:
        proj = await get_project(db, project_id)
        if not proj:
            raise HTTPException(status_code=404, detail="Project not found")
        return proj


@router.patch("/projects/{project_id}")
async def update_proj(project_id: str, body: ProjectUpdate, request: Request):
    async with request.app.state.db_pool.acquire() as db:
        fields = body.model_dump(exclude_none=True)
        await update_project(db, project_id, **fields)
        return {"ok": True}


@router.delete("/projects/{project_id}")
async def delete_proj(project_id: str, request: Request):
    async with request.app.state.db_pool.acquire() as db:
        await delete_project(db, project_id)
        return {"ok": True}


@router.get("/projects/{project_id}/instructions")
async def get_proj_instructions(project_id: str, request: Request):
    async with request.app.state.db_pool.acquire() as db:
        proj = await get_project(db, project_id)
        if not proj:
            raise HTTPException(status_code=404, detail="Project not found")
        return get_instructions_info(proj["path"])


@router.put("/projects/{project_id}/instructions")
async def set_proj_instructions(project_id: str, body: InstructionsUpdate, request: Request):
    async with request.app.state.db_pool.acquire() as db:
        proj = await get_project(db, project_id)
        if not proj:
            raise HTTPException(status_code=404, detail="Project not found")
        saved = save_project_instructions(proj["path"], body.content)
        return {"ok": True, "file": saved}
