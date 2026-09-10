#!/usr/bin/env python3
"""Local bridge from the EXE picker to a DirectWebGPU checkout."""

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import threading
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

HOST = "127.0.0.1"
PORT = 8799
RUNTIME_PORT = 8791
MAX_EXE = 100_000_000


def find_path(explicit: str | None, environment: str, candidates: list[Path], marker: str) -> Path:
    options = [Path(explicit).expanduser() if explicit else None]
    if os.environ.get(environment):
        options.append(Path(os.environ[environment]).expanduser())
    options.extend(candidates)
    for option in options:
        if option and (option / marker).exists():
            return option.resolve()
    raise SystemExit(f"Required path not found. Set {environment}.")


def find_directwebgpu(explicit: str | None) -> Path:
    parent = Path(__file__).resolve().parent.parent
    return find_path(explicit, "DIRECTWEBGPU_HOME", [parent / "DirectWebGPU", parent / "directwebgpu-wined3d", parent / "directxbrowser"], "scripts/build_wasm.sh")


def find_assets(explicit: str | None) -> Path:
    repository = Path(__file__).resolve().parent
    parent = repository.parent
    return find_path(explicit, "HAMSTERBALL_ASSET_ROOT", [repository / "assets", parent / "Hamsterball", Path("/tmp/DirectWebGPU-Hamsterball-2-run")], "Textures")


class Companion:
    def __init__(self, directwebgpu: Path, assets: Path):
        self.directwebgpu = directwebgpu
        self.assets = assets
        self.build_lock = threading.Lock()
        self.runtime_process: subprocess.Popen | None = None

    def runtime_alive(self) -> bool:
        try:
            with urllib.request.urlopen(f"http://{HOST}:{RUNTIME_PORT}/api/build", timeout=0.4) as response:
                return response.status == 200
        except Exception:
            return False

    def start_runtime(self, install: Path) -> None:
        if self.runtime_alive():
            return
        log = (Path(tempfile.gettempdir()) / "directwebgpu-hamsterball.log").open("ab")
        self.runtime_process = subprocess.Popen(
            ["python3", "scripts/serve.py", str(RUNTIME_PORT), "hamsterball", str(install)],
            cwd=self.directwebgpu,
            stdout=log,
            stderr=subprocess.STDOUT,
            start_new_session=True,
        )

    def build(self, executable: Path) -> str:
        with self.build_lock, tempfile.TemporaryDirectory(prefix="directwebgpu-hamsterball-") as temp:
            install = Path(temp) / "install"
            shutil.copytree(self.assets, install)
            shutil.copy2(executable, install / "Hamsterball.exe")
            subprocess.run(
                ["scripts/build_wasm.sh", "release", "hamsterball", str(install), "Hamsterball.exe", "/", "Hamsterball"],
                cwd=self.directwebgpu,
                check=True,
            )
            persistent = Path(tempfile.gettempdir()) / "directwebgpu-hamsterball-install"
            if persistent.exists():
                shutil.rmtree(persistent)
            shutil.copytree(install, persistent)
            self.start_runtime(persistent)
        return f"http://{HOST}:{RUNTIME_PORT}/hamsterball?mode=wined3d-webgpu&assetCache=warm"


def handler_factory(companion: Companion):
    class Handler(BaseHTTPRequestHandler):
        def cors(self) -> None:
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Content-Type, X-Executable-Name")

        def reply(self, status: int, payload: dict) -> None:
            data = json.dumps(payload).encode()
            self.send_response(status)
            self.cors()
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)

        def do_OPTIONS(self) -> None:
            self.send_response(204)
            self.cors()
            self.end_headers()

        def do_GET(self) -> None:
            if self.path == "/health":
                self.reply(200, {"ok": True})
            else:
                self.reply(404, {"error": "Not found"})

        def do_POST(self) -> None:
            if self.path != "/build":
                self.reply(404, {"error": "Not found"})
                return
            path = None
            try:
                if self.headers.get("X-Executable-Name", "").lower() != "hamsterball.exe":
                    raise ValueError("Choose Hamsterball.exe")
                length = int(self.headers.get("Content-Length", "0"))
                if length < 2 or length > MAX_EXE:
                    raise ValueError("Invalid executable size")
                with tempfile.NamedTemporaryFile(suffix=".exe", delete=False) as target:
                    path = Path(target.name)
                    remaining = length
                    while remaining:
                        chunk = self.rfile.read(min(1024 * 1024, remaining))
                        if not chunk:
                            raise ValueError("Upload ended early")
                        target.write(chunk)
                        remaining -= len(chunk)
                if path.read_bytes()[:2] != b"MZ":
                    raise ValueError("That file is not a Windows executable")
                self.reply(200, {"ok": True, "url": companion.build(path)})
            except subprocess.CalledProcessError as error:
                self.reply(500, {"error": f"DirectWebGPU build failed with exit code {error.returncode}"})
            except Exception as error:
                self.reply(400, {"error": str(error)})
            finally:
                if path:
                    path.unlink(missing_ok=True)

        def log_message(self, format: str, *args) -> None:
            print(f"[companion] {format % args}")

    return Handler


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--directwebgpu")
    parser.add_argument("--assets")
    parser.add_argument("--port", type=int, default=PORT)
    args = parser.parse_args()
    directwebgpu = find_directwebgpu(args.directwebgpu)
    assets = find_assets(args.assets)
    server = ThreadingHTTPServer((HOST, args.port), handler_factory(Companion(directwebgpu, assets)))
    print(f"Hamsterball companion: http://{HOST}:{args.port}")
    print(f"DirectWebGPU: {directwebgpu}")
    print(f"Assets: {assets}")
    server.serve_forever()


if __name__ == "__main__":
    main()
