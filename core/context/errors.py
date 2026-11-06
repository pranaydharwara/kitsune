"""Collect and track errors from tool executions for auto-error detection.

Watches tool results for failures and build/lint errors, and offers them
as context to the AI so it can suggest fixes proactively.
"""

from collections import deque

MAX_ERRORS = 20


class ErrorCollector:
    """Per-conversation error tracker."""

    def __init__(self) -> None:
        self._errors: deque[dict] = deque(maxlen=MAX_ERRORS)

    def record_tool_error(self, tool_name: str, arguments: dict, error: str) -> None:
        self._errors.append({
            "source": "tool",
            "tool": tool_name,
            "detail": _summarize_args(tool_name, arguments),
            "error": error[:500],
        })

    def record_command_error(self, command: str, exit_code: int, output: str) -> None:
        self._errors.append({
            "source": "command",
            "tool": "run_command",
            "detail": command[:200],
            "error": _extract_error_lines(output)[:500],
            "exit_code": exit_code,
        })

    def get_recent(self, limit: int = 10) -> list[str]:
        """Get recent errors as formatted strings for injection into context."""
        results = []
        for e in list(self._errors)[-limit:]:
            if e["source"] == "command":
                results.append(f"`{e['detail']}` exited {e.get('exit_code', '?')}: {e['error']}")
            else:
                results.append(f"{e['tool']}({e['detail']}): {e['error']}")
        return results

    def has_errors(self) -> bool:
        return len(self._errors) > 0

    def clear(self) -> None:
        self._errors.clear()


def _summarize_args(tool_name: str, arguments: dict) -> str:
    if tool_name == "create_file" or tool_name == "read_file":
        return arguments.get("path", "?")
    if tool_name == "run_command":
        return arguments.get("command", "?")[:100]
    if tool_name == "list_files":
        return arguments.get("path", ".")
    return str(arguments)[:100]


def _extract_error_lines(output: str) -> str:
    """Extract the most relevant error lines from command output."""
    lines = output.strip().splitlines()
    error_lines = []
    keywords = ("error", "Error", "ERROR", "failed", "Failed", "FAILED",
                "Traceback", "Exception", "panic", "PANIC", "fatal", "Fatal")

    for i, line in enumerate(lines):
        if any(kw in line for kw in keywords):
            start = max(0, i - 1)
            end = min(len(lines), i + 3)
            error_lines.extend(lines[start:end])
            break

    if error_lines:
        return "\n".join(error_lines)
    if lines:
        return "\n".join(lines[-5:])
    return output[:300]


# Per-conversation error collectors
_collectors: dict[str, ErrorCollector] = {}


def get_collector(conversation_id: str) -> ErrorCollector:
    if conversation_id not in _collectors:
        _collectors[conversation_id] = ErrorCollector()
    return _collectors[conversation_id]


def clear_collector(conversation_id: str) -> None:
    _collectors.pop(conversation_id, None)
