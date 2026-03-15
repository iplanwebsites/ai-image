# ai-image

Unified image generation + CLIP vision analysis. 10 providers, local Apple Silicon support, CLI and programmatic API.

## Features

- **Image Generation** — OpenAI, Replicate, Stability AI, FAL.ai, Together AI, BFL, Google Imagen, Fireworks, Ollama, and local (MFLUX on Apple Silicon)
- **CLIP Classification** — zero-shot image classification using Apple's MobileCLIP-S1 (local, no API key)
- **CLIP Embeddings** — 512-dim image and text embeddings for similarity search, clustering, etc.
- **CLI + API** — use from the command line or as a TypeScript library
- **Auto-managed local server** — Python server auto-installs and auto-starts on first local/CLIP call, sleeps after idle

## Installation

```bash
npm install ai-image
```

Or use directly with npx:

```bash
npx ai-image generate --prompt "A sunset over mountains"
npx ai-image classify --image photo.jpg --labels cat dog bird
```

## CLIP: Classify & Embed (local, no API key)

CLIP features use Apple's [MobileCLIP-S1](https://huggingface.co/apple/MobileCLIP-S1-OpenCLIP) — 4.8x faster than standard CLIP, runs locally on Mac. The model (~85MB) downloads automatically on first use.

### CLI

```bash
# Zero-shot classification
ai-image classify --image photo.jpg --labels cat dog bird
#  cat                  95.2%  █████████████████████████████
#  dog                   3.1%  █
#  bird                  1.7%

# Save classification to JSON
ai-image classify --image photo.jpg --labels cat dog bird -o result.json

# Get image embedding (512 dims)
ai-image embed --image photo.jpg
ai-image embed --image photo.jpg -o embedding.json

# Get text embedding
ai-image embed --text "a photo of a sunset"

# JSON output (for scripting)
ai-image classify --image photo.jpg --labels cat dog --json
ai-image embed --image photo.jpg --json
```

### Programmatic API

```typescript
import { classifyImage, embedImage, embedText } from "ai-image";

// Zero-shot classification
const result = await classifyImage("photo.jpg", ["cat", "dog", "bird"]);
// { labels: [{ label: "cat", score: 0.95 }, ...], elapsed: 0.06 }

// Image embedding
const { embedding } = await embedImage("photo.jpg");
// embedding: number[] (512 dims, normalized)

// Text embedding
const { embedding: textEmb } = await embedText("a sunset over the ocean");

// Cosine similarity (embeddings are pre-normalized, so dot product = cosine sim)
const similarity = embedding.reduce((sum, v, i) => sum + v * textEmb[i], 0);
```

Or using the class API:

```typescript
import { ImageGenerator } from "ai-image";

const gen = new ImageGenerator({ provider: "local" });

const result = await gen.classifyImage({
  imagePath: "photo.jpg",
  labels: ["cat", "dog", "bird"],
});

const { embedding } = await gen.embed({ imagePath: "photo.jpg" });
const { embedding: textEmb } = await gen.embed({ text: "a cat" });
```

## Image Generation

### CLI

```bash
# OpenAI (default)
ai-image generate --prompt "A sunset over mountains"

# Local Apple Silicon (no API key needed)
ai-image generate --prompt "A robot in a garden" -p local

# Other providers
ai-image generate --prompt "Cyberpunk city" -p replicate
ai-image generate --prompt "Abstract art" -p stability
ai-image generate --prompt "Ocean waves" -p fal
ai-image generate --prompt "Forest path" -p together
ai-image generate --prompt "Mountain lake" -p bfl
ai-image generate --prompt "Space station" -p google
ai-image generate --prompt "Desert sunset" -p fireworks
ai-image generate --prompt "City skyline" -p ollama

# Options
ai-image generate --prompt "..." --size 1024x1024 --quality high --format png
ai-image generate --prompt "..." --seed 42 --steps 20 --guidance-scale 7.5
ai-image generate --prompt "..." -o output.png --json
```

### Programmatic API

```typescript
import { generateImage, ImageGenerator } from "ai-image";

// One-shot
const result = await generateImage("A sunset over mountains", {
  provider: "openai",
  size: "1024x1024",
});
console.log(result.filePaths);

// Class API (reuse client)
const gen = new ImageGenerator({
  provider: "openai",
  outputDir: "./images",
});
const result = await gen.generate({
  prompt: "A futuristic city",
  quality: "high",
  n: 2,
});
```

## Metadata Sidecar Files

Generate a `.metadata.json` file alongside each image with generation parameters and CLIP data. Works with **any provider** — the local CLIP server auto-starts when needed.

### CLI

```bash
# Basic metadata (generation params + CLIP embedding)
ai-image generate --prompt "A cat on a roof" -p openai --metadata

# With CLIP classification labels
ai-image generate --prompt "A cat on a roof" -p openai --metadata --metadata-labels cat dog building sky

# Works with any provider
ai-image generate --prompt "A sunset" -p local --metadata --metadata-labels landscape nature urban
ai-image generate --prompt "A sunset" -p replicate --metadata
```

### Programmatic API

```typescript
const result = await generator.generate({
  prompt: "A cat on a roof",
  metadata: true,
  metadataLabels: ["cat", "dog", "building", "sky"],
});
// Writes: A_cat_on_a_roof.metadata.json alongside A_cat_on_a_roof.png
```

### Output format

```json
{
  "image": "A_cat_on_a_roof.png",
  "provider": "openai",
  "model": "gpt-image-1",
  "prompt": "A cat on a roof",
  "size": "1024x1024",
  "seed": 42,
  "elapsed": 5200,
  "generatedAt": "2026-03-15T04:53:52.191Z",
  "clip": {
    "embedding": [0.01, -0.03, "... 512 dims"],
    "labels": [
      { "label": "cat", "score": 0.82 },
      { "label": "building", "score": 0.15 },
      { "label": "sky", "score": 0.02 },
      { "label": "dog", "score": 0.01 }
    ]
  }
}
```

- `clip.embedding` — 512-dim normalized vector (always included when local server is available)
- `clip.labels` — only included when `--metadata-labels` / `metadataLabels` is provided
- If the local server can't start (no Python, not macOS), metadata is still written without the `clip` field

## Setup

### API Keys

Create a `.env` file or set environment variables:

```env
OPENAI_API_KEY=...          # OpenAI
REPLICATE_API_TOKEN=...     # Replicate
STABILITY_API_KEY=...       # Stability AI
FAL_KEY=...                 # FAL.ai
TOGETHER_API_KEY=...        # Together AI
BFL_API_KEY=...             # Black Forest Labs
GOOGLE_API_KEY=...          # Google Imagen
FIREWORKS_API_KEY=...       # Fireworks AI
# Ollama and local need no API key
```

### Local Server (Apple Silicon)

The `local` provider and all CLIP features use a Python server that runs locally on Apple Silicon. It auto-installs to `~/.ai-image/` on first use (requires Python 3.11+).

```bash
# Manual start (optional — auto-starts when needed)
~/.ai-image/server/.venv/bin/ai-image-server

# Clean reinstall
rm -rf ~/.ai-image
```

## Supported Providers

| Provider | Models | API Key |
|----------|--------|---------|
| OpenAI | GPT Image 1, DALL-E 2 | `OPENAI_API_KEY` |
| Replicate | SDXL, Flux, SD3, any model | `REPLICATE_API_TOKEN` |
| Stability AI | SD 3.5 Large/Turbo | `STABILITY_API_KEY` |
| FAL.ai | Flux Dev/Schnell/Pro | `FAL_KEY` |
| Together AI | Flux Schnell (free), SDXL | `TOGETHER_API_KEY` |
| BFL | Flux Pro 1.1/Dev | `BFL_API_KEY` |
| Google | Imagen 4/4 Fast/4 Ultra | `GOOGLE_API_KEY` |
| Fireworks | Flux Schnell FP8 | `FIREWORKS_API_KEY` |
| Ollama | Flux 2 Klein, Z-Image | none (local) |
| Local | FLUX.2 Klein 4B (MFLUX) | none (Apple Silicon) |

Run `ai-image models` or `ai-image models --json` for the full list.

## TypeScript Types

All types are exported:

```typescript
import type {
  // Generation
  ImageGenerator,
  ImageGeneratorOptions,
  GenerateOptions,
  GenerateResult,
  Provider,
  // CLIP
  ClassifyOptions,
  ClassifyResult,
  EmbedOptions,
  EmbedResult,
} from "ai-image";
```

## License

MIT
