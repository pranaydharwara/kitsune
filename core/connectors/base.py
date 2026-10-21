from collections.abc import AsyncIterator
from dataclasses import dataclass
from enum import Enum
from typing import Protocol


class Status(Enum):
    READY = "ready"
    UNAVAILABLE = "unavailable"
    RATE_LIMITED = "rate_limited"


@dataclass
class Chunk:
    text: str
    done: bool = False


@dataclass
class Usage:
    tokens_in: int | None = None
    tokens_out: int | None = None
    cost_usd: float | None = None


@dataclass
class Prompt:
    text: str
    system: str | None = None


class Connector(Protocol):
    id: str
    max_context_tokens: int

    def available(self) -> Status: ...
    async def stream(self, prompt: Prompt) -> AsyncIterator[Chunk]: ...
