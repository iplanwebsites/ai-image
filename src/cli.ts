#!/usr/bin/env node

import { Command } from 'commander';
import { ImageGenerator, Provider, GenerateResult } from './index.js';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const program = new Command();

const isTTY = process.stdout.isTTY;

program
  .name('ai-image')
  .description('Generate images using OpenAI, Replicate, Stability AI, or FAL.ai')
  .version('0.1.0');

program
  .command('generate')
  .alias('gen')
  .description('Generate an image from a text prompt')
  .option('--prompt <prompt>', 'Text prompt for image generation')
  .option('-p, --provider <provider>', 'Provider: openai, replicate, stability, fal, together, bfl', 'openai')
  .option('-k, --api-key <key>', 'API key (overrides environment variable)')
  .option('-o, --output <path>', 'Output file path')
  .option('-d, --output-dir <dir>', 'Output directory', process.cwd())
  .option('-m, --model <model>', 'Model to use (provider-specific)')
  .option('-s, --size <size>', 'Image size WxH (e.g. 1024x1024)', '1024x1024')
  .option('-q, --quality <quality>', 'Image quality (low, medium, high, auto) - OpenAI', 'auto')
  .option('-f, --format <format>', 'Output format (png, jpeg, webp)', 'png')
  .option('-c, --compression <compression>', 'Compression level 0-100% for JPEG/WebP')
  .option('-b, --background <background>', 'Background (transparent, opaque) - OpenAI')
  .option('--negative-prompt <text>', 'Negative prompt (Replicate, Stability, FAL)')
  .option('--guidance-scale <n>', 'Guidance/CFG scale (Replicate, Stability, FAL)')
  .option('--steps <n>', 'Inference steps (Replicate, Stability, FAL)')
  .option('--seed <n>', 'Seed for reproducibility')
  .option('--style-preset <style>', 'Style preset (Stability AI)')
  .option('--debug', 'Enable debug logging to show full request parameters')
  .option('-n, --number <n>', 'Number of images to generate', '1')
  .option('--json', 'Output result as JSON (for scripting and Claude skills)')
  .action(async (options) => {
    try {
      if (options.debug) {
        console.error('[debug] CLI received parameters:');
        console.error('Prompt:', options.prompt);
        console.error('Options:', JSON.stringify(options, null, 2));
      }

      if (!options.prompt) {
        if (options.json) {
          console.log(JSON.stringify({ error: 'Prompt is required. Use --prompt "your prompt text"' }));
        } else {
          console.error('Error: Prompt is required. Use --prompt "your prompt text"');
        }
        process.exit(1);
      }

      const provider = options.provider.toLowerCase() as Provider;

      if (!['openai', 'replicate', 'stability', 'fal', 'together', 'bfl'].includes(provider)) {
        const msg = 'Provider must be one of: openai, replicate, stability, fal, together, bfl';
        if (options.json) {
          console.log(JSON.stringify({ error: msg }));
        } else {
          console.error(`Error: ${msg}`);
        }
        process.exit(1);
      }

      let outputDir = options.outputDir;
      let outputFilename = options.output;

      if (options.output) {
        const parsed = path.parse(options.output);
        if (parsed.dir) {
          outputDir = parsed.dir;
          outputFilename = parsed.base;
        }
      }

      const generator = new ImageGenerator({
        provider,
        apiKey: options.apiKey,
        outputDir,
        outputFilename
      });

      // Loading animation — only show on interactive terminals
      let loadingInterval: ReturnType<typeof setInterval> | undefined;
      const startTime = Date.now();

      if (isTTY && !options.json) {
        const providerNames: Record<string, string> = {
          openai: 'OpenAI',
          replicate: 'Replicate',
          stability: 'Stability AI',
          fal: 'FAL.ai',
          together: 'Together AI',
          bfl: 'Black Forest Labs',
        };
        const providerText = providerNames[provider] || provider;
        const loadingFrames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
        let frameIndex = 0;
        loadingInterval = setInterval(() => {
          const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
          process.stderr.write(`\r${loadingFrames[frameIndex]} Generating via ${providerText} (${elapsed}s)...`);
          frameIndex = (frameIndex + 1) % loadingFrames.length;
        }, 100);
      }

      try {
        const generateOptions: Record<string, unknown> = {
          prompt: options.prompt,
          model: options.model,
          size: options.size,
          quality: options.quality,
          format: options.format,
          n: parseInt(options.number),
        };

        if (options.compression) generateOptions.compression = parseInt(options.compression);
        if (options.background) generateOptions.background = options.background;
        if (options.negativePrompt) generateOptions.negativePrompt = options.negativePrompt;
        if (options.guidanceScale) generateOptions.guidanceScale = parseFloat(options.guidanceScale);
        if (options.steps) generateOptions.steps = parseInt(options.steps);
        if (options.seed) generateOptions.seed = parseInt(options.seed);
        if (options.stylePreset) generateOptions.stylePreset = options.stylePreset;
        if (options.debug) generateOptions.debug = true;

        const result = await generator.generate(generateOptions as any) as GenerateResult;

        if (loadingInterval) {
          clearInterval(loadingInterval);
          process.stderr.write('\r\x1b[K'); // clear the spinner line
        }

        if (options.json) {
          // Machine-readable output for Claude skills / scripting
          console.log(JSON.stringify({
            success: true,
            provider: result.provider,
            model: result.model,
            files: result.filePaths,
            elapsed_ms: result.elapsed,
          }));
        } else {
          console.log(`✅ Image(s) generated successfully! (${(result.elapsed / 1000).toFixed(1)}s)`);
          result.filePaths.forEach((p) => {
            console.log(`📁 Saved to: ${p}`);
          });
        }
      } catch (generationError) {
        if (loadingInterval) {
          clearInterval(loadingInterval);
          process.stderr.write('\r\x1b[K');
        }
        throw generationError;
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      if (options.json) {
        console.log(JSON.stringify({ error: msg }));
      } else {
        console.error('❌ Error:', msg);
      }
      process.exit(1);
    }
  });

// List available models
program
  .command('models')
  .description('List available models for each provider')
  .option('--json', 'Output as JSON')
  .action((options) => {
    const models = {
      openai: [
        { id: 'gpt-image-1', description: 'GPT Image 1 (default)', default: true },
        { id: 'dall-e-3', description: 'DALL-E 3' },
        { id: 'dall-e-2', description: 'DALL-E 2 (legacy)' },
      ],
      replicate: [
        { id: 'stability-ai/sdxl', description: 'Stable Diffusion XL (default)', default: true },
        { id: 'black-forest-labs/flux-dev', description: 'Flux Dev' },
        { id: 'black-forest-labs/flux-schnell', description: 'Flux Schnell (fast)' },
        { id: 'stability-ai/stable-diffusion-3', description: 'Stable Diffusion 3' },
      ],
      stability: [
        { id: 'sd3.5-large', description: 'SD 3.5 Large (default)', default: true },
        { id: 'sd3.5-large-turbo', description: 'SD 3.5 Large Turbo (fast)' },
        { id: 'sd3-medium', description: 'SD 3 Medium' },
      ],
      fal: [
        { id: 'fal-ai/flux/dev', description: 'Flux Dev (default)', default: true },
        { id: 'fal-ai/flux/schnell', description: 'Flux Schnell (fast)' },
        { id: 'fal-ai/flux-pro/v1.1', description: 'Flux Pro v1.1' },
        { id: 'fal-ai/stable-diffusion-v3-medium', description: 'SD 3 Medium' },
      ],
      together: [
        { id: 'black-forest-labs/FLUX.1-schnell-Free', description: 'Flux Schnell Free (default)', default: true },
        { id: 'black-forest-labs/FLUX.1-schnell', description: 'Flux Schnell' },
        { id: 'black-forest-labs/FLUX.1-dev', description: 'Flux Dev' },
        { id: 'stabilityai/stable-diffusion-xl-base-1.0', description: 'SDXL Base' },
      ],
      bfl: [
        { id: 'flux-pro-1.1', description: 'Flux Pro 1.1 (default)', default: true },
        { id: 'flux-pro', description: 'Flux Pro' },
        { id: 'flux-dev', description: 'Flux Dev' },
      ],
    };

    if (options.json) {
      console.log(JSON.stringify(models, null, 2));
      return;
    }

    console.log('\n📋 Available Models:\n');
    console.log('OpenAI:');
    models.openai.forEach(m => console.log(`  - ${m.id} ${m.default ? '(default)' : ''} — ${m.description}`));
    console.log('\nReplicate:');
    models.replicate.forEach(m => console.log(`  - ${m.id} ${m.default ? '(default)' : ''} — ${m.description}`));
    console.log('\nStability AI:');
    models.stability.forEach(m => console.log(`  - ${m.id} ${m.default ? '(default)' : ''} — ${m.description}`));
    console.log('\nFAL.ai:');
    models.fal.forEach(m => console.log(`  - ${m.id} ${m.default ? '(default)' : ''} — ${m.description}`));
    console.log('\nTogether AI:');
    models.together.forEach(m => console.log(`  - ${m.id} ${m.default ? '(default)' : ''} — ${m.description}`));
    console.log('\nBlack Forest Labs (BFL):');
    models.bfl.forEach(m => console.log(`  - ${m.id} ${m.default ? '(default)' : ''} — ${m.description}`));
    console.log('\n💡 Tip: Use any model ID from the respective provider\'s catalog');
  });

// Show environment setup
program
  .command('setup')
  .description('Show how to set up API keys')
  .action(() => {
    console.log('\n🔧 Setup Instructions:\n');
    console.log('1. Create a .env file in your project root');
    console.log('2. Add your API keys:\n');
    console.log('   OPENAI_API_KEY=your_key_here');
    console.log('   REPLICATE_API_TOKEN=your_token_here');
    console.log('   STABILITY_API_KEY=your_key_here');
    console.log('   FAL_KEY=your_key_here');
    console.log('   TOGETHER_API_KEY=your_key_here');
    console.log('   BFL_API_KEY=your_key_here\n');
    console.log('3. Or pass API keys directly with --api-key flag\n');
    console.log('📚 Get your API keys:');
    console.log('   - OpenAI:      https://platform.openai.com/api-keys');
    console.log('   - Replicate:   https://replicate.com/account/api-tokens');
    console.log('   - Stability:   https://platform.stability.ai/account/keys');
    console.log('   - FAL.ai:      https://fal.ai/dashboard/keys');
    console.log('   - Together:    https://api.together.xyz/settings/api-keys');
    console.log('   - BFL:         https://api.bfl.ml/auth/login');
  });

program.parse();
