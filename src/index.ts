import OpenAI from 'openai';
import Replicate from 'replicate';
import fs from 'fs/promises';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

export type Provider = 'openai' | 'replicate';

export interface ImageGeneratorOptions {
  provider: Provider;
  apiKey?: string;
  outputDir?: string;
  outputFilename?: string;
}

export interface GenerateOptions {
  prompt: string;
  model?: string;
  size?: '1024x1024' | '1536x1024' | '1024x1536' | 'auto';
  quality?: 'low' | 'medium' | 'high' | 'auto';
  format?: 'png' | 'jpeg' | 'webp';
  compression?: number; // 0-100% for JPEG and WebP
  background?: 'transparent' | 'opaque';
  n?: number;
  debug?: boolean;
}

export class ImageGenerator {
  private provider: Provider;
  private openai?: OpenAI;
  private replicate?: Replicate;
  private outputDir: string;
  private outputFilename?: string;

  constructor(options: ImageGeneratorOptions) {
    this.provider = options.provider;
    this.outputDir = options.outputDir || process.cwd();
    this.outputFilename = options.outputFilename;

    const apiKey = options.apiKey || this.getApiKeyFromEnv(options.provider);
    
    if (!apiKey) {
      throw new Error(`[AI-IMAGE] API key for ${options.provider} not found. Please provide it via parameter or environment variable.`);
    }

    switch (options.provider) {
      case 'openai':
        this.openai = new OpenAI({ apiKey });
        break;
      case 'replicate':
        this.replicate = new Replicate({ auth: apiKey });
        break;
      default:
        throw new Error(`Unsupported provider: ${options.provider}`);
    }
  }

  private getApiKeyFromEnv(provider: Provider): string | undefined {
    switch (provider) {
      case 'openai':
        return process.env.OPENAI_API_KEY;
      case 'replicate':
        return process.env.REPLICATE_API_TOKEN;
      default:
        return undefined;
    }
  }

  private sanitizeFilename(filename: string): string {
    // Remove or replace invalid characters for filenames
    return filename
      .replace(/[<>:"/\\|?*\x00-\x1F]/g, '')
      .replace(/\s+/g, '_')
      .substring(0, 200); // Limit length
  }

  private async getOutputPath(prompt: string, index: number = 0, extension: string = 'png'): Promise<string> {
    let filename: string;
    
    if (this.outputFilename) {
      // If multiple images, append index
      const ext = path.extname(this.outputFilename);
      const name = path.basename(this.outputFilename, ext);
      filename = index > 0 ? `${name}_${index}${ext || `.${extension}`}` : `${name}${ext || `.${extension}`}`;
    } else {
      // Use sanitized prompt as filename
      const sanitized = this.sanitizeFilename(prompt);
      filename = index > 0 ? `${sanitized}_${index}.${extension}` : `${sanitized}.${extension}`;
    }

    let outputPath = path.join(this.outputDir, filename);
    
    // Handle filename collisions
    let counter = 1;
    while (await this.fileExists(outputPath)) {
      const ext = path.extname(filename);
      const name = path.basename(filename, ext);
      const newFilename = `${name} ${counter}${ext}`;
      outputPath = path.join(this.outputDir, newFilename);
      counter++;
    }

    return outputPath;
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async generate(options: GenerateOptions): Promise<string[]> {
    const savedPaths: string[] = [];
    const startTime = Date.now();


console.log(`🎨 Generating image with ${this.provider}... OPTIONS:`, options);
// alfsd()

    try {
      if (this.provider === 'openai' && this.openai) {
        const effectiveModel = options.model || 'gpt-image-1';
        console.log(`🤖 Using model: ${effectiveModel}`);
        const generateParams: any = {
          model: effectiveModel,
          prompt: options.prompt,
          size: options.size || '1024x1024',
          quality: options.quality || 'auto',
          n: options.n || 1,
        //  response_format: 'b64_json'
        };

        // Add optional parameters
        if (options.format && options.format !== 'png') {
          generateParams.output_format = options.format;
        }
        if (options.compression && (options.format === 'jpeg' || options.format === 'webp')) {
          generateParams.output_compression = options.compression;
        }
        if (options.background) {
          generateParams.background = options.background;
        }

        if (options.debug) {
          console.log('🐛 Debug - Full request parameters:');
          console.log(JSON.stringify(generateParams, null, 2));
        }

        const result = await this.openai.images.generate(generateParams);

        // Save each generated image
        for (let i = 0; i < (result.data?.length || 0); i++) {
          const imageData = result.data?.[i];
          if (imageData?.b64_json) {
            const imageBytes = Buffer.from(imageData.b64_json, 'base64');
            const fileExtension = options.format || 'png';
            const outputPath = await this.getOutputPath(options.prompt, i, fileExtension);
            await fs.writeFile(outputPath, imageBytes);
            savedPaths.push(outputPath);
          }
        }
      } else if (this.provider === 'replicate' && this.replicate) {
        // Default to SDXL model if not specified
        const model = options.model || 'stability-ai/sdxl:39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b';
        
        const replicateInput = {
          prompt: options.prompt,
          width: parseInt(options.size?.split('x')[0] || '1024'),
          height: parseInt(options.size?.split('x')[1] || '1024'),
          num_outputs: options.n || 1
        };

        if (options.debug) {
          console.log('🐛 Debug - Replicate model input:');
          console.log(JSON.stringify(replicateInput, null, 2));
        }

        const output = await this.replicate.run(model as `${string}/${string}` | `${string}/${string}:${string}`, {
          input: replicateInput
        }) as string[];

        // Save each generated image
        for (let i = 0; i < output.length; i++) {
          const imageUrl = output[i];
          const response = await fetch(imageUrl);
          const arrayBuffer = await response.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          
          const outputPath = await this.getOutputPath(options.prompt, i);
          await fs.writeFile(outputPath, buffer);
          savedPaths.push(outputPath);
        }
      }

      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`⏱️  Generation completed in ${duration}s`);
      
      return savedPaths;
    } catch (error) {
      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`⏱️  Generation failed after ${duration}s`);
      throw new Error(`Failed to generate image: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

// Re-export types and interfaces
export { OpenAI, Replicate };