# Kitsune

Local-first AI chat for macOS. Runs models on your machine via Ollama, with automatic escalation to Claude when a query needs more capability.

## Architecture

```
┌─────────────────────────────────────────┐
│  Tauri (native macOS app)               │
│  ┌───────────┐  ┌────────────────────┐  │
│  │  Sidebar   │  │   Chat thread      │  │
│  │  Search    │  │   Markdown render  │  │
│  │  History   │  │   Streaming SSE    │  │
│  └───────────┘  └────────────────────┘  │
└──────────────────┬──────────────────────┘
                   │ HTTP (127.0.0.1:9848)
┌──────────────────▼──────────────────────┐
│  FastAPI backend (core/)                │
│  ┌─────────┐  ┌───────────────────────┐ │
│  │ Router   │  │ Connectors           │ │
│  │ (auto/   │  │  ├─ ollama (local)   │ │
│  │  local/  │  │  └─ claude_cli       │ │
│  │  cloud)  │  │      (cloud)         │ │
│  └─────────┘  └───────────────────────┘ │
│  ┌─────────────────────────────────────┐ │
│  │ SQLite store (~/.kitsune/kitsune.db)│ │
│  └─────────────────────────────────────┘ │
└──────────────────┬──────────────────────┘
                   │
        ┌──────────┴──────────┐
        ▼                     ▼
   Ollama (local)       Claude API
   qwen3:30b-a3b        (via CLI)
```

## Features

- **Local-first** — queries default to Ollama models running on your Mac, keeping data on-device
- **Smart routing** — auto mode classifies queries and escalates to Claude when local models aren't enough
- **Native macOS app** — Tauri v2 wrapper with overlay titlebar, Apple design language
- **Streaming responses** — token-by-token SSE streaming with markdown rendering
- **Conversation search** — filter chat history by title or message content
- **Model selector** — switch between Auto, Local (pick an Ollama model), or Cloud (pick a Claude model)
- **Retry with fallback** — retry any response with a different provider
- **Menubar control** — start/stop the stack from the macOS menu bar

## Prerequisites

- **macOS** (Apple Silicon recommended)
- **Python 3.11+**
- **Ollama** — [ollama.com](https://ollama.com)
- **Node.js 18+** and **Rust** (for building the native app)
- **Claude CLI** (optional, for cloud escalation)

## Setup

```bash
# Clone and set up Python
git clone https://github.com/pranaydharwara/kitsune.git
cd kitsune
uv venv && uv pip install -e ".[dev]"

# Pull the default local model
ollama pull qwen3:30b-a3b

# Install UI dependencies
cd ui && npm install
```

## Running

### Native app (recommended)

```bash
cd ui
npx tauri build
open src-tauri/target/release/bundle/macos/Kitsune.app
```

The app automatically starts Ollama and the backend on launch, and stops them on quit.

### Development

```bash
# Terminal 1: backend
kitsune up

# Terminal 2: frontend dev server
cd ui && npm run dev
```

### CLI

```bash
kitsune up       # start backend + Ollama
kitsune down     # stop everything
kitsune status   # check what's running
```

## Testing

```bash
cd ui
npm test              # headless Playwright e2e tests
npm run test:headed   # watch mode
```

## Project structure

```
core/
  api/           # FastAPI routes (chat, conversations)
  connectors/    # Ollama and Claude CLI adapters
  router/        # Auto/local/cloud routing logic
  store/         # SQLite persistence (conversations, messages)
  config.py      # Models, ports, paths
  main.py        # FastAPI app entry point
  cli.py         # kitsune up/down/status
  menubar.py     # macOS menu bar app
ui/
  src/           # React + TypeScript frontend
  src-tauri/     # Tauri v2 native shell (Rust)
  e2e/           # Playwright tests
```

## Configuration

Default models and settings are in `core/config.py`:

| Setting | Default | Description |
|---------|---------|-------------|
| `MAIN_MODEL` | `qwen3:30b-a3b` | Primary local model |
| `CLASSIFIER_MODEL` | `qwen3:4b` | Query classifier for auto routing |
| `DEFAULT_PORT` | `9848` | Backend API port |
| `CLAUDE_HANDOFF_BUDGET` | `24,000` tokens | Context budget before escalating to Claude |

## License

MIT
