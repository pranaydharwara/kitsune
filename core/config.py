from pathlib import Path

KITSUNE_DIR = Path.home() / ".kitsune"
DB_PATH = KITSUNE_DIR / "kitsune.db"
DEFAULT_PORT = 9848
OLLAMA_BASE_URL = "http://localhost:11434"
MAIN_MODEL = "qwen3:30b-a3b"
CLASSIFIER_MODEL = "qwen3:4b"
CODE_MODEL = "qwen3-coder:30b-a3b"
CLAUDE_MODELS = [
    {"id": "sonnet-5-5", "cli": "claude-sonnet-5-5", "name": "Sonnet 5.5", "family": "Claude 5"},
    {"id": "opus-5-5", "cli": "claude-opus-5-5", "name": "Opus 5.5", "family": "Claude 5"},
    {"id": "haiku-5-5", "cli": "claude-haiku-5-5", "name": "Haiku 5.5", "family": "Claude 5"},
    {"id": "opus-4-6", "cli": "claude-opus-4-6", "name": "Opus 4.6", "family": "Claude 4"},
    {"id": "sonnet-4-5", "cli": "claude-sonnet-4-5", "name": "Sonnet 4.5", "family": "Claude 4"},
    {"id": "sonnet-4", "cli": "claude-sonnet-4-20250514", "name": "Sonnet 4", "family": "Claude 4"},
    {"id": "haiku-3-5", "cli": "claude-haiku-3-5-20241022", "name": "Haiku 3.5", "family": "Claude 3.5"},
]

CLAUDE_HANDOFF_BUDGET = 24_000
LOCAL_HANDOFF_BUDGET = 12_000
PR_DASHBOARD_URL = "http://localhost:9847"
