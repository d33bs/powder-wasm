#!/usr/bin/env python3
"""Minimal static file server for POWDER Web (local dev / preview).

`python -m http.server` evaluates os.getcwd() at startup, which fails in some
sandboxed launchers ("Operation not permitted"). This server instead takes an
explicit directory, chdir-s into it first, and sets the correct
application/wasm MIME type so WebAssembly streaming compilation works.

Usage:  python3 scripts/serve.py [port] [directory]
        (defaults: port 8765, the sibling web/ directory)
"""
import http.server
import os
import socketserver
import sys

port = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
if len(sys.argv) > 2:
    directory = sys.argv[2]
else:
    here = os.path.dirname(os.path.abspath(__file__))
    directory = os.path.join(os.path.dirname(here), "web")

os.chdir(directory)


class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = dict(http.server.SimpleHTTPRequestHandler.extensions_map)
    extensions_map.update({".wasm": "application/wasm", ".js": "text/javascript"})

    def end_headers(self):
        # Avoid stale caches while iterating locally.
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, fmt, *args):
        sys.stderr.write("[serve] " + (fmt % args) + "\n")


socketserver.TCPServer.allow_reuse_address = True
with socketserver.TCPServer(("127.0.0.1", port), Handler) as httpd:
    sys.stderr.write("[serve] POWDER Web at http://127.0.0.1:%d  (%s)\n"
                     % (port, directory))
    httpd.serve_forever()
