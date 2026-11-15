from core.context.indexer import (
    ProjectIndex,
    FileEntry,
    get_or_build_index,
    invalidate_index,
    IGNORE_DIRS,
    TEXT_EXTENSIONS,
    MAX_FILE_SIZE,
    MAX_INDEX_FILES,
)


def test_ignore_dirs_has_common():
    assert "node_modules" in IGNORE_DIRS
    assert ".git" in IGNORE_DIRS
    assert "__pycache__" in IGNORE_DIRS


def test_text_extensions_has_common():
    assert ".py" in TEXT_EXTENSIONS
    assert ".ts" in TEXT_EXTENSIONS
    assert ".md" in TEXT_EXTENSIONS


def test_build_index(tmp_path):
    (tmp_path / "hello.py").write_text("print('hello')")
    (tmp_path / "readme.md").write_text("# README")
    sub = tmp_path / "src"
    sub.mkdir()
    (sub / "main.ts").write_text("console.log('hi')")

    idx = ProjectIndex(str(tmp_path)).build()
    assert len(idx.files) >= 3


def test_build_index_nonexistent():
    idx = ProjectIndex("/nonexistent/path").build()
    assert len(idx.files) == 0


def test_search(tmp_path):
    (tmp_path / "config.py").write_text("CONFIG = True")
    (tmp_path / "utils.py").write_text("def util(): pass")

    idx = ProjectIndex(str(tmp_path)).build()
    results = idx.search("config")
    assert any("config" in r.name.lower() for r in results)


def test_search_empty_query(tmp_path):
    (tmp_path / "a.py").write_text("")
    idx = ProjectIndex(str(tmp_path)).build()
    assert idx.search("") == []


def test_search_exact_match(tmp_path):
    (tmp_path / "exact.py").write_text("")
    (tmp_path / "exact_utils.py").write_text("")
    idx = ProjectIndex(str(tmp_path)).build()
    results = idx.search("exact.py")
    assert results[0].name == "exact.py"


def test_search_by_extension(tmp_path):
    (tmp_path / "file.rs").write_text("fn main() {}")
    (tmp_path / "other.py").write_text("")
    idx = ProjectIndex(str(tmp_path)).build()
    results = idx.search("rs")
    assert any(r.ext == ".rs" for r in results)


def test_search_content(tmp_path):
    (tmp_path / "data.py").write_text("MAGIC_VALUE = 42\nother = 1")

    idx = ProjectIndex(str(tmp_path)).build()
    results = idx.search_content("MAGIC_VALUE")
    assert len(results) > 0


def test_search_content_empty_query(tmp_path):
    (tmp_path / "a.py").write_text("content")
    idx = ProjectIndex(str(tmp_path)).build()
    assert idx.search_content("") == []


def test_search_content_no_match(tmp_path):
    (tmp_path / "a.py").write_text("hello world")
    idx = ProjectIndex(str(tmp_path)).build()
    assert idx.search_content("nonexistent_string") == []


def test_search_content_skips_non_text(tmp_path):
    (tmp_path / "image.png").write_bytes(b"\x89PNG")
    idx = ProjectIndex(str(tmp_path)).build()
    results = idx.search_content("PNG")
    assert len(results) == 0


def test_search_content_multiple_matches(tmp_path):
    content = "\n".join([f"line {i} FINDME" for i in range(10)])
    (tmp_path / "multi.py").write_text(content)
    idx = ProjectIndex(str(tmp_path)).build()
    results = idx.search_content("FINDME")
    assert len(results) == 1
    assert len(results[0]["matches"]) <= 5


def test_get_file_content(tmp_path):
    (tmp_path / "test.txt").write_text("file content here")
    idx = ProjectIndex(str(tmp_path)).build()
    content = idx.get_file_content("test.txt")
    assert "file content here" in content


def test_get_file_content_nonexistent(tmp_path):
    idx = ProjectIndex(str(tmp_path)).build()
    assert idx.get_file_content("nonexistent.py") is None


def test_get_file_content_path_traversal(tmp_path):
    idx = ProjectIndex(str(tmp_path)).build()
    assert idx.get_file_content("../../etc/passwd") is None


def test_list_dir(tmp_path):
    (tmp_path / "a.py").write_text("")
    (tmp_path / "b.py").write_text("")
    sub = tmp_path / "sub"
    sub.mkdir()
    (sub / "c.py").write_text("")

    idx = ProjectIndex(str(tmp_path)).build()
    entries = idx.list_dir(".")
    assert len(entries) >= 2


def test_list_dir_subdirectory(tmp_path):
    sub = tmp_path / "src"
    sub.mkdir()
    (sub / "main.py").write_text("")
    (sub / "utils.py").write_text("")

    idx = ProjectIndex(str(tmp_path)).build()
    entries = idx.list_dir("src")
    assert len(entries) == 2


def test_ignores_node_modules(tmp_path):
    nm = tmp_path / "node_modules"
    nm.mkdir()
    (nm / "pkg.js").write_text("ignored")
    (tmp_path / "app.js").write_text("kept")

    idx = ProjectIndex(str(tmp_path)).build()
    paths = [f.path for f in idx.files]
    assert not any("node_modules" in p for p in paths)


def test_ignores_patterns(tmp_path):
    (tmp_path / "file.pyc").write_bytes(b"compiled")
    (tmp_path / "image.jpg").write_bytes(b"image")
    (tmp_path / "real.py").write_text("code")

    idx = ProjectIndex(str(tmp_path)).build()
    names = [f.name for f in idx.files]
    assert "file.pyc" not in names
    assert "image.jpg" not in names
    assert "real.py" in names


def test_skips_large_files(tmp_path):
    (tmp_path / "big.txt").write_text("x" * (MAX_FILE_SIZE + 1))
    (tmp_path / "small.txt").write_text("ok")

    idx = ProjectIndex(str(tmp_path)).build()
    names = [f.name for f in idx.files]
    assert "big.txt" not in names
    assert "small.txt" in names


def test_get_or_build_index_caching(tmp_path):
    (tmp_path / "a.py").write_text("x")
    idx1 = get_or_build_index(str(tmp_path))
    idx2 = get_or_build_index(str(tmp_path))
    assert idx1 is idx2


def test_invalidate_index(tmp_path):
    (tmp_path / "a.py").write_text("x")
    idx1 = get_or_build_index(str(tmp_path))
    invalidate_index(str(tmp_path))
    idx2 = get_or_build_index(str(tmp_path))
    assert idx1 is not idx2


def test_invalidate_index_nonexistent():
    invalidate_index("/nonexistent/path/that/never/existed")


def test_file_entry_slots():
    entry = FileEntry("path/to/file.py", "file.py", ".py", 100, False)
    assert entry.path == "path/to/file.py"
    assert entry.name == "file.py"
    assert entry.ext == ".py"
    assert entry.size == 100
    assert entry.is_dir is False


def test_file_entry_dir():
    entry = FileEntry("src", "src", "", 0, True)
    assert entry.is_dir is True
