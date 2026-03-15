import { FastifyInstance } from 'fastify';
import { ImageGenerator, type Provider, type GenerateOptions } from 'ai-image';
import { randomUUID } from 'crypto';
import path from 'path';

interface GenerateBody {
  prompt: string;
  provider?: Provider;
  model?: string;
  size?: string;
  quality?: 'low' | 'medium' | 'high' | 'auto';
  format?: 'png' | 'jpeg' | 'webp';
  compression?: number;
  background?: 'transparent' | 'opaque';
  n?: number;
  negativePrompt?: string;
  guidanceScale?: number;
  steps?: number;
  seed?: number;
  stylePreset?: string;
  outputDir?: string;
}

interface RouteOptions {
  outputDir: string;
}

export async function generateRoute(app: FastifyInstance, opts: RouteOptions) {
  app.post<{ Body: GenerateBody }>('/generate', {
    schema: {
      body: {
        type: 'object',
        required: ['prompt'],
        properties: {
          prompt: { type: 'string', minLength: 1 },
          provider: { type: 'string' },
          model: { type: 'string' },
          size: { type: 'string' },
          quality: { type: 'string' },
          format: { type: 'string' },
          compression: { type: 'number' },
          background: { type: 'string' },
          n: { type: 'number', minimum: 1, maximum: 10 },
          negativePrompt: { type: 'string' },
          guidanceScale: { type: 'number' },
          steps: { type: 'number' },
          seed: { type: 'number' },
          stylePreset: { type: 'string' },
          outputDir: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const body = request.body;
    const provider: Provider = body.provider || 'openai';

    // Use UUID-based filenames for clean URLs
    const filename = randomUUID();

    // Use custom output dir if provided, otherwise default
    const outputDir = body.outputDir || opts.outputDir;

    let generator: ImageGenerator;
    try {
      generator = new ImageGenerator({
        provider,
        outputDir,
        outputFilename: filename,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      return reply.status(400).send({
        success: false,
        error: msg,
      });
    }

    try {
      const generateOpts: GenerateOptions = {
        prompt: body.prompt,
        model: body.model,
        size: body.size,
        quality: body.quality,
        format: body.format,
        compression: body.compression,
        background: body.background,
        n: body.n,
        negativePrompt: body.negativePrompt,
        guidanceScale: body.guidanceScale,
        steps: body.steps,
        seed: body.seed,
        stylePreset: body.stylePreset,
        outputDir,
        outputFilename: filename,
      };

      const result = await generator.generate(generateOpts);

      // Map file paths to URLs (only serveable if in default output dir)
      const images = result.filePaths.map((filePath) => {
        const basename = path.basename(filePath);
        const isInDefaultDir = path.resolve(path.dirname(filePath)) === path.resolve(opts.outputDir);
        return {
          url: isInDefaultDir ? `/images/${basename}` : null,
          filename: basename,
          filePath,
        };
      });

      return reply.send({
        success: true,
        images,
        provider: result.provider,
        model: result.model,
        elapsed: result.elapsed,
        prompt: body.prompt,
        outputDir,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      return reply.status(500).send({
        success: false,
        error: msg,
      });
    }
  });
}
