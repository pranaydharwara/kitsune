from core.context.mentions import (
    parse_mentions,
    resolve_mentions,
    get_mention_completions,
    _resolve_file,
    _resolve_folder,
    _resolve_errors,
    MAX_FILE_CHARS,
)
from core.context.indexer import invalidate_index


def test_parse_mentions_file():
    result = parse_mentions("Look at @file config.py")
    assert len(result) >= 1
    assert result[0]["type"] == "file"
    assert result[0]["arg"] == "config.py"


def test_parse_mentions_folder():
    result = parse_mentions("Check @folder src/")
    assert len(result) >= 1
    assert result[0]["type"] == "folder"


def test_parse_mentions_errors():
    result = parse_mentions("Check @errors for issues")
    assert len(result) >= 1
    assert result[0]["type"] == "errors"


def test_parse_mentions_none():
    result = parse_mentions("No mentions here")
    assert len(result) == 0


def test_parse_mentions_multiple():
    result = parse_mentions("Look at @file a.py and @file b.py and @errors")
    assert len(result) == 3


def test_resolve_mentions_file(tmp_path):
    invalidate_index(str(tmp_path))
    (tmp_path / "config.py").write_text("CONFIG = True")
    result = resolve_mentions("Look at @file config.py", str(tmp_path))
    resolved = result.get("resolved", [])
    found = [r for r in resolved if r.get("status") == "ok"]
    assert len(found) >= 1


def test_resolve_mentions_folder(tmp_path):
    invalidate_index(str(tmp_path))
    sub = tmp_path / "src"
    sub.mkdir()
    (sub / "main.py").write_text("main")
    result = resolve_mentions("Look at @folder src", str(tmp_path))
    assert isinstance(result, dict)
    assert "context_parts" in result
    assert len(result["context_parts"]) >= 1


def test_resolve_mentions_errors_keyword():
    result = resolve_mentions("Check @errors", None, recent_errors=["Error: something failed"])
    assert len(result.get("context_parts", [])) >= 1


def test_resolve_mentions_no_project():
    result = resolve_mentions("Check @file test.py", None)
    resolved = result.get("resolved", [])
    assert any(r["status"] == "not_found" for r in resolved)


def test_resolve_mentions_no_mentions():
    result = resolve_mentions("No mentions", "/tmp")
    assert result["clean_text"] == "No mentions"
    assert result["context_parts"] == []
    assert result["resolved"] == []


def test_resolve_mentions_file_not_found(tmp_path):
    invalidate_index(str(tmp_path))
    result = resolve_mentions("Check @file nonexistent.py", str(tmp_path))
    resolved = result.get("resolved", [])
    assert any(r["status"] == "not_found" for r in resolved)


def test_resolve_mentions_errors_none():
    result = resolve_mentions("Check @errors", None, recent_errors=None)
    resolved = result.get("resolved", [])
    assert any(r["status"] == "not_found" for r in resolved)


def test_resolve_file_truncation(tmp_path):
    invalidate_index(str(tmp_path))
    (tmp_path / "big.py").write_text("x" * (MAX_FILE_CHARS + 1000))
    result = _resolve_file(str(tmp_path), "big.py")
    assert result is not None
    assert "truncated" in result


def test_resolve_file_nonexistent(tmp_path):
    invalidate_index(str(tmp_path))
    result = _resolve_file(str(tmp_path), "nope.py")
    assert result is None


def test_resolve_folder_path_traversal(tmp_path):
    result = _resolve_folder(str(tmp_path), "../../etc")
    assert result is None


def test_resolve_folder_not_dir(tmp_path):
    (tmp_path / "file.txt").write_text("not a dir")
    result = _resolve_folder(str(tmp_path), "file.txt")
    assert result is None


def test_resolve_folder_empty(tmp_path):
    invalidate_index(str(tmp_path))
    empty = tmp_path / "empty_dir"
    empty.mkdir()
    result = _resolve_folder(str(tmp_path), "empty_dir")
    assert result is None


def test_resolve_folder_with_entries(tmp_path):
    invalidate_index(str(tmp_path))
    sub = tmp_path / "mydir"
    sub.mkdir()
    (sub / "a.py").write_text("")
    (sub / "b.py").write_text("")
    result = _resolve_folder(str(tmp_path), "mydir")
    assert result is not None
    assert "mydir" in result


def test_resolve_errors_empty():
    assert _resolve_errors(None) is None
    assert _resolve_errors([]) is None


def test_resolve_errors_with_items():
    result = _resolve_errors(["Error 1", "Error 2"])
    assert result is not None
    assert "Error 1" in result
    assert "Error 2" in result


def test_get_mention_completions_empty():
    completions = get_mention_completions("", None)
    assert len(completions) == 3
    assert any("@file" in c["value"] for c in completions)


def test_get_mention_completions_at_prefix():
    completions = get_mention_completions("@", None)
    assert len(completions) >= 1


def test_get_mention_completions_partial_keyword():
    completions = get_mention_completions("@fi", None)
    assert any("file" in c["value"] for c in completions)


def test_get_mention_completions_file_search(tmp_path):
    invalidate_index(str(tmp_path))
    (tmp_path / "utils.py").write_text("util")
    (tmp_path / "config.py").write_text("conf")
    completions = get_mention_completions("@file conf", str(tmp_path))
    assert any("config" in c.get("label", "") for c in completions)


def test_get_mention_completions_folder_search(tmp_path):
    invalidate_index(str(tmp_path))
    sub = tmp_path / "mydir"
    sub.mkdir()
    completions = get_mention_completions("@folder my", str(tmp_path))
    assert isinstance(completions, list)


def test_get_mention_completions_no_project():
    completions = get_mention_completions("@file test", None)
    assert completions == []
