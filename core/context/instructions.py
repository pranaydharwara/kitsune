"""Project-level instructions from .kitsune.md files.

Looks for .kitsune.md in the project root — custom instructions that
get prepended to the system prompt for every message in that project.
Similar to .cursorrules or CLAUDE.md.
"""

from pathlib import Path

INSTRUCTION_FILES = [".kitsune.md", "KITSUNE.md", ".cursorrules", "CLAUDE.md"]
MAX_INSTRUCTION_CHARS = 4000


def load_project_instructions(project_path: str) -> str | None:
    """Load project instructions from the first matching file."""
    root = Path(project_path)
    if not root.is_dir():
        return None

    for fname in INSTRUCTION_FILES:
        fpath = root / fname
        if fpath.is_file():
            try:
                text = fpath.read_text(encoding="utf-8", errors="replace").strip()
                if not text:
                    continue
                if len(text) > MAX_INSTRUCTION_CHARS:
                    text = text[:MAX_INSTRUCTION_CHARS] + "\n... (truncated)"
                return text
            except (OSError, UnicodeDecodeError):
                continue

    return None
