"""Classifier — small local model scores message complexity and domain."""

import json
import logging
import time

import httpx

from core.config import CLASSIFIER_MODEL, OLLAMA_BASE_URL

log = logging.getLogger(__name__)

CLASSIFY_TIMEOUT = 5.0

SCHEMA = {
    "type": "object",
    "properties": {
        "complexity": {"type": "integer", "minimum": 1, "maximum": 5},
        "domain": {"type": "string", "enum": ["general", "code", "writing", "data"]},
    },
    "required": ["complexity", "domain"],
}

SYSTEM_PROMPT = """\
You are a message classifier for an AI chat app. Given a user message, output JSON with:
- complexity: 1-5 integer
  1 = chit-chat, greeting, simple lookup
  2 = simple rewrite, summary, short answer
  3 = explain, debug, moderate reasoning
  4 = multi-step reasoning, real code changes, design
  5 = architecture, long research, security audit
- domain: one of "general", "code", "writing", "data"

Examples:
User: "hello!"
{"complexity": 1, "domain": "general"}

User: "summarise this paragraph for me"
{"complexity": 2, "domain": "writing"}

User: "what does this error mean? TypeError: cannot read property of undefined"
{"complexity": 3, "domain": "code"}

User: "refactor this function to use async/await and add error handling"
{"complexity": 4, "domain": "code"}

User: "design a microservices architecture for an e-commerce platform with event sourcing"
{"complexity": 5, "domain": "code"}

User: "write me a cover letter for a software engineer role"
{"complexity": 3, "domain": "writing"}

User: "analyze this CSV data and find trends"
{"complexity": 3, "domain": "data"}

User: "build a dashboard showing sales by region with filtering"
{"complexity": 4, "domain": "data"}

User: "compare the pros and cons of React vs Vue for our new project"
{"complexity": 4, "domain": "code"}

User: "fix this typo: teh -> the"
{"complexity": 1, "domain": "writing"}

Now classify the following message."""


async def classify(text: str) -> dict | None:
    """Classify a message, returning {"complexity": int, "domain": str} or None on failure."""
    start = time.monotonic()
    try:
        async with httpx.AsyncClient(base_url=OLLAMA_BASE_URL, timeout=CLASSIFY_TIMEOUT) as client:
            resp = await client.post(
                "/api/generate",
                json={
                    "model": CLASSIFIER_MODEL,
                    "system": SYSTEM_PROMPT,
                    "prompt": f'User: "{text}"',
                    "stream": False,
                    "format": SCHEMA,
                    "keep_alive": "-1",
                },
            )
            resp.raise_for_status()
            raw = resp.json().get("response", "").strip()
            result = json.loads(raw)

            complexity = int(result.get("complexity", 0))
            domain = result.get("domain", "general")
            if not 1 <= complexity <= 5:
                complexity = max(1, min(5, complexity))
            if domain not in ("general", "code", "writing", "data"):
                domain = "general"

            elapsed = (time.monotonic() - start) * 1000
            log.info("Classifier: complexity=%d domain=%s (%.0fms)", complexity, domain, elapsed)
            return {"complexity": complexity, "domain": domain}

    except Exception:
        elapsed = (time.monotonic() - start) * 1000
        log.warning("Classifier failed (%.0fms), falling back to heuristics", elapsed, exc_info=True)
        return None
