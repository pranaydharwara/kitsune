#!/usr/bin/env python3
"""kitsune up / down / status — manage the Kitsune stack."""

import subprocess
import sys
import time
import webbrowser

import httpx

from core.config import DEFAULT_PORT, OLLAMA_BASE_URL

CORE_URL = f"http://127.0.0.1:{DEFAULT_PORT}"


def _ollama_running() -> bool:
    try:
        r = httpx.get(f"{OLLAMA_BASE_URL}/api/tags", timeout=2)
        return r.status_code == 200
    except Exception:
        return False


def _core_running() -> bool:
    try:
        r = httpx.get(f"{CORE_URL}/api/health", timeout=2)
        return r.status_code == 200
    except Exception:
        return False


def _start_ollama() -> None:
    if _ollama_running():
        return
    print("  Starting Ollama...")
    subprocess.Popen(
        ["open", "/Applications/Ollama.app"],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    for _ in range(15):
        time.sleep(1)
        if _ollama_running():
            return
    print("  ⚠ Ollama didn't start. Open it manually.")


def _start_core() -> None:
    if _core_running():
        return
    print("  Starting Kitsune Core...")
    import os
    from pathlib import Path

    repo = Path(__file__).parent.parent
    venv_python = repo / ".venv" / "bin" / "python"
    env = os.environ.copy()
    env["PATH"] = f"/opt/homebrew/bin:/usr/local/bin:{env.get('PATH', '')}"
    subprocess.Popen(
        [
            str(venv_python), "-m", "uvicorn",
            "core.main:app",
            "--host", "127.0.0.1",
            "--port", str(DEFAULT_PORT),
        ],
        cwd=str(repo),
        env=env,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    for _ in range(10):
        time.sleep(0.5)
        if _core_running():
            return
    print("  ⚠ Core didn't start. Check ~/.kitsune/core.err")


def _stop_core() -> None:
    import signal

    try:
        result = subprocess.run(
            ["lsof", "-ti", f":{DEFAULT_PORT}"],
            capture_output=True, text=True,
        )
        pids = result.stdout.strip().split("\n")
        for pid in pids:
            if pid:
                subprocess.run(["kill", pid], capture_output=True)
        print("  Core stopped.")
    except Exception:
        print("  Core was not running.")


def _unload_models() -> None:
    if not _ollama_running():
        return
    try:
        r = httpx.get(f"{OLLAMA_BASE_URL}/api/ps", timeout=2)
        loaded = [m["name"] for m in r.json().get("models", [])]
        for model in loaded:
            print(f"  Unloading {model}...")
            httpx.post(
                f"{OLLAMA_BASE_URL}/api/generate",
                json={"model": model, "keep_alive": 0},
                timeout=10,
            )
        if loaded:
            print("  RAM freed.")
        else:
            print("  No models loaded.")
    except Exception:
        pass


def cmd_up():
    print("🦊 Starting Kitsune...")
    _start_ollama()
    _start_core()
    if _core_running():
        print(f"\n✅ Kitsune is running at {CORE_URL}")
        webbrowser.open(CORE_URL)
    else:
        print("\n❌ Something went wrong. Run `kitsune status` to check.")


def cmd_down():
    print("🦊 Stopping Kitsune...")
    _stop_core()
    _unload_models()
    print("\n✅ Kitsune stopped. RAM freed.")


def cmd_status():
    ollama = _ollama_running()
    core = _core_running()

    loaded_models = []
    if ollama:
        try:
            r = httpx.get(f"{OLLAMA_BASE_URL}/api/ps", timeout=2)
            loaded_models = [m["name"] for m in r.json().get("models", [])]
        except Exception:
            pass

    print("🦊 Kitsune Status")
    print(f"   Ollama:  {'✅ running' if ollama else '❌ stopped'}")
    print(f"   Core:    {'✅ running' if core else '❌ stopped'}")
    if loaded_models:
        print(f"   Models:  {', '.join(loaded_models)} (in RAM)")
    else:
        print(f"   Models:  none loaded (RAM free)")
    if core:
        print(f"   UI:      {CORE_URL}")


def main():
    if len(sys.argv) < 2:
        print("Usage: kitsune <up|down|status>")
        print("  up      Start Ollama + Core, open browser")
        print("  down    Stop Core, unload models from RAM")
        print("  status  Show what's running")
        sys.exit(1)

    cmd = sys.argv[1]
    if cmd == "up":
        cmd_up()
    elif cmd == "down":
        cmd_down()
    elif cmd == "status":
        cmd_status()
    else:
        print(f"Unknown command: {cmd}")
        sys.exit(1)


if __name__ == "__main__":
    main()
