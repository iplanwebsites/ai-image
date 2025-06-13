#!/usr/bin/env node

import { Command } from 'commander';
import { ImageGenerator, Provider } from './index';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const program = new Command();

program
  .name('image-gen')
  .description('Generate images using OpenAI or Replicate APIs')
  .version('1.0.0');

program
  .command('generate')
  .alias('gen')
  .description('Generate an image from a text prompt')
  .argument('<prompt>', 'Text prompt for image generation')
  .option('-p, --provider <provider>', 'Provider to use (openai or replicate)', 'openai')
  .option('-k, --api-key <key>', 'API key (overrides environment variable)')
  .option('-o, --output <path>', 'Output file path')
  .option('-d, --output-dir <dir>', 'Output directory', process.cwd())
  .option('-m, --model <model>', 'Model to use (provider-specific)')
  .option('-s, --size <size>', 'Image size (e.g., 1024x1024)', '1024x1024')
  .option('-q, --quality <quality>', 'Image quality (standard or hd) - OpenAI only', 'standard')
  .option('--style <style>', 'Image style (vivid or natural) - OpenAI only', 'vivid')
  .option('-n, --number <n>', 'Number of images to generate', '1')
  .action(async (prompt, options) => {
    try {
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

      console.log(`🎨 Generating image with ${provider}...`);
      console.log(`📝 Prompt: "${prompt}"`);

      const savedPaths = await generator.generate({
        prompt,
        model: options.model,
        size: options.size,
        quality: options.quality,
        style: options.style,
        n: parseInt(options.number)
      });

      console.log(`✅ Image(s) generated successfully!`);
      savedPaths.forEach((path, index) => {
        console.log(`📁 Saved to: ${path}`);
      });
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
    console.log('  - dall-e-3 (default)');
    console.log('  - dall-e-2');
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