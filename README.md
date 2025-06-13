# ai-image

A unified wrapper for image generation APIs (OpenAI and Replicate) with CLI support and programmatic access.

## Features

- 🎨 Support for multiple image generation providers (OpenAI GPT Image, Replicate)
- 🖥️ Easy-to-use CLI interface with npx support
- 📦 Programmatic API for integration into your projects
- 🔐 Environment variable support for API keys
- 📁 Flexible output options (directory, filename)
- 🎯 TypeScript support with full type definitions
- ⚡ No installation needed with npx

## Installation

```bash
npm install ai-image
```

Or install globally for CLI usage:

```bash
npm install -g ai-image
```

Or use directly with npx (no installation required):

```bash
npx ai-image generate --prompt "Your prompt here"
```

## Setup

### API Keys

Create a `.env` file in your project root:

```env
OPENAI_API_KEY=your_openai_api_key_here
REPLICATE_API_TOKEN=your_replicate_token_here
```

Get your API keys:

- OpenAI: https://platform.openai.com/api-keys
- Replicate: https://replicate.com/account/api-tokens

For more information about OpenAI's image generation capabilities, see the [OpenAI Image Generation Guide](https://platform.openai.com/docs/guides/image-generation?image-generation-model=gpt-image-1&api=image&multi-turn=imageid).

## CLI Usage

### Quick Start with npx

No installation needed - use directly with npx:

```bash
# Generate with OpenAI GPT Image (default)
npx ai-image generate --prompt "A majestic mountain landscape at sunset"

# Generate with high quality
npx ai-image generate --prompt "Portrait of a wise owl wearing glasses" --quality high

# Generate custom size
npx ai-image generate --prompt "A futuristic robot in a garden" --size 1536x1024

# Save with custom filename
npx ai-image generate --prompt "A cozy coffee shop interior" --output coffee-shop.png
```

### Basic Usage

```bash
# Generate with OpenAI (default)
ai-image generate --prompt "A sunset over mountains"

# Use DALL-E 2 (legacy model)
ai-image generate --prompt "A vintage camera" --model dall-e-2

# Generate with Replicate
ai-image generate --prompt "A cyberpunk city at night" --provider replicate

# Specify output file
ai-image generate --prompt "A cute robot" --output robot.png

# Generate multiple images
ai-image generate --prompt "Abstract art" --number 3
```

### Advanced Options

```bash
# Custom size and quality
ai-image generate --prompt "Ocean waves" --size 1536x1024 --quality high

# Use DALL-E 2 (legacy) with multiple variations
ai-image generate --prompt "A serene zen garden" --model dall-e-2 --number 4

# Pass API key directly (useful for CI/CD or when not using .env)
ai-image generate --prompt "Forest path" --api-key sk-...

# Specify output directory
ai-image generate --prompt "Desert landscape" --output-dir ./generated-images

# Combine options with debug output
ai-image generate --prompt "A mystical dragon" --quality high --output dragon-art.png --debug
```

### Available Commands

```bash
# Generate images (prompt is required)
ai-image generate --prompt "your text here" [options]

# List available models
ai-image models

# Show setup instructions
ai-image setup
```

### Options

- `--prompt <prompt>` - **Required** Text prompt for image generation
- `-p, --provider <provider>` - Provider to use (openai or replicate, default: openai)
- `-k, --api-key <key>` - API key (overrides environment variable)
- `-o, --output <path>` - Output file path
- `-d, --output-dir <dir>` - Output directory
- `-m, --model <model>` - Model to use (dall-e-2 for legacy)
- `-s, --size <size>` - Image size (1024x1024, 1536x1024, 1024x1536)
- `-q, --quality <quality>` - Image quality (low, medium, high, auto) - OpenAI only
- `-f, --format <format>` - Output format (png, jpeg, webp) - OpenAI only
- `-n, --number <n>` - Number of images to generate
- `--debug` - Enable debug logging

## Programmatic Usage

### Basic Example

```typescript
import { ImageGenerator } from "ai-image";

// Create generator instance
const generator = new ImageGenerator({
  provider: "openai",
  outputDir: "./images",
});

// Generate image with DALL-E 3 (default)
const paths = await generator.generate({
  prompt: "A serene lake at dawn",
  size: "1024x1024",
  quality: "hd",
});

console.log("Images saved to:", paths);
```

### Using Different OpenAI Models

```typescript
import { ImageGenerator } from "ai-image";

const generator = new ImageGenerator({
  provider: "openai",
  outputDir: "./ai-art",
});

// Use DALL-E 3 with HD quality
const dalle3Paths = await generator.generate({
  prompt: "A futuristic city with flying cars",
  model: "dall-e-3",
  quality: "hd",
  style: "vivid",
  size: "1792x1024",
});

// Use DALL-E 2 for multiple variations
const dalle2Paths = await generator.generate({
  prompt: "An abstract representation of music",
  model: "dall-e-2",
  size: "512x512",
  n: 4, // Generate 4 variations
});
```

### Using Replicate

```typescript
import { ImageGenerator } from "ai-image";

const generator = new ImageGenerator({
  provider: "replicate",
  apiKey: "your-api-key", // Optional if using .env
  outputFilename: "my-image.png",
});

const paths = await generator.generate({
  prompt: "A futuristic space station",
  model:
    "stability-ai/sdxl:39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b",
  n: 2,
});
```

### Custom Output Handling

```typescript
import { ImageGenerator } from "ai-image";
import path from "path";

const generator = new ImageGenerator({
  provider: "openai",
  outputDir: path.join(__dirname, "output"),
  outputFilename: "custom-name.png",
});

// Generate multiple images with custom naming
const paths = await generator.generate({
  prompt: "Abstract geometric patterns",
  n: 3,
});
// Will save as: custom-name.png, custom-name_1.png, custom-name_2.png
```

## Supported Models

### OpenAI

- `gpt-image-1` (default) - Latest GPT Image model with best quality
  - Sizes: 1024x1024, 1536x1024, 1024x1536
  - Quality: low, medium, high, auto
- `dall-e-2` (legacy) - Previous generation DALL-E model
  - Sizes: 256x256, 512x512, 1024x1024
  - Supports generating up to 10 variations

### Replicate

- `stability-ai/sdxl` (default) - Stable Diffusion XL
- `stability-ai/stable-diffusion` - Stable Diffusion
- Any model from replicate.com in format `owner/model:version`

## Error Handling

```typescript
try {
  const paths = await generator.generate({
    prompt: "Mountain landscape",
  });
} catch (error) {
  console.error("Generation failed:", error.message);
}
```

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
