from pathlib import Path

KITSUNE_DIR = Path.home() / ".kitsune"
DB_PATH = KITSUNE_DIR / "kitsune.db"
DEFAULT_PORT = 9848
OLLAMA_BASE_URL = "http://localhost:11434"
MAIN_MODEL = "qwen3:30b-a3b"
CLASSIFIER_MODEL = "qwen3:4b"
CODE_MODEL = "qwen3-coder:30b-a3b"
CLAUDE_MODELS = [
    {"id": "claude-opus-4-6", "name": "Opus 4.6", "family": "claude-4"},
    {"id": "claude-sonnet-4-5", "name": "Sonnet 4.5", "family": "claude-4"},
    {"id": "claude-sonnet-4-0", "name": "Sonnet 4", "family": "claude-4"},
    {"id": "claude-opus-4-0", "name": "Opus 4", "family": "claude-4"},
    {"id": "claude-haiku-3-5", "name": "Haiku 3.5", "family": "claude-3.5"},
]

CLAUDE_HANDOFF_BUDGET = 24_000
LOCAL_HANDOFF_BUDGET = 12_000
PR_DASHBOARD_URL = "http://localhost:9847"
