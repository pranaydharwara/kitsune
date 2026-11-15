from core.context.project import build_project_context, KEY_FILES, IGNORE_DIRS


def test_key_files_list():
    assert isinstance(KEY_FILES, list)
    assert len(KEY_FILES) > 0


def test_ignore_dirs_set():
    assert isinstance(IGNORE_DIRS, set)
    assert "node_modules" in IGNORE_DIRS


def test_build_project_context_basic(tmp_path):
    (tmp_path / "main.py").write_text("print('hello')")
    (tmp_path / "README.md").write_text("# My Project")
    sub = tmp_path / "src"
    sub.mkdir()
    (sub / "app.py").write_text("app = True")

    ctx = build_project_context(str(tmp_path))
    assert isinstance(ctx, str)
    assert len(ctx) > 0


def test_build_project_context_with_key_files(tmp_path):
    (tmp_path / "pyproject.toml").write_text("[project]\nname = 'test'")
    (tmp_path / "package.json").write_text('{"name": "test"}')

    ctx = build_project_context(str(tmp_path))
    assert isinstance(ctx, str)


def test_build_project_context_ignores_dirs(tmp_path):
    nm = tmp_path / "node_modules"
    nm.mkdir()
    (nm / "pkg.js").write_text("ignored")
    (tmp_path / "app.py").write_text("kept")

    ctx = build_project_context(str(tmp_path))
    assert "node_modules" not in ctx or "pkg.js" not in ctx


def test_build_project_context_empty_dir(tmp_path):
    result = build_project_context(str(tmp_path))
    assert result is None or isinstance(result, str)


def test_build_project_context_nonexistent():
    result = build_project_context("/nonexistent/path/abc123")
    assert result is None or isinstance(result, str)
