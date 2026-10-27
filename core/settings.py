"""Settings manager — reads/writes ~/.kitsune/settings.json."""

import json
from pathlib import Path
from typing import Any

from core.config import KITSUNE_DIR

SETTINGS_PATH = KITSUNE_DIR / "settings.json"

DEFAULTS: dict[str, Any] = {
    "anthropic_api_key": "",
    "default_mode": "auto",
    "default_model": None,
    "theme": "system",
}

_cache: dict[str, Any] | None = None


def load() -> dict[str, Any]:
    global _cache
    if _cache is not None:
        return _cache
    if SETTINGS_PATH.exists():
        try:
            data = json.loads(SETTINGS_PATH.read_text())
        except (json.JSONDecodeError, OSError):
            data = {}
    else:
        data = {}
    _cache = {**DEFAULTS, **data}
    return _cache


def save(updates: dict[str, Any]) -> dict[str, Any]:
    global _cache
    current = load()
    current.update(updates)
    _cache = current
    KITSUNE_DIR.mkdir(parents=True, exist_ok=True)
    SETTINGS_PATH.write_text(json.dumps(current, indent=2) + "\n")
    return current


def get(key: str) -> Any:
    return load().get(key, DEFAULTS.get(key))


def invalidate():
    global _cache
    _cache = None
