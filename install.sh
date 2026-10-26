#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "🦊 Installing Kitsune..."

# Install uv if not present
if ! command -v uv &>/dev/null; then
  echo "  Installing uv..."
  curl -LsSf https://astral.sh/uv/install.sh | sh
fi

# Install Python deps
echo "  Installing Python dependencies..."
cd "$REPO_DIR"
uv sync

# Build UI
if command -v npm &>/dev/null; then
  echo "  Building UI..."
  cd "$REPO_DIR/ui"
  npm install
  npm run build
else
  echo "  ⚠ npm not found — skipping UI build. Install Node.js to get the web UI."
fi

# Create config directory
mkdir -p "$HOME/.kitsune"

# Remove old launchd agent if present
PLIST_PATH="$HOME/Library/LaunchAgents/com.kitsune.core.plist"
if [ -f "$PLIST_PATH" ]; then
  echo "  Removing old launchd agent..."
  launchctl unload "$PLIST_PATH" 2>/dev/null || true
  rm -f "$PLIST_PATH"
fi

echo ""
echo "✅ Kitsune installed!"
echo ""
echo "   Start:    kitsune up"
echo "   Stop:     kitsune down"
echo "   Status:   kitsune status"
echo "   Menu bar: kitsune-menubar"
