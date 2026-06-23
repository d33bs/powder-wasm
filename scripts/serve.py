#!/usr/bin/env python3
"""Serve POWDER Web locally with restart-safe process management.

The server uses the correct WebAssembly MIME type and disables HTTP caching for
local iteration. A validated PID file lets a rerun replace this project's prior
preview server without killing an unrelated process that happens to use the
same port.

Usage: python3 scripts/serve.py [port] [directory]
       python3 scripts/serve.py --stop [port] [directory]
"""

import argparse
import errno
import hashlib
import http.server
import json
import os
from pathlib import Path
import signal
import socketserver
import subprocess
import sys
import tempfile
import time
from typing import Any, Dict, Optional


class Handler(http.server.SimpleHTTPRequestHandler):
    """Serve static web assets with development-friendly response headers."""

    extensions_map = dict(http.server.SimpleHTTPRequestHandler.extensions_map)
    extensions_map.update({".wasm": "application/wasm", ".js": "text/javascript"})

    def end_headers(self) -> None:
        """Add headers that prevent stale assets during local iteration."""
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, fmt: str, *args: Any) -> None:
        """Write an identifiable server log line.

        Args:
            fmt: ``printf``-style log message format.
            *args: Values interpolated into ``fmt``.
        """
        sys.stderr.write("[serve] " + (fmt % args) + "\n")


class PreviewServer(socketserver.TCPServer):
    """TCP server configured for quick local restarts."""

    allow_reuse_address = True


def parse_args() -> argparse.Namespace:
    """Parse command-line arguments.

    Returns:
        Parsed preview-server options.
    """
    default_web = Path(__file__).resolve().parent.parent / "web"
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("port", nargs="?", type=int, default=8765)
    parser.add_argument("directory", nargs="?", type=Path, default=default_web)
    parser.add_argument(
        "--stop",
        action="store_true",
        help="stop this project's managed preview server and exit",
    )
    return parser.parse_args()


def pid_file_for(directory: Path, port: int) -> Path:
    """Return a project- and port-specific PID-file path.

    Args:
        directory: Directory served by the preview server.
        port: Local TCP port used by the preview server.

    Returns:
        Path beneath the operating system's temporary directory.
    """
    identity = hashlib.sha256(str(directory.resolve()).encode("utf-8")).hexdigest()[:12]
    return Path(tempfile.gettempdir()) / f"powder-wasm-{identity}-{port}.pid"


def process_signature(pid: int) -> Optional[str]:
    """Read a stable process signature from the operating system.

    Args:
        pid: Process identifier to inspect.

    Returns:
        Start time and command line, or ``None`` when the process is absent.
    """
    result = subprocess.run(
        ["ps", "-p", str(pid), "-o", "lstart=", "-o", "command="],
        check=False,
        capture_output=True,
        text=True,
    )
    signature = result.stdout.strip()
    return signature or None


def read_pid_record(pid_file: Path) -> Optional[Dict[str, Any]]:
    """Read a managed-server PID record.

    Args:
        pid_file: PID record to read.

    Returns:
        Parsed record, or ``None`` for a missing or invalid record.
    """
    try:
        record = json.loads(pid_file.read_text(encoding="utf-8"))
        if isinstance(record.get("pid"), int) and isinstance(record.get("signature"), str):
            return record
    except (OSError, ValueError, AttributeError):
        pass
    return None


def stop_managed_server(pid_file: Path) -> bool:
    """Stop the validated preview process recorded in a PID file.

    Args:
        pid_file: PID record identifying the managed process.

    Returns:
        Whether a running managed server was stopped.
    """
    record = read_pid_record(pid_file)
    if not record:
        pid_file.unlink(missing_ok=True)
        return False

    pid = record["pid"]
    signature = process_signature(pid)
    if signature != record["signature"] or "serve.py" not in signature:
        pid_file.unlink(missing_ok=True)
        return False

    os.kill(pid, signal.SIGTERM)
    for _ in range(40):
        if process_signature(pid) is None:
            break
        time.sleep(0.05)
    else:
        raise RuntimeError(f"preview server PID {pid} did not stop")

    pid_file.unlink(missing_ok=True)
    return True


def write_pid_record(pid_file: Path) -> None:
    """Write the current preview server's validated PID record.

    Args:
        pid_file: Destination PID record.
    """
    pid = os.getpid()
    signature = process_signature(pid)
    if not signature:
        raise RuntimeError("could not identify the preview server process")
    pid_file.write_text(
        json.dumps({"pid": pid, "signature": signature}),
        encoding="utf-8",
    )


def main() -> int:
    """Run, replace, or stop the local preview server.

    Returns:
        Process exit status.
    """
    args = parse_args()
    directory = args.directory.resolve()
    pid_file = pid_file_for(directory, args.port)

    stopped = stop_managed_server(pid_file)
    if args.stop:
        message = "stopped" if stopped else "not running"
        sys.stderr.write(f"[serve] POWDER Web preview {message}\n")
        return 0
    if stopped:
        sys.stderr.write("[serve] Replaced previous POWDER Web preview server\n")

    os.chdir(directory)
    try:
        httpd = PreviewServer(("127.0.0.1", args.port), Handler)
    except OSError as error:
        if getattr(error, "errno", None) == errno.EADDRINUSE:
            sys.stderr.write(
                f"[serve] Port {args.port} is used by an unmanaged process. "
                f"Try: python3 scripts/serve.py {args.port + 1}\n"
            )
            return 1
        raise

    def exit_cleanly(_signum: int, _frame: Any) -> None:
        """Turn termination into normal cleanup before process exit."""
        raise SystemExit(0)

    signal.signal(signal.SIGTERM, exit_cleanly)
    write_pid_record(pid_file)
    try:
        with httpd:
            sys.stderr.write(
                f"[serve] POWDER Web at http://127.0.0.1:{args.port}  ({directory})\n"
            )
            httpd.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        record = read_pid_record(pid_file)
        if record and record.get("pid") == os.getpid():
            pid_file.unlink(missing_ok=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
