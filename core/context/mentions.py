"""@-mention parsing and resolution for chat messages.

Supported mentions:
  @file path/to/file.py    — include file contents in context
  @folder path/to/dir      — include directory listing in context
  @errors                   — include recent tool errors in context
"""

import re
from pathlib import Path

from core.context.indexer import get_or_build_index

_MENTION_RE = re.compile(
    r"@(file|folder)\s+(\S+)",
    re.IGNORECASE,
)

_ERRORS_RE = re.compile(r"@errors\b", re.IGNORECASE)

MAX_FILE_CHARS = 8000
MAX_FOLDER_ENTRIES = 50


def parse_mentions(text: str) -> list[dict]:
    """Extract @mentions from message text. Returns list of {type, arg, start, end}."""
    mentions = []

    for m in _MENTION_RE.finditer(text):
        mentions.append({
            "type": m.group(1).lower(),
            "arg": m.group(2),
            "start": m.start(),
            "end": m.end(),
        })

    for m in _ERRORS_RE.finditer(text):
        if not any(men["start"] == m.start() for men in mentions):
            mentions.append({
                "type": "errors",
                "arg": "",
                "start": m.start(),
                "end": m.end(),
            })

    return mentions


def resolve_mentions(text: str, project_path: str | None, recent_errors: list[str] | None = None) -> dict:
    """Resolve @mentions in a message. Returns {clean_text, context_parts, resolved}."""
    mentions = parse_mentions(text)
    if not mentions:
        return {"clean_text": text, "context_parts": [], "resolved": []}

    context_parts = []
    resolved = []
    clean_text = text

    for mention in sorted(mentions, key=lambda m: m["start"], reverse=True):
        mtype = mention["type"]
        arg = mention["arg"]
        result = None

        if mtype == "file" and project_path:
            result = _resolve_file(project_path, arg)
        elif mtype == "folder" and project_path:
            result = _resolve_folder(project_path, arg)
        elif mtype == "errors":
            result = _resolve_errors(recent_errors)

        if result:
            context_parts.append(result)
            resolved.append({**mention, "status": "ok"})
            clean_text = clean_text[:mention["start"]] + clean_text[mention["end"]:]
        else:
            resolved.append({**mention, "status": "not_found"})

    clean_text = re.sub(r"\s{2,}", " ", clean_text).strip()
    return {"clean_text": clean_text, "context_parts": context_parts, "resolved": resolved}


def _resolve_file(project_path: str, file_path: str) -> str | None:
    idx = get_or_build_index(project_path)
    content = idx.get_file_content(file_path)
    if not content:
        return None

    if len(content) > MAX_FILE_CHARS:
        content = content[:MAX_FILE_CHARS] + f"\n... (truncated, file is longer)"

    return f"## File: {file_path}\n```\n{content}\n```"


def _resolve_folder(project_path: str, folder_path: str) -> str | None:
    root = Path(project_path)
    target = (root / folder_path).resolve()
    if not str(target).startswith(str(root.resolve())):
        return None
    if not target.is_dir():
        return None

    idx = get_or_build_index(project_path)
    entries = idx.list_dir(folder_path)
    if not entries:
        return None

    lines = []
    for e in entries[:MAX_FOLDER_ENTRIES]:
        suffix = "/" if e.is_dir else ""
        lines.append(f"  {e.name}{suffix}")
    if len(entries) > MAX_FOLDER_ENTRIES:
        lines.append(f"  ... ({len(entries)} total)")

    return f"## Folder: {folder_path}\n```\n" + "\n".join(lines) + "\n```"


def _resolve_errors(recent_errors: list[str] | None) -> str | None:
    if not recent_errors:
        return None
    formatted = "\n".join(f"- {e}" for e in recent_errors[-10:])
    return f"## Recent Errors\n{formatted}"


def get_mention_completions(query: str, project_path: str | None) -> list[dict]:
    """Get autocomplete suggestions for @mentions. Returns [{type, value, label}]."""
    completions = []

    if not query:
        completions.extend([
            {"type": "keyword", "value": "@file ", "label": "@file — include a file"},
            {"type": "keyword", "value": "@folder ", "label": "@folder — include a directory"},
            {"type": "keyword", "value": "@errors", "label": "@errors — include recent errors"},
        ])
        return completions

    q_lower = query.lower()

    if q_lower.startswith("@file ") and project_path:
        search_term = query[6:].strip()
        idx = get_or_build_index(project_path)
        results = idx.search(search_term, limit=10)
        for r in results:
            completions.append({
                "type": "file",
                "value": f"@file {r.path}",
                "label": r.path,
                "detail": f"{r.size} bytes" if r.size else "",
            })

    elif q_lower.startswith("@folder ") and project_path:
        search_term = query[8:].strip()
        idx = get_or_build_index(project_path)
        results = idx.search(search_term, limit=10)
        for r in results:
            if r.is_dir:
                completions.append({
                    "type": "folder",
                    "value": f"@folder {r.path}",
                    "label": r.path + "/",
                })

    elif q_lower.startswith("@"):
        for kw in ["file", "folder", "errors"]:
            if kw.startswith(q_lower[1:]):
                completions.append({
                    "type": "keyword",
                    "value": f"@{kw} " if kw != "errors" else f"@{kw}",
                    "label": f"@{kw}",
                })

    return completions
