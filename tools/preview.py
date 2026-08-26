"""Serve the static site locally while keeping deployed files unchanged.

The generated HTML uses absolute yichun835.github.io URLs.  When opened from
localhost, their SRI-protected CSS and JavaScript are cross-origin resources
and browsers block them.  This server rewrites only the outgoing HTML response
so the browser loads those assets from the local checkout instead.
"""

from __future__ import annotations

import argparse
import io
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import ClassVar
from urllib.parse import urlsplit


PROJECT_ROOT = Path(__file__).resolve().parents[1]
SITE_ORIGIN = b"https://yichun835.github.io/"


class PreviewRequestHandler(SimpleHTTPRequestHandler):
    """Static-file handler that serves HTML with local asset URLs."""

    extensions_map: ClassVar[dict[str, str]] = {
        **SimpleHTTPRequestHandler.extensions_map,
        ".svg": "image/svg+xml",
    }

    def end_headers(self) -> None:
        request_suffix = Path(urlsplit(self.path).path).suffix.lower()
        if request_suffix in {".css", ".js"}:
            self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def send_head(self) -> io.BytesIO | None:
        request_path = urlsplit(self.path).path
        local_path = Path(self.translate_path(self.path))
        if local_path.is_dir() and request_path.endswith("/"):
            local_path /= "index.html"

        if local_path.is_file() and local_path.suffix.lower() == ".html":
            contents = local_path.read_bytes().replace(SITE_ORIGIN, b"/")
            self.send_response(HTTPStatus.OK)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(contents)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            return io.BytesIO(contents)

        return super().send_head()


def main() -> None:
    parser = argparse.ArgumentParser(description="Preview the homepage locally")
    parser.add_argument("--port", type=int, default=8000)
    args = parser.parse_args()

    handler = lambda *handler_args, **handler_kwargs: PreviewRequestHandler(
        *handler_args, directory=str(PROJECT_ROOT), **handler_kwargs
    )
    with ThreadingHTTPServer(("127.0.0.1", args.port), handler) as server:
        print(f"Previewing at http://127.0.0.1:{args.port}")
        server.serve_forever()


if __name__ == "__main__":
    main()
