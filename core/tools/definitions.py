"""Tool definitions and execution for agentic file operations."""

import json
import os
import subprocess
from pathlib import Path

TOOL_SCHEMAS = [
    {
        "type": "function",
        "function": {
            "name": "create_file",
            "description": "Create or overwrite a file in the project directory. Use this when the user asks you to create, write, or make a file.",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {
                        "type": "string",
                        "description": "File path relative to the project root (e.g. 'tests/test_server.py' or 'src/utils.js')",
                    },
                    "content": {
                        "type": "string",
                        "description": "The full content to write to the file",
                    },
                },
                "required": ["path", "content"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "read_file",
            "description": "Read the contents of a file in the project directory.",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {
                        "type": "string",
                        "description": "File path relative to the project root",
                    },
                },
                "required": ["path"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "list_files",
            "description": "List files and directories at a path in the project.",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {
                        "type": "string",
                        "description": "Directory path relative to project root. Use '.' for the root.",
                    },
                },
                "required": ["path"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "run_command",
            "description": "Run a shell command in the project directory. Use for installing packages, running tests, or other CLI tasks.",
            "parameters": {
                "type": "object",
                "properties": {
                    "command": {
                        "type": "string",
                        "description": "The shell command to run",
                    },
                },
                "required": ["command"],
            },
        },
    },
]

IGNORE_DIRS = {".git", "node_modules", "__pycache__", ".venv", "venv", "target", "dist", "build", ".next"}
MAX_READ_CHARS = 50_000
MAX_LIST_ENTRIES = 200
COMMAND_TIMEOUT = 30


def _safe_path(project_root: str, relative: str) -> Path | None:
    root = Path(project_root).resolve()
    target = (root / relative).resolve()
    if not str(target).startswith(str(root)):
        return None
    return target


def execute_tool(name: str, arguments: dict, project_path: str) -> dict:
    if name == "create_file":
        return _create_file(project_path, arguments.get("path", ""), arguments.get("content", ""))
    elif name == "read_file":
        return _read_file(project_path, arguments.get("path", ""))
    elif name == "list_files":
        return _list_files(project_path, arguments.get("path", "."))
    elif name == "run_command":
        return _run_command(project_path, arguments.get("command", ""))
    else:
        return {"error": f"Unknown tool: {name}"}


def _create_file(project_root: str, path: str, content: str) -> dict:
    target = _safe_path(project_root, path)
    if not target:
        return {"error": "Path escapes project directory"}
    try:
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content, encoding="utf-8")
        return {"success": True, "path": path, "size": len(content)}
    except Exception as e:
        return {"error": str(e)}


def _read_file(project_root: str, path: str) -> dict:
    target = _safe_path(project_root, path)
    if not target:
        return {"error": "Path escapes project directory"}
    if not target.is_file():
        return {"error": f"File not found: {path}"}
    try:
        text = target.read_text(encoding="utf-8", errors="replace")
        if len(text) > MAX_READ_CHARS:
            text = text[:MAX_READ_CHARS] + f"\n... (truncated, {len(text)} chars total)"
        return {"content": text, "path": path, "size": len(text)}
    except Exception as e:
        return {"error": str(e)}


def _list_files(project_root: str, path: str) -> dict:
    target = _safe_path(project_root, path)
    if not target:
        return {"error": "Path escapes project directory"}
    if not target.is_dir():
        return {"error": f"Not a directory: {path}"}
    try:
        entries = []
        for item in sorted(target.iterdir(), key=lambda p: (not p.is_dir(), p.name.lower())):
            if item.name in IGNORE_DIRS or item.name.startswith("."):
                continue
            if len(entries) >= MAX_LIST_ENTRIES:
                entries.append("... (more files)")
                break
            suffix = "/" if item.is_dir() else ""
            entries.append(f"{item.name}{suffix}")
        return {"entries": entries, "path": path, "count": len(entries)}
    except Exception as e:
        return {"error": str(e)}


def _run_command(project_root: str, command: str) -> dict:
    blocked = ["rm -rf /", "rm -rf ~", "sudo", "mkfs", "dd if="]
    for b in blocked:
        if b in command:
            return {"error": f"Blocked dangerous command pattern: {b}"}
    try:
        result = subprocess.run(
            command,
            shell=True,
            cwd=project_root,
            capture_output=True,
            text=True,
            timeout=COMMAND_TIMEOUT,
            env={**os.environ, "PATH": os.environ.get("PATH", "")},
        )
        output = result.stdout
        if result.stderr:
            output += ("\n" if output else "") + result.stderr
        if len(output) > MAX_READ_CHARS:
            output = output[:MAX_READ_CHARS] + "\n... (truncated)"
        return {"output": output, "exit_code": result.returncode}
    except subprocess.TimeoutExpired:
        return {"error": f"Command timed out after {COMMAND_TIMEOUT}s"}
    except Exception as e:
        return {"error": str(e)}
