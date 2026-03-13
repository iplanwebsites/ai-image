---
name: generate-image
description: Generate images from text prompts using ai-image CLI. Use when the user asks to create, generate, or make an image.
user-invocable: true
allowed-tools: Bash, Read, Write
argument-hint: "[prompt text]"
---

# Image Generation with ai-image

Generate images from text prompts using the `ai-image` CLI. Always use `--json` for structured output.

## Basic Usage

```bash
npx ai-image generate --prompt "$ARGUMENTS" --json
```

## With specific provider

```bash
npx ai-image generate --prompt "$ARGUMENTS" -p together --json
npx ai-image generate --prompt "$ARGUMENTS" -p fal --json
npx ai-image generate --prompt "$ARGUMENTS" -p google --json
npx ai-image generate --prompt "$ARGUMENTS" -p ollama --json
```

## Provider Selection Guide

- **Fast + Free**: `together` (FLUX.1-schnell-Free, no cost)
- **Fast + Paid**: `fal` with `-m fal-ai/flux/schnell` or `fireworks`
- **Highest quality**: `openai` (gpt-image-1) or `google` (imagen-4.0-ultra-generate-001)
- **Local/offline**: `ollama` (requires Ollama running locally)
- **Direct BFL API**: `bfl` (flux-pro-1.1)

## Key Flags

| Flag | Description |
|---|---|
| `--prompt <text>` | Required. Image description |
| `-p <provider>` | openai, replicate, stability, fal, together, bfl, google, fireworks, ollama |
| `-k <key>` | Pass API key directly |
| `-o <path>` | Output file path |
| `-d <dir>` | Output directory |
| `-m <model>` | Override default model |
| `-s <WxH>` | Size (default 1024x1024) |
| `-n <count>` | Number of images |
| `--json` | Machine-readable JSON output |
| `--seed <n>` | Reproducible output |

## JSON Output

```json
{
  "success": true,
  "provider": "together",
  "model": "black-forest-labs/FLUX.1-schnell-Free",
  "files": ["/path/to/image.png"],
  "elapsed_ms": 2100
}
```

## Tips

1. Always use `--json` when calling from this skill
2. Set `--output-dir` to save images in a specific location
3. Use `--seed` for reproducible results
4. Check available models with `npx ai-image models --json`
5. API keys can be in `.env` or passed with `-k`
