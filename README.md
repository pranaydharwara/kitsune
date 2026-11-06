<p align="center">
  <img src="ui/src-tauri/icons/icon.png" width="80" />
</p>

<h1 align="center">Kitsune</h1>

<p align="center">
  <strong>Local-first AI chat for macOS</strong><br>
  Run models on your machine. Escalate to the cloud when you need to.
</p>

<p align="center">
  <a href="#features">Features</a> · <a href="#getting-started">Getting started</a> · <a href="ROADMAP.md">Roadmap</a>
</p>

---

## Why Kitsune

Most AI chat apps are cloud-only. Kitsune runs a local model (Ollama) by default — your data stays on your Mac. When a query needs more horsepower, it automatically escalates to Claude. You get privacy for everyday questions and full capability when it matters.

## Features

**Chat** — streaming markdown responses, conversation search, export/import, project-based sidebar

**Smart routing** — auto mode classifies each query and picks local or cloud. You can also pin to a specific model per-conversation.

**Agentic tools** — the AI can read files, create files, list directories, and run shell commands in your project

**Context-aware** — codebase indexing, `@mentions` for files, per-project instructions, error detection

**Native macOS** — Tauri v2 app with Apple design language, overlay titlebar, menubar control

## Architecture

```
Tauri (native macOS app)
├── React + TypeScript frontend
└── HTTP → FastAPI backend (core/)
         ├── Router (auto / local / cloud)
         ├── Connectors (Ollama, Claude)
         ├── Tools (file ops, shell)
         ├── Context (indexing, mentions)
         └── SQLite (~/.kitsune/kitsune.db)
```

## Getting started

### Prerequisites

- macOS (Apple Silicon recommended)
- Python 3.11+
- [Ollama](https://ollama.com)
- Node.js 18+ and Rust
- Claude CLI (optional, for cloud escalation)

### Install

```bash
git clone https://github.com/pranaydharwara/kitsune.git
cd kitsune
```

```bash
uv venv && uv pip install -e ".[dev]"
```

```bash
ollama pull qwen3:30b-a3b
```

```bash
cd ui && npm install
```

### Run

**Native app** (recommended):

```bash
cd ui && npx tauri build
open src-tauri/target/release/bundle/macos/Kitsune.app
```

The app starts Ollama and the backend on launch, stops them on quit.

**Development**:

```bash
kitsune up          # start backend + Ollama
cd ui && npm run dev  # frontend dev server
```

**CLI**:

```bash
kitsune up       # start
kitsune down     # stop
kitsune status   # check
```

## Testing

```bash
cd ui && npm test
```

## Project structure

```
core/
  api/           FastAPI routes (chat, conversations)
  connectors/    Ollama and Claude adapters
  context/       Codebase indexing, mentions
  router/        Auto/local/cloud routing
  store/         SQLite persistence
  tools/         Agent tool implementations
  config.py      Models, ports, paths
  main.py        App entry point
ui/
  src/           React + TypeScript frontend
  src-tauri/     Tauri v2 native shell (Rust)
  e2e/           Playwright tests
```

## Configuration

Defaults in `core/config.py`:

| Setting | Default | |
|---|---|---|
| Main model | `qwen3:30b-a3b` | Primary local model |
| Classifier | `qwen3:4b` | Query routing |
| Port | `9848` | Backend API |
| Handoff budget | 24k tokens | Escalation threshold |

## License

MIT
