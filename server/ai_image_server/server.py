#!/usr/bin/env python3
"""HTTP server that keeps the model loaded and generates images from POST requests.

    POST /generate
    {
      "prompt": "A puffin eating pizza",
      "output": "output/puffin.png",
      "width": 512,
      "height": 512,
      "steps": 9,
      "seed": 42,
      "guidance": null,
      "negative_prompt": null,
      "image_path": null,
      "image_strength": null
    }

Only "prompt" is required. Returns the PNG as the response body (with the path in headers),
or saves to "output" path if provided.

    GET /health
    Returns {"status": "ok", "model": "loaded"}

Auto-sleep: with --auto-sleep <seconds>, the server shuts down after being idle
for the specified duration. Useful when auto-started by a client.
"""

import argparse
import io
import json
import os
import random
import signal
import time
from http.server import HTTPServer, BaseHTTPRequestHandler
from pathlib import Path
from threading import Lock, Timer

from ai_image_server.cli import MODELS, load_model

_model = None
_model_lock = Lock()
_defaults = {}
_sleep_timer = None
_sleep_timeout = None
_server = None


def _reset_sleep_timer():
    """Reset the auto-sleep countdown. Called after every request."""
    global _sleep_timer
    if _sleep_timeout is None:
        return
    if _sleep_timer is not None:
        _sleep_timer.cancel()
    _sleep_timer = Timer(_sleep_timeout, _auto_shutdown)
    _sleep_timer.daemon = True
    _sleep_timer.start()


def _auto_shutdown():
    print(f"\nAuto-sleep: no requests for {_sleep_timeout}s, shutting down.")
    os.kill(os.getpid(), signal.SIGINT)


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/health":
            _reset_sleep_timer()
            self._json_response(200, {
                "status": "ok",
                "model": "loaded" if _model else "loading",
                "auto_sleep": _sleep_timeout,
            })
            return
        self._json_response(404, {"error": "not found"})

    def do_POST(self):
        if self.path != "/generate":
            self._json_response(404, {"error": "not found"})
            return

        try:
            length = int(self.headers.get("Content-Length", 0))
            body = json.loads(self.rfile.read(length)) if length else {}
        except (json.JSONDecodeError, ValueError) as e:
            self._json_response(400, {"error": f"invalid JSON: {e}"})
            return

        prompt = body.get("prompt")
        if not prompt:
            self._json_response(400, {"error": "prompt is required"})
            return

        output = body.get("output")
        if output:
            output_path = Path(output)
            if output_path.exists():
                self._json_response(409, {"error": f"file already exists: {output}", "hint": "choose a different path or delete the existing file"})
                return

        width = body.get("width") or _defaults["width"]
        height = body.get("height") or _defaults["height"]
        steps = body.get("steps") or _defaults["steps"]
        seed = body.get("seed") if body.get("seed") is not None else random.randint(0, 2**32 - 1)

        gen_kwargs = {
            "prompt": prompt,
            "seed": seed,
            "num_inference_steps": steps,
            "width": width,
            "height": height,
        }
        for key in ("guidance", "negative_prompt", "image_path", "image_strength"):
            if body.get(key) is not None:
                gen_kwargs[key] = body[key]

        self.log_message(f"Generating: {prompt!r} | {width}x{height} | {steps} steps | seed {seed}")
        start = time.time()

        with _model_lock:
            result = _model.generate_image(**gen_kwargs)

        elapsed = time.time() - start
        self.log_message(f"Done in {elapsed:.1f}s")

        _reset_sleep_timer()

        # Save to disk if output path requested
        if output:
            output_path = Path(output)
            output_path.parent.mkdir(parents=True, exist_ok=True)
            result.save(str(output_path))
            self._json_response(200, {
                "status": "ok",
                "output": str(output_path),
                "seed": seed,
                "elapsed": round(elapsed, 1),
            })
        else:
            # Return PNG bytes directly
            buf = io.BytesIO()
            if hasattr(result, "image"):
                result.image.save(buf, format="PNG")
            else:
                result.save(buf, format="PNG")
            png_bytes = buf.getvalue()

            self.send_response(200)
            self.send_header("Content-Type", "image/png")
            self.send_header("Content-Length", str(len(png_bytes)))
            self.send_header("X-Seed", str(seed))
            self.send_header("X-Elapsed", f"{elapsed:.1f}")
            self.end_headers()
            self.wfile.write(png_bytes)

    def _json_response(self, code: int, data: dict):
        body = json.dumps(data).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format, *args):
        print(f"[{self.log_date_time_string()}] {format % args}" if args else f"[{self.log_date_time_string()}] {format}")


def main():
    parser = argparse.ArgumentParser(description="Local image generation HTTP server (ai-image)")
    parser.add_argument("-p", "--port", type=int, default=8506, help="Port (default: 8506)")
    parser.add_argument("--host", default="127.0.0.1", help="Bind address (default: 127.0.0.1)")
    parser.add_argument("-q", "--quantize", type=int, choices=[4, 8], default=8, help="Quantization level (default: 8)")
    parser.add_argument("-m", "--model", default="flux2-klein-4b", choices=MODELS, help="Model to use")
    parser.add_argument("--auto-sleep", type=int, default=None, metavar="SECONDS",
                        help="Shut down after N seconds of inactivity (default: run forever)")
    args = parser.parse_args()

    global _model, _defaults, _sleep_timeout, _server
    _defaults = MODELS[args.model]["defaults"]
    _sleep_timeout = args.auto_sleep

    print(f"Loading model: {args.model} (q{args.quantize})...")
    _model = load_model(args.model, args.quantize, None, None)
    print(f"Model loaded.")

    _server = HTTPServer((args.host, args.port), Handler)
    print(f"Listening on http://{args.host}:{args.port}")
    print(f"  POST /generate  - generate an image")
    print(f"  GET  /health    - health check")
    if _sleep_timeout:
        print(f"  Auto-sleep after {_sleep_timeout}s of inactivity")
    _reset_sleep_timer()
    try:
        _server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down.")
        _server.server_close()


if __name__ == "__main__":
    main()
