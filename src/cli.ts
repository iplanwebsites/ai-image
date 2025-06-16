#!/usr/bin/env node

import { Command } from 'commander';
import { ImageGenerator, Provider } from './index';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const program = new Command();

program
  .name('ai-image')
  .description('Generate images using OpenAI or Replicate APIs')
  .version('1.0.0');

program
  .command('generate')
  .alias('gen')
  .description('Generate an image from a text prompt')
  .option('--prompt <prompt>', 'Text prompt for image generation')
  .option('-p, --provider <provider>', 'Provider to use (openai or replicate)', 'openai')
  .option('-k, --api-key <key>', 'API key (overrides environment variable)')
  .option('-o, --output <path>', 'Output file path')
  .option('-d, --output-dir <dir>', 'Output directory', process.cwd())
  .option('-m, --model <model>', 'Model to use (provider-specific)')
  .option('-s, --size <size>', 'Image size (1024x1024, 1536x1024, 1024x1536, auto)', '1024x1024')
  .option('-q, --quality <quality>', 'Image quality (low, medium, high, auto) - OpenAI only', 'auto')
  .option('-f, --format <format>', 'Output format (png, jpeg, webp) - OpenAI only', 'png')
  .option('-c, --compression <compression>', 'Compression level 0-100% for JPEG/WebP - OpenAI only')
  .option('-b, --background <background>', 'Background (transparent, opaque) - OpenAI only')
  .option('--debug', 'Enable debug logging to show full request parameters')
  .option('-n, --number <n>', 'Number of images to generate', '1')
  .action(async (options) => {
    try {
      if (options.debug) {
        console.log('🐛 CLI Debug - Received parameters:');
        console.log('Prompt:', options.prompt);
        console.log('Options:', JSON.stringify(options, null, 2));
      }

      if (!options.prompt) {
        console.error('Error: Prompt is required. Use --prompt "your prompt text"');
        process.exit(1);
      }
      
      const provider = options.provider.toLowerCase() as Provider;
      
      if (!['openai', 'replicate'].includes(provider)) {
        console.error('Error: Provider must be either "openai" or "replicate"');
        process.exit(1);
      }

      let outputDir = options.outputDir;
      let outputFilename = options.output;

      // If output is provided as a full path
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

      
      // Loading animation with provider-specific message
      const providerText = provider === 'openai' ? 'OpenAI' : 'Replicate';
      const loadingFrames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
      let frameIndex = 0;
      let startTime = Date.now();
      const loadingInterval = setInterval(() => {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        process.stdout.write(`\r${loadingFrames[frameIndex]} Processing @ ${providerText} (${elapsed}s)...`);
        frameIndex = (frameIndex + 1) % loadingFrames.length;
      }, 9000);
      
      try {
        const generateOptions: any = {
          prompt: options.prompt,
          model: options.model,
          size: options.size,
          quality: options.quality,
          n: parseInt(options.number)
        };

        // Add optional parameters
        if (options.format) generateOptions.format = options.format;
        if (options.compression) generateOptions.compression = parseInt(options.compression);
        if (options.background) generateOptions.background = options.background;
        if (options.debug) generateOptions.debug = true;

        if (options.debug) {
          console.log('🎨 Generating image with openai...', generateOptions);
        }

        const savedPaths = await generator.generate(generateOptions);
        
        clearInterval(loadingInterval);
        process.stdout.write('\r');
        console.log(`✅ Image(s) generated successfully!`);
        savedPaths.forEach((path) => {
          console.log(`📁 Saved to: ${path}`);
        });
      } catch (generationError) {
        clearInterval(loadingInterval);
        process.stdout.write('\r');
        throw generationError;
      }
    } catch (error) {
      console.error('❌ Error:', error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  });

// Add a command to list available models
program
  .command('models')
  .description('List available models for each provider')
  .action(() => {
    console.log('\n📋 Available Models:\n');
    console.log('OpenAI:');
    console.log('  - gpt-image-1 (default, new GPT image model)');
    console.log('  - dall-e-2 (legacy DALL-E model)');
    console.log('\nReplicate:');
    console.log('  - stability-ai/sdxl (default)');
    console.log('  - stability-ai/stable-diffusion');
    console.log('  - Any model from replicate.com in format "owner/model:version"');
    console.log('\n💡 Tip: Check replicate.com/explore for more models');
  });

// Add a command to show environment setup
program
  .command('setup')
  .description('Show how to set up API keys')
  .action(() => {
    console.log('\n🔧 Setup Instructions:\n');
    console.log('1. Create a .env file in your project root');
    console.log('2. Add your API keys:\n');
    console.log('   OPENAI_API_KEY=your_openai_api_key_here');
    console.log('   REPLICATE_API_TOKEN=your_replicate_token_here\n');
    console.log('3. Or pass API keys directly with --api-key flag\n');
    console.log('📚 Get your API keys:');
    console.log('   - OpenAI: https://platform.openai.com/api-keys');
    console.log('   - Replicate: https://replicate.com/account/api-tokens');
  });

program.parse();