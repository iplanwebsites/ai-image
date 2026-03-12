# ai-image: Generate Images via CLI

Use the `ai-image` CLI to generate images from text prompts. This tool supports 7 providers.

## Quick Usage

```bash
npx ai-image generate --prompt "your prompt" --json
```

## Providers & Defaults

| Provider flag | Default model | Env var |
|---|---|---|
| `openai` | gpt-image-1 | `OPENAI_API_KEY` |
| `replicate` | stability-ai/sdxl | `REPLICATE_API_TOKEN` |
| `stability` | sd3.5-large | `STABILITY_API_KEY` |
| `fal` | fal-ai/flux/dev | `FAL_KEY` |
| `together` | FLUX.1-schnell-Free | `TOGETHER_API_KEY` |
| `bfl` | flux-pro-1.1 | `BFL_API_KEY` |
| `google` | imagen-4.0-generate-001 | `GOOGLE_API_KEY` |

## Key Options

- `--prompt <text>` — Required. The image description.
- `-p, --provider <name>` — Provider (default: openai)
- `-k, --api-key <key>` — Pass API key directly
- `-o, --output <path>` — Output file path
- `-d, --output-dir <dir>` — Output directory
- `-m, --model <model>` — Override default model
- `-s, --size <WxH>` — Image size (default: 1024x1024)
- `-n, --number <n>` — Number of images
- `-f, --format <fmt>` — png, jpeg, webp
- `--negative-prompt <text>` — What to avoid
- `--seed <n>` — Reproducible generation
- `--json` — Machine-readable JSON output

## JSON Output Format

When using `--json`, stdout contains:
```json
{
  "success": true,
  "provider": "openai",
  "model": "gpt-image-1",
  "files": ["/path/to/image.png"],
  "elapsed_ms": 4523
}
```

## Best Practices

1. Always use `--json` when calling from scripts or skills
2. Use `--output` to control the filename
3. Use `--output-dir` to save to a specific directory
4. Pass `--api-key` directly if env vars are not set
5. For fastest results: use `together` provider with default model (free), or `fal` with `fal-ai/flux/schnell`
6. For highest quality: use `openai` with `gpt-image-1`, or `google` with `imagen-4.0-ultra-generate-001`
