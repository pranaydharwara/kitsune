"""Claude CLI connector — streams responses via `claude -p --output-format stream-json`."""

import asyncio
import json
import shutil
from collections.abc import AsyncIterator

from core.connectors.base import Chunk, Prompt, Status, Usage


class ClaudeCliConnector:
    id = "claude"
    max_context_tokens = 200_000
    last_usage: Usage | None = None

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
            "--verbose",
            "--model", self.model,
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

                if etype == "assistant":
                    # Check for auth errors
                    if event.get("error") == "authentication_failed":
                        msg = event.get("message", {})
                        content = msg.get("content", [])
                        error_text = ""
                        for block in content:
                            if block.get("type") == "text":
                                error_text = block.get("text", "")
                        raise RuntimeError(f"Claude auth failed: {error_text}. Run `claude` in your terminal to log in.")

                    # Extract text content from assistant messages
                    msg = event.get("message", {})
                    content = msg.get("content", [])
                    for block in content:
                        if block.get("type") == "text":
                            text = block.get("text", "")
                            if text:
                                yield Chunk(text=text)

                elif etype == "content_block_delta":
                    delta = event.get("delta", {})
                    if delta.get("type") == "text_delta":
                        text = delta.get("text", "")
                        if text:
                            yield Chunk(text=text)

                elif etype == "result":
                    if event.get("is_error"):
                        raise RuntimeError(event.get("result", "Claude returned an error"))
                    usage = event.get("usage", {})
                    if usage:
                        self.last_usage = Usage(
                            tokens_in=usage.get("input_tokens"),
                            tokens_out=usage.get("output_tokens"),
                        )
                    yield Chunk(text="", done=True)

        finally:
            if proc.returncode is None:
                proc.terminate()
                await proc.wait()
