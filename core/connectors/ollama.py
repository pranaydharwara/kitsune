import json
from collections.abc import AsyncIterator

import httpx

from core.config import MAIN_MODEL, OLLAMA_BASE_URL
from core.connectors.base import Chunk, Prompt, Status, Usage


class OllamaConnector:
    id = "ollama"
    max_context_tokens = 32_000

    def __init__(self, model: str = MAIN_MODEL, base_url: str = OLLAMA_BASE_URL, http: httpx.AsyncClient | None = None):
        self.model = model
        self.base_url = base_url
        self._http = http

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
        if prompt.messages:
            messages = []
            if prompt.system:
                messages.append({"role": "system", "content": prompt.system})
            messages.extend(prompt.messages)
        else:
            messages = []
            if prompt.system:
                messages.append({"role": "system", "content": prompt.system})
            messages.append({"role": "user", "content": prompt.text})

        client = self._http or httpx.AsyncClient(base_url=self.base_url, timeout=120)
        owns_client = self._http is None
        try:
            async with client.stream(
                "POST",
                "/api/chat",
                json={
                    "model": self.model,
                    "messages": messages,
                    "stream": True,
                    "keep_alive": "5m",
                },
            ) as resp:
                resp.raise_for_status()
                async for line in resp.aiter_lines():
                    if not line:
                        continue
                    data = json.loads(line)
                    msg = data.get("message", {})
                    text = msg.get("content", "")
                    done = data.get("done", False)
                    if text or done:
                        yield Chunk(text=text, done=done)
        finally:
            if owns_client:
                await client.aclose()

    def usage(self, final_event: dict) -> Usage | None:
        if not final_event:
            return None
        return Usage(
            tokens_in=final_event.get("prompt_eval_count"),
            tokens_out=final_event.get("eval_count"),
        )
