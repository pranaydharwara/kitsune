from core.context.instructions import (
    load_project_instructions,
    save_project_instructions,
    get_instructions_info,
    INSTRUCTION_FILES,
)


def test_instruction_files_list():
    assert len(INSTRUCTION_FILES) >= 2
    assert any("kitsune" in f.lower() or "KITSUNE" in f for f in INSTRUCTION_FILES)


def test_load_no_instructions(tmp_path):
    result = load_project_instructions(str(tmp_path))
    assert result is None


def test_load_kitsune_md(tmp_path):
    (tmp_path / "KITSUNE.md").write_text("# Project instructions\nDo this.")
    result = load_project_instructions(str(tmp_path))
    assert result is not None
    assert "Do this" in result


def test_load_kitsune_dir_instructions(tmp_path):
    d = tmp_path / ".kitsune"
    d.mkdir()
    (d / "instructions.md").write_text("Be concise.")
    result = load_project_instructions(str(tmp_path))
    assert result is not None
    assert "concise" in result


def test_save_instructions(tmp_path):
    saved = save_project_instructions(str(tmp_path), "New instructions here")
    assert saved is not None
    content = load_project_instructions(str(tmp_path))
    assert "New instructions" in content


def test_get_instructions_info_found(tmp_path):
    (tmp_path / "KITSUNE.md").write_text("Instructions content")
    info = get_instructions_info(str(tmp_path))
    assert info["found"] is True
    assert info["content"] is not None
    assert info["file"] is not None


def test_get_instructions_info_not_found(tmp_path):
    info = get_instructions_info(str(tmp_path))
    assert info["found"] is False
    assert info["content"] is None
