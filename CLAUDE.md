# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a TypeScript package for unified image generation using OpenAI and Replicate APIs. It provides both a programmatic API and CLI interface for generating images from text prompts.

## Development Commands

- `npm run build` - Build TypeScript to JavaScript in dist/
- `npm run dev` - Run CLI in development mode with tsx (e.g. `npm run dev generate --prompt "text"`)
- `npm run prepublishOnly` - Build before publishing (runs automatically)

## Architecture

The codebase has two main entry points:

1. **`src/index.ts`** - Main library with `ImageGenerator` class
   - Handles both OpenAI and Replicate providers
   - Manages file output, naming, and collision handling
   - Supports various image formats and quality settings

2. **`src/cli.ts`** - Command-line interface using Commander.js
   - Wraps the ImageGenerator class
   - Provides generate, models, and setup commands
   - Handles CLI-specific options and user feedback

## Key Features

- **Multi-provider support**: OpenAI (GPT Image, DALL-E 2) and Replicate (SDXL, etc.)
- **Flexible output**: Custom filenames, directories, collision handling
- **Format options**: PNG, JPEG, WebP with compression control
- **Environment variable support**: API keys via .env files
- **Debug mode**: Detailed logging for troubleshooting

## Environment Setup

The application expects API keys in environment variables:
- `OPENAI_API_KEY` for OpenAI provider
- `REPLICATE_API_TOKEN` for Replicate provider

## Testing

No test framework is configured in this project. When adding tests, determine the appropriate framework based on the existing TypeScript setup.

## Important Notes

- Image generation is asynchronous and can take several seconds
- File naming automatically sanitizes prompts and handles collisions
- The CLI provides loading indicators and detailed error messages
- Debug mode is available for troubleshooting API requests