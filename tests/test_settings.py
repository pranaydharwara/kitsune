import json
from unittest.mock import patch

from core import settings


def test_load_defaults(tmp_path):
    path = tmp_path / "settings.json"
    with patch.object(settings, "SETTINGS_PATH", path):
        data = settings.load()
        assert isinstance(data, dict)
        for key in settings.DEFAULTS:
            assert key in data


def test_save_and_load(tmp_path):
    path = tmp_path / "settings.json"
    with patch.object(settings, "SETTINGS_PATH", path):
        settings.save({"theme": "dark"})
        data = settings.load()
        assert data["theme"] == "dark"


def test_save_merges(tmp_path):
    path = tmp_path / "settings.json"
    with patch.object(settings, "SETTINGS_PATH", path):
        settings.save({"theme": "dark"})
        settings.save({"default_mode": "local"})
        data = settings.load()
        assert data["theme"] == "dark"
        assert data["default_mode"] == "local"


def test_get_cached(tmp_path):
    path = tmp_path / "settings.json"
    with patch.object(settings, "SETTINGS_PATH", path):
        settings.invalidate()
        settings.save({"theme": "light"})
        val = settings.get("theme")
        assert val == "light"


def test_invalidate(tmp_path):
    path = tmp_path / "settings.json"
    with patch.object(settings, "SETTINGS_PATH", path):
        settings.get("theme")
        settings.invalidate()
        settings.save({"theme": "monokai"})
        val = settings.get("theme")
        assert val == "monokai"


def test_get_nonexistent_key(tmp_path):
    path = tmp_path / "settings.json"
    with patch.object(settings, "SETTINGS_PATH", path):
        settings.invalidate()
        val = settings.get("nonexistent_key_12345")
        assert val is None


def test_load_creates_parent_dir(tmp_path):
    path = tmp_path / "subdir" / "settings.json"
    with patch.object(settings, "SETTINGS_PATH", path):
        data = settings.load()
        assert isinstance(data, dict)
