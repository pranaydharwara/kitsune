"""API endpoints for codebase indexing, search, and @-mention autocomplete."""

from fastapi import APIRouter, Request
from pydantic import BaseModel

from core.context.indexer import get_or_build_index, invalidate_index
from core.context.mentions import get_mention_completions
from core.store.projects import get_project

router = APIRouter(prefix="/api")


class SearchRequest(BaseModel):
    project_id: str
    query: str
    limit: int = 20


@router.post("/search/files")
async def search_files(req: SearchRequest, request: Request):
    pool = request.app.state.db_pool
    async with pool.acquire() as db:
        proj = await get_project(db, req.project_id)
    if not proj:
        return {"results": [], "error": "Project not found"}

    idx = get_or_build_index(proj["path"])
    results = idx.search(req.query, limit=req.limit)
    return {
        "results": [
            {"path": r.path, "name": r.name, "ext": r.ext, "size": r.size, "is_dir": r.is_dir}
            for r in results
        ]
    }


class ContentSearchRequest(BaseModel):
    project_id: str
    query: str
    limit: int = 10


@router.post("/search/content")
async def search_content(req: ContentSearchRequest, request: Request):
    pool = request.app.state.db_pool
    async with pool.acquire() as db:
        proj = await get_project(db, req.project_id)
    if not proj:
        return {"results": [], "error": "Project not found"}

    idx = get_or_build_index(proj["path"])
    results = idx.search_content(req.query, limit=req.limit)
    return {"results": results}


class MentionCompleteRequest(BaseModel):
    project_id: str | None = None
    query: str


@router.post("/mentions/complete")
async def mention_completions(req: MentionCompleteRequest, request: Request):
    project_path = None
    if req.project_id:
        pool = request.app.state.db_pool
        async with pool.acquire() as db:
            proj = await get_project(db, req.project_id)
            if proj:
                project_path = proj["path"]

    completions = get_mention_completions(req.query, project_path)
    return {"completions": completions}


@router.post("/index/rebuild")
async def rebuild_index(req: SearchRequest, request: Request):
    pool = request.app.state.db_pool
    async with pool.acquire() as db:
        proj = await get_project(db, req.project_id)
    if not proj:
        return {"ok": False, "error": "Project not found"}

    invalidate_index(proj["path"])
    idx = get_or_build_index(proj["path"])
    file_count = sum(1 for f in idx.files if not f.is_dir)
    dir_count = sum(1 for f in idx.files if f.is_dir)
    return {"ok": True, "files": file_count, "directories": dir_count}
