#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")" && pwd)"
PLIST_LABEL="com.kitsune.core"
PLIST_PATH="$HOME/Library/LaunchAgents/$PLIST_LABEL.plist"

echo "🦊 Installing Kitsune Core..."

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

# Install launchd agent
cat > "$PLIST_PATH" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>$PLIST_LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>$REPO_DIR/.venv/bin/python</string>
    <string>-m</string>
    <string>uvicorn</string>
    <string>core.main:app</string>
    <string>--host</string>
    <string>127.0.0.1</string>
    <string>--port</string>
    <string>9848</string>
  </array>
  <key>WorkingDirectory</key>
  <string>$REPO_DIR</string>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>$HOME/.kitsune/core.log</string>
  <key>StandardErrorPath</key>
  <string>$HOME/.kitsune/core.err</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin</string>
  </dict>
</dict>
</plist>
EOF

# Load the agent
launchctl unload "$PLIST_PATH" 2>/dev/null || true
launchctl load "$PLIST_PATH"

echo ""
echo "✅ Kitsune Core installed and running!"
echo "   Open http://localhost:9848 in your browser"
echo "   Logs: ~/.kitsune/core.log"
echo ""
echo "   CLI commands:"
echo "     kitsune up       Start Ollama + Core, open browser"
echo "     kitsune down     Stop Core, free RAM"
echo "     kitsune status   Show what's running"
echo ""
echo "   Menu bar app:"
echo "     kitsune-menubar  Launch the 🦊 menu bar icon"
echo ""
echo "   launchd (auto-start at login):"
echo "     launchctl unload $PLIST_PATH   # stop"
echo "     launchctl load   $PLIST_PATH   # start"
