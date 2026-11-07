#!/usr/bin/env python3
"""Local test server for site/ with the same security headers as production nginx.
usage: tests/serve.py [port]   then open http://127.0.0.1:PORT/linux/
The site is mounted under /linux/ to prove that all paths are relative."""
import http.server, os, sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "site")
CSP = ("default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; "
       "connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'")


class H(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=ROOT, **k)

    def translate_path(self, path):
        if path.startswith("/linux/") or path == "/linux":
            path = path[len("/linux"):] or "/"
        else:
            return os.path.join(ROOT, "__404__")
        return super().translate_path(path)

    def end_headers(self):
        self.send_header("Content-Security-Policy", CSP)
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()

    def log_message(self, *a):
        pass


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8123
    http.server.ThreadingHTTPServer(("127.0.0.1", port), H).serve_forever()
