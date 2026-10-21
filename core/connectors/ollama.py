from collections.abc import AsyncIterator

import httpx

from core.config import MAIN_MODEL, OLLAMA_BASE_URL
from core.connectors.base import Chunk, Prompt, Status, Usage


class OllamaConnector:
    id = "ollama"
    max_context_tokens = 32_000

    def __init__(self, model: str = MAIN_MODEL, base_url: str = OLLAMA_BASE_URL):
        self.model = model
        self.base_url = base_url

    def available(self) -> Status:
        try:
            r = httpx.get(f"{self.base_url}/api/tags", timeout=2)
            if r.status_code == 200:
                models = [m["name"] for m in r.json().get("models", [])]
                if any(self.model in m for m in models):
                    return Status.READY
            return Status.UNAVAILABLE
        except (httpx.ConnectError, httpx.TimeoutException):
            return Status.UNAVAILABLE

    async def stream(self, prompt: Prompt) -> AsyncIterator[Chunk]:
        messages = []
        if prompt.system:
            messages.append({"role": "system", "content": prompt.system})
        messages.append({"role": "user", "content": prompt.text})

        async with httpx.AsyncClient(base_url=self.base_url, timeout=120) as client:
            async with client.stream(
                "POST",
                "/api/chat",
                json={
                    "model": self.model,
                    "messages": messages,
                    "stream": True,
                    "keep_alive": "30s",
                },
            ) as resp:
                resp.raise_for_status()
                async for line in resp.aiter_lines():
                    if not line:
                        continue
                    import json

                    data = json.loads(line)
                    msg = data.get("message", {})
                    text = msg.get("content", "")
                    done = data.get("done", False)
                    if text or done:
                        yield Chunk(text=text, done=done)

    def usage(self, final_event: dict) -> Usage | None:
        if not final_event:
            return None
        return Usage(
            tokens_in=final_event.get("prompt_eval_count"),
            tokens_out=final_event.get("eval_count"),
        )
