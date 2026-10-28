import json
import re
from collections.abc import AsyncIterator

import httpx

from core.config import MAIN_MODEL, OLLAMA_BASE_URL
from core.connectors.base import Chunk, Prompt, Status, Usage

_TOOL_CALL_RE = re.compile(
    r"<tool_call>\s*(\{.*?\})\s*</tool_call>",
    re.DOTALL,
)


def parse_text_tool_calls(text: str) -> list[dict] | None:
    """Extract tool calls from <tool_call> tags in model text output."""
    matches = _TOOL_CALL_RE.findall(text)
    if not matches:
        return None
    calls = []
    for raw in matches:
        try:
            parsed = json.loads(raw)
            name = parsed.get("name", "")
            arguments = parsed.get("arguments", {})
            if isinstance(arguments, str):
                arguments = json.loads(arguments)
            if name:
                calls.append({"function": {"name": name, "arguments": arguments}})
        except (json.JSONDecodeError, TypeError):
            continue
    return calls if calls else None


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

    async def chat_with_tools(self, messages: list[dict], tools: list[dict]) -> dict:
        """Non-streaming call with tools. Returns the full response message.

        Handles both structured tool_calls from Ollama and text-based
        <tool_call> tags that some models (Qwen3) emit as plain text.
        """
        client = self._http or httpx.AsyncClient(base_url=self.base_url, timeout=120)
        owns_client = self._http is None
        try:
            resp = await client.post(
                "/api/chat",
                json={
                    "model": self.model,
                    "messages": messages,
                    "tools": tools,
                    "stream": False,
                    "keep_alive": "5m",
                },
                timeout=120,
            )
            resp.raise_for_status()
            data = resp.json()
            msg = data.get("message", {})

            if not msg.get("tool_calls") and msg.get("content"):
                text_calls = parse_text_tool_calls(msg["content"])
                if text_calls:
                    msg["tool_calls"] = text_calls
                    msg["content"] = _TOOL_CALL_RE.sub("", msg["content"]).strip()

            return msg
        finally:
            if owns_client:
                await client.aclose()

    async def stream_after_tools(self, messages: list[dict]) -> AsyncIterator[Chunk]:
        """Stream a final response after tool calls are resolved (no tools param)."""
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
