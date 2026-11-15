import os
import pytest
from core.tools.definitions import (
    execute_tool, _safe_path, TOOL_SCHEMAS,
    _create_file, _edit_file, _read_file, _list_files,
    _run_command, _git_operation,
)


def test_tool_schemas_list():
    assert isinstance(TOOL_SCHEMAS, list)
    assert len(TOOL_SCHEMAS) >= 6
    names = [t["function"]["name"] for t in TOOL_SCHEMAS]
    assert "read_file" in names
    assert "create_file" in names
    assert "edit_file" in names
    assert "run_command" in names
    assert "list_files" in names


def test_safe_path_normal(tmp_path):
    result = _safe_path(str(tmp_path), "file.py")
    assert result is not None
    assert str(tmp_path) in str(result)


def test_safe_path_traversal(tmp_path):
    result = _safe_path(str(tmp_path), "../../etc/passwd")
    assert result is None


def test_safe_path_absolute_outside(tmp_path):
    result = _safe_path(str(tmp_path), "/etc/passwd")
    assert result is None


def test_create_file(tmp_path):
    result = execute_tool("create_file", {"path": "test.txt", "content": "Hello World"}, str(tmp_path))
    assert result.get("success")
    assert (tmp_path / "test.txt").read_text() == "Hello World"


def test_read_file(tmp_path):
    (tmp_path / "data.txt").write_text("Some data")
    result = execute_tool("read_file", {"path": "data.txt"}, str(tmp_path))
    assert "error" not in result
    assert "Some data" in result.get("content", "")


def test_read_file_not_found(tmp_path):
    result = execute_tool("read_file", {"path": "nonexistent.txt"}, str(tmp_path))
    assert "error" in result


def test_edit_file(tmp_path):
    (tmp_path / "edit_me.py").write_text("old_value = 1\nkeep = 2")
    result = execute_tool("edit_file", {
        "path": "edit_me.py",
        "old_string": "old_value = 1",
        "new_string": "new_value = 42",
    }, str(tmp_path))
    assert result.get("success")
    content = (tmp_path / "edit_me.py").read_text()
    assert "new_value = 42" in content


def test_edit_file_identical_strings(tmp_path):
    (tmp_path / "edit_me.py").write_text("hello world")
    result = execute_tool("edit_file", {
        "path": "edit_me.py",
        "old_string": "hello",
        "new_string": "hello",
    }, str(tmp_path))
    assert "error" in result


def test_edit_file_no_match(tmp_path):
    (tmp_path / "edit_me.py").write_text("hello world")
    result = execute_tool("edit_file", {
        "path": "edit_me.py",
        "old_string": "nonexistent text",
        "new_string": "replacement",
    }, str(tmp_path))
    assert "error" in result


def test_edit_file_multiple_matches(tmp_path):
    (tmp_path / "edit_me.py").write_text("hello hello hello")
    result = execute_tool("edit_file", {
        "path": "edit_me.py",
        "old_string": "hello",
        "new_string": "world",
    }, str(tmp_path))
    assert "error" in result
    assert "3 locations" in result["error"]


def test_edit_file_not_found(tmp_path):
    result = execute_tool("edit_file", {
        "path": "nonexist.py",
        "old_string": "a",
        "new_string": "b",
    }, str(tmp_path))
    assert "error" in result


def test_edit_file_path_escape(tmp_path):
    result = execute_tool("edit_file", {
        "path": "../../etc/passwd",
        "old_string": "a",
        "new_string": "b",
    }, str(tmp_path))
    assert "error" in result


def test_list_files(tmp_path):
    (tmp_path / "a.py").write_text("")
    (tmp_path / "b.py").write_text("")
    sub = tmp_path / "sub"
    sub.mkdir()
    (sub / "c.py").write_text("")

    result = execute_tool("list_files", {"path": "."}, str(tmp_path))
    assert "error" not in result
    entries = result.get("entries", [])
    assert len(entries) >= 2


def test_list_files_not_a_dir(tmp_path):
    (tmp_path / "file.txt").write_text("")
    result = execute_tool("list_files", {"path": "file.txt"}, str(tmp_path))
    assert "error" in result


def test_run_command(tmp_path):
    result = execute_tool("run_command", {"command": "echo hello"}, str(tmp_path))
    assert "error" not in result
    assert result.get("exit_code") == 0
    assert "hello" in result.get("output", "")


def test_run_command_blocked(tmp_path):
    result = execute_tool("run_command", {"command": "rm -rf /"}, str(tmp_path))
    assert "error" in result


def test_run_command_blocked_sudo(tmp_path):
    result = execute_tool("run_command", {"command": "sudo rm -rf /"}, str(tmp_path))
    assert "error" in result


def test_git_operation_status(tmp_path):
    os.system(f"cd {tmp_path} && git init -q && git config user.email test@test.com && git config user.name Test")
    (tmp_path / "file.txt").write_text("hello")
    os.system(f"cd {tmp_path} && git add . && git commit -q -m init")

    result = execute_tool("git_operation", {"operation": "status"}, str(tmp_path))
    assert "error" not in result


def test_git_operation_log(tmp_path):
    os.system(f"cd {tmp_path} && git init -q && git config user.email test@test.com && git config user.name Test")
    (tmp_path / "file.txt").write_text("hello")
    os.system(f"cd {tmp_path} && git add . && git commit -q -m init")

    result = execute_tool("git_operation", {"operation": "log"}, str(tmp_path))
    assert "error" not in result


def test_git_operation_diff(tmp_path):
    os.system(f"cd {tmp_path} && git init -q && git config user.email test@test.com && git config user.name Test")
    (tmp_path / "file.txt").write_text("hello")
    os.system(f"cd {tmp_path} && git add . && git commit -q -m init")

    result = execute_tool("git_operation", {"operation": "diff"}, str(tmp_path))
    assert "error" not in result


def test_git_operation_checkout_no_args(tmp_path):
    result = execute_tool("git_operation", {"operation": "checkout"}, str(tmp_path))
    assert "error" in result


def test_git_operation_add_no_args(tmp_path):
    result = execute_tool("git_operation", {"operation": "add"}, str(tmp_path))
    assert "error" in result


def test_git_operation_commit_no_args(tmp_path):
    result = execute_tool("git_operation", {"operation": "commit"}, str(tmp_path))
    assert "error" in result


def test_git_operation_unknown(tmp_path):
    result = execute_tool("git_operation", {"operation": "rebase"}, str(tmp_path))
    assert "error" in result


def test_execute_tool_think():
    result = execute_tool("think", {"plan": "test plan", "steps": ["step1"]}, "/tmp")
    assert result["plan"] == "test plan"
    assert result["step_count"] == 1


def test_execute_tool_verify():
    result = execute_tool("verify", {"check": "tests pass", "result": "pass"}, "/tmp")
    assert result["result"] == "pass"


def test_execute_tool_unknown():
    result = execute_tool("unknown_tool", {}, "/tmp")
    assert "error" in result


def test_create_file_with_subdirs(tmp_path):
    result = execute_tool("create_file", {
        "path": "sub/dir/file.py",
        "content": "nested",
    }, str(tmp_path))
    assert result.get("success")
    assert (tmp_path / "sub" / "dir" / "file.py").read_text() == "nested"


def test_path_traversal_in_tool(tmp_path):
    result = execute_tool("read_file", {"path": "../../etc/passwd"}, str(tmp_path))
    assert "error" in result


def test_create_file_path_escape(tmp_path):
    result = execute_tool("create_file", {"path": "../../bad.py", "content": "evil"}, str(tmp_path))
    assert "error" in result


def test_list_files_path_escape(tmp_path):
    result = execute_tool("list_files", {"path": "../../"}, str(tmp_path))
    assert "error" in result


def test_list_files_ignores_hidden_and_special(tmp_path):
    (tmp_path / ".hidden").write_text("")
    nm = tmp_path / "node_modules"
    nm.mkdir()
    (nm / "pkg.js").write_text("")
    (tmp_path / "visible.py").write_text("")

    result = execute_tool("list_files", {"path": "."}, str(tmp_path))
    entries = result.get("entries", [])
    assert "visible.py" in entries
    assert ".hidden" not in entries
    assert "node_modules/" not in entries


def test_read_file_truncates_large(tmp_path):
    from core.tools.definitions import MAX_READ_CHARS
    (tmp_path / "big.txt").write_text("x" * (MAX_READ_CHARS + 1000))
    result = execute_tool("read_file", {"path": "big.txt"}, str(tmp_path))
    assert "truncated" in result.get("content", "")


def test_run_command_with_stderr(tmp_path):
    result = execute_tool("run_command", {"command": "echo err >&2"}, str(tmp_path))
    assert "err" in result.get("output", "")


def test_git_operation_branch(tmp_path):
    os.system(f"cd {tmp_path} && git init -q && git config user.email test@test.com && git config user.name Test")
    (tmp_path / "f.txt").write_text("hi")
    os.system(f"cd {tmp_path} && git add . && git commit -q -m init")
    result = execute_tool("git_operation", {"operation": "branch"}, str(tmp_path))
    assert "error" not in result


def test_git_operation_add(tmp_path):
    os.system(f"cd {tmp_path} && git init -q && git config user.email test@test.com && git config user.name Test")
    (tmp_path / "new.txt").write_text("new file")
    result = execute_tool("git_operation", {"operation": "add", "args": "new.txt"}, str(tmp_path))
    assert "error" not in result


def test_git_operation_commit(tmp_path):
    os.system(f"cd {tmp_path} && git init -q && git config user.email test@test.com && git config user.name Test")
    (tmp_path / "f.txt").write_text("hi")
    os.system(f"cd {tmp_path} && git add .")
    result = execute_tool("git_operation", {"operation": "commit", "args": "test commit"}, str(tmp_path))
    assert result.get("operation") == "commit"


@pytest.mark.asyncio
async def test_execute_tool_streaming_non_command():
    from core.tools.definitions import execute_tool_streaming
    results = []
    async for r in execute_tool_streaming("think", {"plan": "test", "steps": ["s1"]}, "/tmp"):
        results.append(r)
    assert len(results) == 1
    assert results[0]["plan"] == "test"


@pytest.mark.asyncio
async def test_execute_tool_streaming_blocked():
    from core.tools.definitions import execute_tool_streaming
    results = []
    async for r in execute_tool_streaming("run_command", {"command": "rm -rf /"}, "/tmp"):
        results.append(r)
    assert len(results) == 1
    assert "error" in results[0]


def test_constants():
    from core.tools.definitions import IGNORE_DIRS, MAX_READ_CHARS, MAX_LIST_ENTRIES, COMMAND_TIMEOUT
    assert "node_modules" in IGNORE_DIRS
    assert ".git" in IGNORE_DIRS
    assert MAX_READ_CHARS > 0
    assert MAX_LIST_ENTRIES > 0
    assert COMMAND_TIMEOUT > 0


def test_create_file_direct(tmp_path):
    result = _create_file(str(tmp_path), "direct.py", "content here")
    assert result.get("success")
    assert result["size"] == len("content here")


def test_edit_file_direct(tmp_path):
    (tmp_path / "e.py").write_text("foo = 1")
    result = _edit_file(str(tmp_path), "e.py", "foo = 1", "bar = 2")
    assert result.get("success")
    assert result["replacements"] == 1


def test_read_file_direct(tmp_path):
    (tmp_path / "r.txt").write_text("data")
    result = _read_file(str(tmp_path), "r.txt")
    assert result["content"] == "data"


def test_list_files_direct(tmp_path):
    (tmp_path / "x.py").write_text("")
    result = _list_files(str(tmp_path), ".")
    assert "x.py" in result["entries"]


def test_run_command_direct(tmp_path):
    result = _run_command(str(tmp_path), "echo test123")
    assert result["exit_code"] == 0
    assert "test123" in result["output"]


def test_git_operation_status_with_args(tmp_path):
    os.system(f"cd {tmp_path} && git init -q && git config user.email t@t.com && git config user.name T")
    (tmp_path / "f.txt").write_text("hi")
    os.system(f"cd {tmp_path} && git add . && git commit -q -m init")
    result = _git_operation(str(tmp_path), "status", "")
    assert "exit_code" in result


def test_git_operation_checkout_branch(tmp_path):
    os.system(f"cd {tmp_path} && git init -q && git config user.email t@t.com && git config user.name T")
    (tmp_path / "f.txt").write_text("hi")
    os.system(f"cd {tmp_path} && git add . && git commit -q -m init")
    result = _git_operation(str(tmp_path), "checkout", "-b test-branch")
    assert result.get("exit_code") == 0


def test_list_files_many_entries(tmp_path):
    from core.tools.definitions import MAX_LIST_ENTRIES
    for i in range(MAX_LIST_ENTRIES + 10):
        (tmp_path / f"file_{i:04d}.txt").write_text("")
    result = _list_files(str(tmp_path), ".")
    assert len(result["entries"]) <= MAX_LIST_ENTRIES + 1
    assert "... (more files)" in result["entries"]


@pytest.mark.asyncio
async def test_execute_tool_streaming_run_command(tmp_path):
    from core.tools.definitions import execute_tool_streaming
    results = []
    async for r in execute_tool_streaming("run_command", {"command": "echo streaming"}, str(tmp_path)):
        results.append(r)
    assert any("_done" in r for r in results)
    done = [r for r in results if r.get("_done")]
    assert done[0]["exit_code"] == 0


@pytest.mark.asyncio
async def test_execute_tool_streaming_multiline(tmp_path):
    from core.tools.definitions import execute_tool_streaming
    results = []
    async for r in execute_tool_streaming("run_command", {"command": "echo line1 && echo line2"}, str(tmp_path)):
        results.append(r)
    partials = [r for r in results if "_partial" in r]
    assert len(partials) >= 2
    done = [r for r in results if r.get("_done")]
    assert done[0]["exit_code"] == 0


@pytest.mark.asyncio
async def test_execute_tool_streaming_failure(tmp_path):
    from core.tools.definitions import execute_tool_streaming
    results = []
    async for r in execute_tool_streaming("run_command", {"command": "exit 42"}, str(tmp_path)):
        results.append(r)
    done = [r for r in results if r.get("_done")]
    assert done[0]["exit_code"] == 42


def test_run_command_timeout(tmp_path):
    from core.tools.definitions import _run_command, COMMAND_TIMEOUT
    from unittest.mock import patch
    with patch("core.tools.definitions.COMMAND_TIMEOUT", 0.001):
        result = _run_command(str(tmp_path), "sleep 10")
        assert "error" in result
        assert "timed out" in result["error"]


def test_git_operation_timeout(tmp_path):
    from core.tools.definitions import _git_operation
    from unittest.mock import patch
    os.system(f"cd {tmp_path} && git init -q && git config user.email t@t.com && git config user.name T")
    (tmp_path / "f.txt").write_text("hi")
    os.system(f"cd {tmp_path} && git add . && git commit -q -m init")
    with patch("core.tools.definitions.COMMAND_TIMEOUT", 0.001):
        result = _git_operation(str(tmp_path), "log")
        if "error" in result:
            assert "timed out" in result["error"]
