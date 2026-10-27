import asyncio
from contextlib import asynccontextmanager
from pathlib import Path

import httpx
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from core.api.chat import router as chat_router
from core.api.conversations import router as conversations_router
from core.api.settings import router as settings_router
from core.config import DEFAULT_PORT, MAIN_MODEL, OLLAMA_BASE_URL
from core.store.db import DBPool

STATIC_DIR = Path(__file__).parent / "static"


async def _warm_model(http: httpx.AsyncClient):
    try:
        await http.post("/api/chat", json={
            "model": MAIN_MODEL, "messages": [], "keep_alive": "5m",
        }, timeout=10)
    except Exception:
        pass


@asynccontextmanager
async def lifespan(app: FastAPI):
    pool = DBPool(size=4)
    await pool.init()
    app.state.db_pool = pool
    app.state.http = httpx.AsyncClient(base_url=OLLAMA_BASE_URL, timeout=120)
    asyncio.get_event_loop().create_task(_warm_model(app.state.http))
    yield
    await app.state.http.aclose()
    await pool.close()


app = FastAPI(title="Kitsune Core", version="0.1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(chat_router)
app.include_router(conversations_router)
app.include_router(settings_router)


@app.get("/api/health")
async def health():
    return {"status": "ok", "version": "0.1.0"}


if STATIC_DIR.exists() and any(STATIC_DIR.iterdir()):
    app.mount("/", StaticFiles(directory=str(STATIC_DIR), html=True), name="ui")


def cli():
    import uvicorn

    uvicorn.run("core.main:app", host="127.0.0.1", port=DEFAULT_PORT, reload=True)


if __name__ == "__main__":
    cli()
