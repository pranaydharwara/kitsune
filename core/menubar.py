#!/usr/bin/env python3
"""Kitsune menu bar app — start/stop the stack from the macOS top bar."""

import threading
import webbrowser
from pathlib import Path

import rumps

from core.cli import (
    _core_running,
    _ollama_running,
    _start_core,
    _start_ollama,
    _stop_core,
    _unload_models,
)
from core.config import DEFAULT_PORT

CORE_URL = f"http://127.0.0.1:{DEFAULT_PORT}"


ICON_PATH = str(Path(__file__).parent.parent / "assets" / "foxTemplate.png")


class KitsuneApp(rumps.App):
    def __init__(self):
        super().__init__("Kitsune", icon=ICON_PATH, template=True)
        self.status_item = rumps.MenuItem("Status: checking...")
        self.start_item = rumps.MenuItem("Start Kitsune", callback=self.on_start)
        self.stop_item = rumps.MenuItem("Stop Kitsune", callback=self.on_stop)
        self.open_item = rumps.MenuItem("Open UI", callback=self.on_open)
        self.menu = [
            self.status_item,
            None,
            self.start_item,
            self.stop_item,
            None,
            self.open_item,
        ]
        self._refresh_status()
        self.timer = rumps.Timer(self._refresh_status, 10)
        self.timer.start()

    def _refresh_status(self, _=None):
        ollama = _ollama_running()
        core = _core_running()
        if ollama and core:
            self.status_item.title = "Status: running"
            self.start_item.set_callback(None)
            self.stop_item.set_callback(self.on_stop)
        elif ollama:
            self.status_item.title = "Status: Ollama only"
            self.start_item.set_callback(self.on_start)
            self.stop_item.set_callback(self.on_stop)
        else:
            self.status_item.title = "Status: stopped"
            self.start_item.set_callback(self.on_start)
            self.stop_item.set_callback(None)

    def _run_in_bg(self, fn, done_msg):
        def worker():
            fn()
            self._refresh_status()
            rumps.notification("Kitsune", "", done_msg)

        threading.Thread(target=worker, daemon=True).start()

    def on_start(self, _):
        self.status_item.title = "Status: starting..."
        self._run_in_bg(
            lambda: (_start_ollama(), _start_core()),
            "Kitsune is running.",
        )

    def on_stop(self, _):
        self.status_item.title = "Status: stopping..."
        self._run_in_bg(
            lambda: (_stop_core(), _unload_models()),
            "Kitsune stopped. RAM freed.",
        )

    def on_open(self, _):
        webbrowser.open(CORE_URL)


def _hide_dock_icon():
    try:
        from AppKit import NSApplication, NSApplicationActivationPolicyAccessory
        NSApplication.sharedApplication().setActivationPolicy_(NSApplicationActivationPolicyAccessory)
    except ImportError:
        pass


def main():
    _hide_dock_icon()
    KitsuneApp().run()


if __name__ == "__main__":
    main()
