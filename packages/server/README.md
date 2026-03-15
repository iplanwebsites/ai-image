# ai-image-local-python-server

Local image generation + CLIP vision server for Apple Silicon. Uses [MFLUX](https://github.com/filipstrand/mflux) (native MLX) for image generation and Apple's [MobileCLIP-S1](https://huggingface.co/apple/MobileCLIP-S1-OpenCLIP) for fast CLIP embeddings and zero-shot classification.

This is the local backend for the [`ai-image`](https://www.npmjs.com/package/ai-image) npm package's `local` provider.

## How it works

```
POST /generate  ──> [MFLUX] ──> [FLUX.2 Klein 4B on MLX] ──> PNG response
POST /classify  ──> [MobileCLIP-S1] ──> zero-shot classification scores
POST /embed     ──> [MobileCLIP-S1] ──> 512-dim embedding vector
                      │
                      ├── runs natively on Apple Silicon (no CUDA needed)
                      ├── model weights cached in ~/.cache/huggingface/hub/
                      └── CLIP model loads lazily on first classify/embed request
```

The generation model loads at startup into Apple Silicon unified memory. The CLIP model (MobileCLIP-S1, ~85MB) loads lazily on first `/classify` or `/embed` request and stays in memory. CLIP and generation use separate locks so they don't block each other.

With `--auto-sleep`, the server shuts down after a period of inactivity — useful
when auto-started by the `ai-image` npm package on first request.

## Setup

```bash
cd server
uv venv && uv pip install -e .
```

## Commands

### `ai-image-server` — HTTP server (recommended)

```bash
# Start the server (keeps model loaded, processes HTTP requests)
ai-image-server

# With auto-sleep (shut down after 5 minutes idle)
ai-image-server --auto-sleep 300

# Custom port
ai-image-server -p 9000
```

#### API

**`POST /generate`** — generate an image

```bash
# Save to file
curl -X POST http://localhost:8506/generate \
  -H "Content-Type: application/json" \
  -d '{"prompt": "A puffin eating pizza", "output": "puffin.png", "seed": 42}'

# Get PNG bytes back
curl -X POST http://localhost:8506/generate \
  -H "Content-Type: application/json" \
  -d '{"prompt": "A puffin eating pizza"}' \
  -o puffin.png
```

Request body (only `prompt` is required):

```json
{
  "prompt": "A puffin eating pizza",
  "output": "path/to/save.png",
  "width": 512,
  "height": 512,
  "steps": 9,
  "seed": 42,
  "guidance": null,
  "negative_prompt": null,
  "image_path": null,
  "image_strength": null
}
```

- If `output` is set, saves to disk and returns JSON. Refuses to overwrite (409).
- If `output` is omitted, returns raw PNG bytes with seed/timing in headers.

**`POST /classify`** — zero-shot image classification (CLIP)

```bash
curl -X POST http://localhost:8506/classify \
  -H "Content-Type: application/json" \
  -d '{"image_path": "/path/to/photo.jpg", "labels": ["cat", "dog", "bird"]}'
# {"labels": [{"label": "cat", "score": 0.95}, {"label": "dog", "score": 0.04}, ...], "elapsed": 0.06}
```

Request body:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `image_path` | string | yes | Absolute path to image file |
| `labels` | string[] | yes | Text labels to classify against |

Returns softmax probabilities (scores sum to 1), sorted highest first.

**`POST /embed`** — get CLIP embedding for an image or text

```bash
# Image embedding
curl -X POST http://localhost:8506/embed \
  -H "Content-Type: application/json" \
  -d '{"image_path": "/path/to/photo.jpg"}'

# Text embedding
curl -X POST http://localhost:8506/embed \
  -H "Content-Type: application/json" \
  -d '{"text": "a photo of a sunset"}'

# {"embedding": [0.01, -0.03, ...], "elapsed": 0.05}
```

Request body (one of `image_path` or `text` required):

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `image_path` | string | no | Absolute path to image file |
| `text` | string | no | Text to embed |

Returns a 512-dimensional normalized embedding vector. Image and text embeddings are in the same space — use dot product for cosine similarity.

**`GET /health`** — health check

```bash
curl http://localhost:8506/health
# {"status": "ok", "model": "loaded", "auto_sleep": null}
```

### `ai-image-generate` — one-shot CLI

```bash
ai-image-generate "A bull on Wall Street" -o bull.png
ai-image-generate "Stock chart" -W 1024 -H 1024 -s 20 --seed 42
```

### `ai-image-worker` — filesystem queue worker

```bash
ai-image-worker  # watches jobs/pending/ for JSON files
```

## Server options

| Flag | Description | Default |
|---|---|---|
| `-p, --port` | Port | `8506` |
| `--host` | Bind address | `127.0.0.1` |
| `-q, --quantize` | Quantization: `4` or `8` | `8` |
| `-m, --model` | Model to use | `flux2-klein-4b` |
| `--auto-sleep` | Shut down after N seconds idle | disabled |

## Model cache

Models are downloaded from HuggingFace on first use and cached at `~/.cache/huggingface/hub/`.

```bash
# Check disk usage
du -sh ~/.cache/huggingface/hub/models--*

# Remove cached model
rm -rf ~/.cache/huggingface/hub/models--black-forest-labs--FLUX.2-klein-4B
```

## RAM requirements

| Quantization | RAM needed | Model on disk |
|---|---|---|
| q8 | ~16 GB | ~4 GB |
| q4 | ~12 GB | ~2.5 GB |
| none | ~24 GB | ~8 GB |
