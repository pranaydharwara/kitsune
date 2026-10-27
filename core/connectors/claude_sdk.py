"""Claude SDK connector — direct Anthropic API calls, no subprocess overhead."""

import os
from collections.abc import AsyncIterator

import anthropic

from core.connectors.base import Chunk, Prompt, Status


class ClaudeSdkConnector:
    id = "claude"
    max_context_tokens = 200_000

    def __init__(self, model: str = "claude-sonnet-4-20250514"):
        self.model = model
        self._client: anthropic.AsyncAnthropic | None = None

    def available(self) -> Status:
        if not os.environ.get("ANTHROPIC_API_KEY"):
            return Status.UNAVAILABLE
        return Status.READY

    def _get_client(self) -> anthropic.AsyncAnthropic:
        if self._client is None:
            self._client = anthropic.AsyncAnthropic()
        return self._client

    async def stream(self, prompt: Prompt) -> AsyncIterator[Chunk]:
        client = self._get_client()

        if prompt.messages:
            messages = []
            for m in prompt.messages:
                messages.append({"role": m["role"], "content": m["content"]})
        else:
            messages = [{"role": "user", "content": prompt.text}]

        kwargs: dict = {
            "model": self.model,
            "max_tokens": 8192,
            "messages": messages,
        }
        if prompt.system:
            kwargs["system"] = prompt.system

        async with client.messages.stream(**kwargs) as stream:
            async for text in stream.text_stream:
                yield Chunk(text=text)
        yield Chunk(text="", done=True)
