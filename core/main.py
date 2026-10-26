import asyncio
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from core.api.chat import router as chat_router
from core.api.conversations import router as conversations_router
from core.config import DEFAULT_PORT
from core.store.db import get_db

STATIC_DIR = Path(__file__).parent / "static"


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.db = await get_db()
    yield
    await app.state.db.close()


app = FastAPI(title="Kitsune Core", version="0.1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(chat_router)
app.include_router(conversations_router)


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
