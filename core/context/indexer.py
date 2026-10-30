"""Codebase indexer — builds a searchable file index for a project."""

import fnmatch
import os
from pathlib import Path

IGNORE_DIRS = {
    ".git", "node_modules", "__pycache__", ".venv", "venv",
    "target", "dist", "build", ".next", ".nuxt", ".cache",
    "vendor", ".tox", "env", ".env", ".eggs", "egg-info",
    ".idea", ".vscode", ".DS_Store",
}

IGNORE_PATTERNS = [
    "*.pyc", "*.pyo", "*.o", "*.so", "*.dylib",
    "*.jpg", "*.jpeg", "*.png", "*.gif", "*.ico", "*.svg",
    "*.woff", "*.woff2", "*.ttf", "*.eot",
    "*.zip", "*.tar", "*.gz", "*.bz2",
    "*.lock", "package-lock.json", "yarn.lock", "pnpm-lock.yaml",
]

TEXT_EXTENSIONS = {
    ".py", ".ts", ".tsx", ".js", ".jsx", ".rs", ".go", ".java",
    ".c", ".cpp", ".h", ".hpp", ".cs", ".rb", ".php", ".swift",
    ".kt", ".scala", ".lua", ".sh", ".bash", ".zsh", ".fish",
    ".md", ".txt", ".rst", ".toml", ".yaml", ".yml", ".json",
    ".xml", ".html", ".css", ".scss", ".less", ".sql", ".graphql",
    ".proto", ".dockerfile", ".env.example", ".gitignore",
    ".cfg", ".ini", ".conf",
}

MAX_INDEX_FILES = 5000
MAX_FILE_SIZE = 512_000  # 500KB


class FileEntry:
    __slots__ = ("path", "name", "ext", "size", "is_dir")

    def __init__(self, path: str, name: str, ext: str, size: int, is_dir: bool):
        self.path = path
        self.name = name
        self.ext = ext
        self.size = size
        self.is_dir = is_dir


class ProjectIndex:
    def __init__(self, project_path: str):
        self.project_path = project_path
        self.files: list[FileEntry] = []
        self._path_set: set[str] = set()

    def build(self) -> "ProjectIndex":
        root = Path(self.project_path)
        if not root.is_dir():
            return self

        self.files.clear()
        self._path_set.clear()
        self._walk(root, root)
        return self

    def _walk(self, directory: Path, root: Path) -> None:
        if len(self.files) >= MAX_INDEX_FILES:
            return
        try:
            items = sorted(directory.iterdir(), key=lambda p: (not p.is_dir(), p.name.lower()))
        except (PermissionError, OSError):
            return

        for item in items:
            if len(self.files) >= MAX_INDEX_FILES:
                return
            if item.name in IGNORE_DIRS:
                continue
            if any(fnmatch.fnmatch(item.name, pat) for pat in IGNORE_PATTERNS):
                continue

            rel = str(item.relative_to(root))
            if item.is_dir():
                self.files.append(FileEntry(rel, item.name, "", 0, True))
                self._path_set.add(rel)
                self._walk(item, root)
            elif item.is_file():
                try:
                    size = item.stat().st_size
                except OSError:
                    size = 0
                if size > MAX_FILE_SIZE:
                    continue
                self.files.append(FileEntry(rel, item.name, item.suffix.lower(), size, False))
                self._path_set.add(rel)

    def search(self, query: str, limit: int = 20) -> list[FileEntry]:
        """Search files by name, path, or extension. Returns ranked results."""
        if not query:
            return []

        query_lower = query.lower()
        exact = []
        name_match = []
        path_match = []
        ext_match = []

        for f in self.files:
            if f.is_dir:
                continue
            name_lower = f.name.lower()
            path_lower = f.path.lower()

            if name_lower == query_lower:
                exact.append(f)
            elif query_lower in name_lower:
                name_match.append(f)
            elif query_lower in path_lower:
                path_match.append(f)
            elif f.ext and query_lower == f.ext.lstrip("."):
                ext_match.append(f)

        results = exact + name_match + path_match + ext_match
        return results[:limit]

    def search_content(self, query: str, limit: int = 10, max_chars: int = 200) -> list[dict]:
        """Search file contents for a string. Returns matching lines with context."""
        if not query:
            return []

        root = Path(self.project_path)
        query_lower = query.lower()
        results = []

        for f in self.files:
            if f.is_dir or f.ext not in TEXT_EXTENSIONS:
                continue
            if len(results) >= limit:
                break

            fpath = root / f.path
            try:
                text = fpath.read_text(encoding="utf-8", errors="replace")
            except (OSError, UnicodeDecodeError):
                continue

            if query_lower not in text.lower():
                continue

            matches = []
            for i, line in enumerate(text.splitlines(), 1):
                if query_lower in line.lower():
                    matches.append({"line": i, "text": line.strip()[:max_chars]})
                    if len(matches) >= 5:
                        break

            if matches:
                results.append({"path": f.path, "matches": matches})

        return results

    def get_file_content(self, path: str) -> str | None:
        """Read a file's content safely within the project."""
        root = Path(self.project_path)
        target = (root / path).resolve()
        if not str(target).startswith(str(root.resolve())):
            return None
        if not target.is_file():
            return None
        try:
            return target.read_text(encoding="utf-8", errors="replace")
        except (OSError, UnicodeDecodeError):
            return None

    def list_dir(self, path: str = ".") -> list[FileEntry]:
        """List files in a specific directory."""
        prefix = "" if path == "." else path.rstrip("/") + "/"
        results = []
        for f in self.files:
            if prefix:
                if not f.path.startswith(prefix):
                    continue
                remainder = f.path[len(prefix):]
            else:
                remainder = f.path
            if "/" not in remainder:
                results.append(f)
        return results


# In-memory cache of project indexes
_index_cache: dict[str, ProjectIndex] = {}


def get_or_build_index(project_path: str) -> ProjectIndex:
    """Get cached index or build a new one."""
    if project_path in _index_cache:
        return _index_cache[project_path]
    idx = ProjectIndex(project_path).build()
    _index_cache[project_path] = idx
    return idx


def invalidate_index(project_path: str) -> None:
    """Remove cached index (e.g. after file changes)."""
    _index_cache.pop(project_path, None)
