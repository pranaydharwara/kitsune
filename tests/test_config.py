from core.config import KITSUNE_DIR, DB_PATH, DEFAULT_PORT


def test_kitsune_dir_is_set():
    assert KITSUNE_DIR is not None


def test_db_path_under_kitsune_dir():
    assert str(DB_PATH).startswith(str(KITSUNE_DIR))


def test_default_port():
    assert DEFAULT_PORT == 9848
