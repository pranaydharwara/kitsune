"""Claude CLI connector — streams responses via `claude -p --output-format stream-json`."""

import asyncio
import json
import shutil
from collections.abc import AsyncIterator

from core.connectors.base import Chunk, Prompt, Status, Usage


class ClaudeCliConnector:
    id = "claude"
    max_context_tokens = 200_000

    def __init__(self, model: str = "sonnet"):
        self.model = model
        self._bin = shutil.which("claude")

    def available(self) -> Status:
        if not self._bin:
            return Status.UNAVAILABLE
        return Status.READY

    async def stream(self, prompt: Prompt) -> AsyncIterator[Chunk]:
        if not self._bin:
            raise RuntimeError("claude CLI not found. Install with: npm install -g @anthropic-ai/claude-code")

        cmd = [
            self._bin,
            "-p", prompt.text,
            "--output-format", "stream-json",
            "--model", self.model,
            "--no-tool-use",
        ]
        if prompt.system:
            cmd.extend(["--system-prompt", prompt.system])

        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )

        try:
            async for line in proc.stdout:
                line = line.decode().strip()
                if not line:
                    continue
                try:
                    event = json.loads(line)
                except json.JSONDecodeError:
                    continue

                etype = event.get("type", "")

                if etype == "assistant" and event.get("subtype") == "text":
                    yield Chunk(text=event.get("content", ""))

                elif etype == "result":
                    trailing = event.get("result", "")
                    if trailing:
                        yield Chunk(text="", done=True)
                    else:
                        yield Chunk(text="", done=True)

        finally:
            if proc.returncode is None:
                proc.terminate()
                await proc.wait()
