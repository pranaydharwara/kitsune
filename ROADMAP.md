# Kitsune Roadmap

A Claude-quality chat experience that runs local models on your Mac — with cloud escalation when you need it.

## What's shipped

- [x] Tauri native macOS app with Apple design language
- [x] Ollama local inference (Qwen3 30B-A3B)
- [x] Claude API cloud escalation
- [x] Smart routing (auto/local/cloud) with classifier
- [x] Streaming SSE with markdown rendering
- [x] Conversation search, export/import
- [x] Project sidebar with folder-based grouping
- [x] Agentic tool use (file create/read/list, shell commands)
- [x] Context & awareness (codebase indexing, @mentions, instructions, error detection)
- [x] Settings panel, usage tracking
- [x] Menubar control (start/stop stack)

---

## Phase 1 — Claude-grade chat UX

Close the gap between Kitsune's chat experience and Claude's. Local model on top, cloud-level polish.

### Conversation features
- [x] Edit and re-send a previous message
- [ ] Branching / fork a conversation from any message
- [x] Conversation starring / pinning
- [x] Keyboard shortcuts (Cmd+N new chat, Cmd+K search, Cmd+/ settings, Cmd+M cycle mode)
- [ ] Drag to reorder sidebar projects

### Message rendering
- [x] Code block copy button, syntax highlighting improvements
- [ ] LaTeX / math rendering
- [x] Collapsible long outputs (tool results, code blocks)
- [ ] Image rendering in responses

### Composer
- [ ] Attach files/images to messages (drag-and-drop)
- [ ] Paste image from clipboard
- [x] Shift+Enter for newlines, Enter to send (configurable)
- [ ] Prompt templates / quick actions

---

## Phase 2 — Context & intelligence

Make the local model smarter by giving it the right context automatically.

### Project awareness
- [ ] Instruction files (`.kitsune/instructions.md`) per-project
- [ ] Persist context panel state across conversations
- [ ] @mention autocomplete for files outside current project
- [ ] Fix: context indexing stalls on large repos (>10k files)

### Knowledge & RAG
- [ ] Embeddings-based retrieval over project files
- [ ] Web search tool for the agent
- [ ] URL fetching and summarization

### Routing & models
- [ ] Ollama model auto-download on first reference
- [ ] Routing confidence display (show why auto picked local vs cloud)
- [ ] Per-conversation model lock
- [ ] Token usage per-conversation breakdown
- [ ] Cost estimation before cloud calls

---

## Phase 3 — Agent & tools

Bring agentic capabilities closer to Claude Code level.

### Agent improvements
- [ ] Multi-step tool chains (plan → execute → verify)
- [ ] Approval gate before destructive tool actions (rm, overwrite)
- [ ] Tool output streaming (show partial results as tools run)
- [ ] Fix: tool activity panel scroll jumps on new events

### New tools
- [ ] Terminal integration (persistent shell session)
- [ ] Git operations (diff, commit, branch from chat)
- [ ] Browser preview (render HTML/React from chat)

### MCP
- [ ] MCP server support (Model Context Protocol)
- [ ] Bundled MCP servers for common tasks

---

## Phase 4 — Platform & ecosystem

### Multi-provider
- [ ] OpenAI-compatible API connector (GPT-4o, o3, etc.)
- [ ] Anthropic direct API key support (no CLI dependency)
- [ ] Provider-agnostic model picker

### Platform
- [ ] Auto-update via Tauri updater
- [ ] Linux build
- [ ] Crash reporting / diagnostics export
- [ ] Themes / appearance customization

---

## Backlog

- [ ] Plugin/extension system for custom tools
- [ ] Voice input (Whisper via Ollama)
- [ ] Multi-user / shared conversations
- [ ] iOS companion (read-only conversation viewer)
- [ ] Local fine-tuning integration

---

Check off items as they ship. Move things between phases as priorities shift.
