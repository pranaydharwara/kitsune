"""Scan a project directory and build a context string for the LLM."""

import os
from pathlib import Path

MAX_FILE_CHARS = 4000
MAX_TOTAL_CHARS = 12000
MAX_TREE_DEPTH = 3
MAX_TREE_ENTRIES = 80

KEY_FILES = [
    "README.md",
    "README.rst",
    "README.txt",
    "README",
    "package.json",
    "Cargo.toml",
    "pyproject.toml",
    "setup.py",
    "go.mod",
    "Gemfile",
    "pom.xml",
    "build.gradle",
    "Makefile",
    "CLAUDE.md",
]

IGNORE_DIRS = {
    ".git", "node_modules", "__pycache__", ".venv", "venv",
    "target", "dist", "build", ".next", ".nuxt", ".cache",
    "vendor", ".tox", "env", ".env", ".eggs", "egg-info",
}


def _read_file_safe(path: Path, max_chars: int = MAX_FILE_CHARS) -> str | None:
    try:
        text = path.read_text(encoding="utf-8", errors="replace")
        if len(text) > max_chars:
            text = text[:max_chars] + f"\n... (truncated, {len(text)} chars total)"
        return text
    except Exception:
        return None


def _dir_tree(root: Path, depth: int = 0, max_depth: int = MAX_TREE_DEPTH) -> list[str]:
    if depth > max_depth:
        return []
    entries = []
    try:
        items = sorted(root.iterdir(), key=lambda p: (not p.is_dir(), p.name.lower()))
    except PermissionError:
        return []

    for item in items:
        if item.name.startswith(".") and item.name in IGNORE_DIRS:
            continue
        if item.name in IGNORE_DIRS:
            continue
        if len(entries) >= MAX_TREE_ENTRIES:
            entries.append("  " * depth + "... (more files)")
            break
        prefix = "  " * depth
        if item.is_dir():
            entries.append(f"{prefix}{item.name}/")
            entries.extend(_dir_tree(item, depth + 1, max_depth))
        else:
            entries.append(f"{prefix}{item.name}")
    return entries


def build_project_context(project_path: str) -> str | None:
    root = Path(project_path)
    if not root.is_dir():
        return None

    parts: list[str] = []
    total = 0

    parts.append(f"Project: {root.name}")
    parts.append(f"Path: {project_path}")

    tree_lines = _dir_tree(root)
    if tree_lines:
        tree = "\n".join(tree_lines)
        section = f"\n## Directory structure\n```\n{tree}\n```"
        parts.append(section)
        total += len(section)

    for fname in KEY_FILES:
        if total >= MAX_TOTAL_CHARS:
            break
        fpath = root / fname
        if fpath.is_file():
            content = _read_file_safe(fpath, MAX_FILE_CHARS)
            if content:
                remaining = MAX_TOTAL_CHARS - total
                if len(content) > remaining:
                    content = content[:remaining] + "\n... (truncated)"
                section = f"\n## {fname}\n```\n{content}\n```"
                parts.append(section)
                total += len(section)

    if len(parts) <= 2:
        return None

    return "\n".join(parts)
