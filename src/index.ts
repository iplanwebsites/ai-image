import OpenAI from 'openai';
import Replicate from 'replicate';
import fs from 'fs/promises';
import path from 'path';
import { spawn, ChildProcess } from 'child_process';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

export type Provider = 'openai' | 'replicate' | 'stability' | 'fal' | 'together' | 'bfl' | 'google' | 'fireworks' | 'ollama' | 'local';

export interface ImageGeneratorOptions {
  provider: Provider;
  apiKey?: string;
  outputDir?: string;
  outputFilename?: string;
}

export interface GenerateOptions {
  prompt: string;
  model?: string;
  size?: string;
  quality?: 'low' | 'medium' | 'high' | 'auto';
  format?: 'png' | 'jpeg' | 'webp';
  compression?: number; // 0-100% for JPEG and WebP
  background?: 'transparent' | 'opaque';
  n?: number;
  debug?: boolean;
  // Per-call overrides
  apiKey?: string;
  outputDir?: string;
  outputFilename?: string;
  // Negative prompt (supported by Replicate, Stability, FAL)
  negativePrompt?: string;
  // Style preset (Stability AI)
  stylePreset?: string;
  // Guidance / CFG scale (Replicate, Stability, FAL)
  guidanceScale?: number;
  // Inference steps (Replicate, Stability, FAL)
  steps?: number;
  // Seed for reproducibility
  seed?: number;
}

export interface GenerateResult {
  filePaths: string[];
  provider: Provider;
  model: string;
  elapsed: number;
}

export class ImageGenerator {
  private provider: Provider;
  private apiKey?: string;
  private openai?: OpenAI;
  private replicate?: Replicate;
  private outputDir: string;
  private outputFilename?: string;

  constructor(options: ImageGeneratorOptions) {
    this.provider = options.provider;
    this.outputDir = options.outputDir || process.cwd();
    this.outputFilename = options.outputFilename;

    const apiKey = options.apiKey || this.getApiKeyFromEnv(options.provider);
    this.apiKey = apiKey;

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
      case 'stability':
      case 'fal':
      case 'together':
      case 'bfl':
      case 'google':
      case 'fireworks':
      case 'ollama':
      case 'local':
        // These providers use REST APIs directly; key stored for later use
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
      case 'stability':
        return process.env.STABILITY_API_KEY;
      case 'fal':
        return process.env.FAL_KEY;
      case 'together':
        return process.env.TOGETHER_API_KEY;
      case 'bfl':
        return process.env.BFL_API_KEY;
      case 'google':
        return process.env.GOOGLE_API_KEY;
      case 'fireworks':
        return process.env.FIREWORKS_API_KEY;
      case 'ollama':
        return 'ollama'; // Ollama doesn't need an API key
      case 'local':
        return 'local'; // Local server doesn't need an API key
      default:
        return undefined;
    }
  }

  private sanitizeFilename(filename: string): string {
    return filename
      .replace(/[<>:"/\\|?*\x00-\x1F]/g, '')
      .replace(/\s+/g, '_')
      .substring(0, 200);
  }

  private async getOutputPath(prompt: string, index: number = 0, extension: string = 'png', overrideDir?: string, overrideFilename?: string): Promise<string> {
    const dir = overrideDir || this.outputDir;
    const baseFilename = overrideFilename || this.outputFilename;
    let filename: string;

    if (baseFilename) {
      const ext = path.extname(baseFilename);
      const name = path.basename(baseFilename, ext);
      filename = index > 0 ? `${name}_${index}${ext || `.${extension}`}` : `${name}${ext || `.${extension}`}`;
    } else {
      const sanitized = this.sanitizeFilename(prompt);
      filename = index > 0 ? `${sanitized}_${index}.${extension}` : `${sanitized}.${extension}`;
    }

    let outputPath = path.join(dir, filename);

    // Handle filename collisions
    let counter = 1;
    while (await this.fileExists(outputPath)) {
      const ext = path.extname(filename);
      const name = path.basename(filename, ext);
      const newFilename = `${name} ${counter}${ext}`;
      outputPath = path.join(dir, newFilename);
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

  private async ensureDir(dir: string): Promise<void> {
    await fs.mkdir(dir, { recursive: true });
  }

  async generate(options: GenerateOptions): Promise<GenerateResult> {
    const startTime = Date.now();
    const savedPaths: string[] = [];
    const outputDir = options.outputDir || this.outputDir;
    const outputFilename = options.outputFilename || this.outputFilename;
    let usedModel = '';

    // Ensure output directory exists
    await this.ensureDir(outputDir);

    // If a per-call apiKey is provided and differs, reinitialize the client
    if (options.apiKey && options.apiKey !== this.apiKey) {
      this.reinitClient(options.apiKey);
    }

    try {
      switch (this.provider) {
        case 'openai':
          usedModel = await this.generateOpenAI(options, savedPaths, outputDir, outputFilename);
          break;
        case 'replicate':
          usedModel = await this.generateReplicate(options, savedPaths, outputDir, outputFilename);
          break;
        case 'stability':
          usedModel = await this.generateStability(options, savedPaths, outputDir, outputFilename);
          break;
        case 'fal':
          usedModel = await this.generateFal(options, savedPaths, outputDir, outputFilename);
          break;
        case 'together':
          usedModel = await this.generateTogether(options, savedPaths, outputDir, outputFilename);
          break;
        case 'bfl':
          usedModel = await this.generateBfl(options, savedPaths, outputDir, outputFilename);
          break;
        case 'google':
          usedModel = await this.generateGoogle(options, savedPaths, outputDir, outputFilename);
          break;
        case 'fireworks':
          usedModel = await this.generateFireworks(options, savedPaths, outputDir, outputFilename);
          break;
        case 'ollama':
          usedModel = await this.generateOllama(options, savedPaths, outputDir, outputFilename);
          break;
        case 'local':
          usedModel = await this.generateLocal(options, savedPaths, outputDir, outputFilename);
          break;
      }

      return {
        filePaths: savedPaths,
        provider: this.provider,
        model: usedModel,
        elapsed: Date.now() - startTime,
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`[AI-IMAGE] Image generation failed (${this.provider}): ${msg}`);
    }
  }

  private reinitClient(apiKey: string): void {
    this.apiKey = apiKey;
    switch (this.provider) {
      case 'openai':
        this.openai = new OpenAI({ apiKey });
        break;
      case 'replicate':
        this.replicate = new Replicate({ auth: apiKey });
        break;
    }
  }

  // ─── OpenAI ──────────────────────────────────────────────────────────

  private async generateOpenAI(options: GenerateOptions, savedPaths: string[], outputDir: string, outputFilename?: string): Promise<string> {
    if (!this.openai) throw new Error('OpenAI client not initialized');

    const model = options.model || 'gpt-image-1';
    const generateParams: Record<string, unknown> = {
      model,
      prompt: options.prompt,
      size: options.size || '1024x1024',
      quality: options.quality || 'auto',
      n: options.n || 1,
    };

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
      console.error('[debug] OpenAI request:', JSON.stringify(generateParams, null, 2));
    }

    const result = await this.openai.images.generate(generateParams as any);

    for (let i = 0; i < (result.data?.length || 0); i++) {
      const imageData = result.data?.[i];
      if (imageData?.b64_json) {
        const imageBytes = Buffer.from(imageData.b64_json, 'base64');
        const ext = options.format || 'png';
        const outputPath = await this.getOutputPath(options.prompt, i, ext, outputDir, outputFilename);
        await fs.writeFile(outputPath, imageBytes);
        savedPaths.push(outputPath);
      }
    }

    return model;
  }

  // ─── Replicate ───────────────────────────────────────────────────────

  private async generateReplicate(options: GenerateOptions, savedPaths: string[], outputDir: string, outputFilename?: string): Promise<string> {
    if (!this.replicate) throw new Error('Replicate client not initialized');

    const model = options.model || 'stability-ai/sdxl:39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b';

    const replicateInput: Record<string, unknown> = {
      prompt: options.prompt,
      width: parseInt(options.size?.split('x')[0] || '1024'),
      height: parseInt(options.size?.split('x')[1] || '1024'),
      num_outputs: options.n || 1,
    };

    if (options.negativePrompt) replicateInput.negative_prompt = options.negativePrompt;
    if (options.guidanceScale != null) replicateInput.guidance_scale = options.guidanceScale;
    if (options.steps != null) replicateInput.num_inference_steps = options.steps;
    if (options.seed != null) replicateInput.seed = options.seed;

    if (options.debug) {
      console.error('[debug] Replicate input:', JSON.stringify(replicateInput, null, 2));
    }

    const output = await this.replicate.run(model as `${string}/${string}` | `${string}/${string}:${string}`, {
      input: replicateInput
    }) as string[];

    for (let i = 0; i < output.length; i++) {
      const imageUrl = output[i];
      const response = await fetch(imageUrl);
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      const outputPath = await this.getOutputPath(options.prompt, i, options.format || 'png', outputDir, outputFilename);
      await fs.writeFile(outputPath, buffer);
      savedPaths.push(outputPath);
    }

    return model;
  }

  // ─── Stability AI ────────────────────────────────────────────────────

  private async generateStability(options: GenerateOptions, savedPaths: string[], outputDir: string, outputFilename?: string): Promise<string> {
    const model = options.model || 'sd3.5-large';
    const apiHost = 'https://api.stability.ai';
    const endpoint = `/v2beta/stable-image/generate/sd3`;

    const formData = new FormData();
    formData.append('prompt', options.prompt);
    formData.append('model', model);
    formData.append('output_format', options.format || 'png');

    if (options.negativePrompt) formData.append('negative_prompt', options.negativePrompt);
    if (options.seed != null) formData.append('seed', String(options.seed));
    if (options.stylePreset) formData.append('style_preset', options.stylePreset);
    if (options.guidanceScale != null) formData.append('cfg_scale', String(options.guidanceScale));
    if (options.steps != null) formData.append('steps', String(options.steps));

    // Map size string to aspect ratio
    const size = options.size || '1024x1024';
    const [w, h] = size.split('x').map(Number);
    if (w && h) {
      const ratio = this.simplifyRatio(w, h);
      formData.append('aspect_ratio', ratio);
    }

    if (options.debug) {
      console.error(`[debug] Stability request: POST ${apiHost}${endpoint}, model=${model}`);
    }

    const n = options.n || 1;
    for (let i = 0; i < n; i++) {
      const response = await fetch(`${apiHost}${endpoint}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Accept': 'image/*',
        },
        body: formData,
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Stability API error (${response.status}): ${errText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const ext = options.format || 'png';
      const outputPath = await this.getOutputPath(options.prompt, i, ext, outputDir, outputFilename);
      await fs.writeFile(outputPath, buffer);
      savedPaths.push(outputPath);
    }

    return model;
  }

  // ─── FAL.ai ──────────────────────────────────────────────────────────

  private async generateFal(options: GenerateOptions, savedPaths: string[], outputDir: string, outputFilename?: string): Promise<string> {
    const model = options.model || 'fal-ai/flux/dev';
    const apiHost = 'https://queue.fal.run';

    const size = options.size || '1024x1024';
    const [w, h] = size.split('x').map(Number);

    const body: Record<string, unknown> = {
      prompt: options.prompt,
      image_size: { width: w || 1024, height: h || 1024 },
      num_images: options.n || 1,
    };

    if (options.negativePrompt) body.negative_prompt = options.negativePrompt;
    if (options.guidanceScale != null) body.guidance_scale = options.guidanceScale;
    if (options.steps != null) body.num_inference_steps = options.steps;
    if (options.seed != null) body.seed = options.seed;

    if (options.debug) {
      console.error(`[debug] FAL request: POST ${apiHost}/${model}`);
      console.error('[debug] FAL body:', JSON.stringify(body, null, 2));
    }

    // Submit to queue
    const submitRes = await fetch(`${apiHost}/${model}`, {
      method: 'POST',
      headers: {
        'Authorization': `Key ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!submitRes.ok) {
      const errText = await submitRes.text();
      throw new Error(`FAL API error (${submitRes.status}): ${errText}`);
    }

    const submitData = await submitRes.json() as { request_id?: string; images?: Array<{ url: string }> };

    // If we got images directly (synchronous response)
    let images: Array<{ url: string }> = submitData.images || [];

    // If queued, poll for result
    if (submitData.request_id && images.length === 0) {
      images = await this.pollFalResult(model, submitData.request_id, options.debug);
    }

    for (let i = 0; i < images.length; i++) {
      const imageUrl = images[i].url;
      const response = await fetch(imageUrl);
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      const ext = options.format || 'png';
      const outputPath = await this.getOutputPath(options.prompt, i, ext, outputDir, outputFilename);
      await fs.writeFile(outputPath, buffer);
      savedPaths.push(outputPath);
    }

    return model;
  }

  private async pollFalResult(model: string, requestId: string, debug?: boolean): Promise<Array<{ url: string }>> {
    const statusUrl = `https://queue.fal.run/${model}/requests/${requestId}/status`;
    const resultUrl = `https://queue.fal.run/${model}/requests/${requestId}`;

    for (let attempt = 0; attempt < 60; attempt++) {
      await new Promise(r => setTimeout(r, 2000));

      const statusRes = await fetch(statusUrl, {
        headers: { 'Authorization': `Key ${this.apiKey}` },
      });
      const statusData = await statusRes.json() as { status: string };

      if (debug) {
        console.error(`[debug] FAL poll #${attempt + 1}: ${statusData.status}`);
      }

      if (statusData.status === 'COMPLETED') {
        const resultRes = await fetch(resultUrl, {
          headers: { 'Authorization': `Key ${this.apiKey}` },
        });
        const resultData = await resultRes.json() as { images: Array<{ url: string }> };
        return resultData.images || [];
      }

      if (statusData.status === 'FAILED') {
        throw new Error('FAL generation failed');
      }
    }

    throw new Error('FAL generation timed out');
  }

  // ─── Together AI (OpenAI-compatible) ──────────────────────────────

  private async generateTogether(options: GenerateOptions, savedPaths: string[], outputDir: string, outputFilename?: string): Promise<string> {
    const model = options.model || 'black-forest-labs/FLUX.1-schnell-Free';

    const size = options.size || '1024x1024';
    const [w, h] = size.split('x').map(Number);

    const body: Record<string, unknown> = {
      model,
      prompt: options.prompt,
      width: w || 1024,
      height: h || 1024,
      n: options.n || 1,
      response_format: 'b64_json',
    };

    if (options.steps != null) body.steps = options.steps;
    if (options.seed != null) body.seed = options.seed;
    if (options.negativePrompt) body.negative_prompt = options.negativePrompt;

    if (options.debug) {
      console.error('[debug] Together request:', JSON.stringify(body, null, 2));
    }

    const response = await fetch('https://api.together.xyz/v1/images/generations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Together API error (${response.status}): ${errText}`);
    }

    const result = await response.json() as { data: Array<{ b64_json?: string; url?: string }> };

    for (let i = 0; i < result.data.length; i++) {
      const item = result.data[i];
      let buffer: Buffer;

      if (item.b64_json) {
        buffer = Buffer.from(item.b64_json, 'base64');
      } else if (item.url) {
        const imgRes = await fetch(item.url);
        buffer = Buffer.from(await imgRes.arrayBuffer());
      } else {
        continue;
      }

      const ext = options.format || 'png';
      const outputPath = await this.getOutputPath(options.prompt, i, ext, outputDir, outputFilename);
      await fs.writeFile(outputPath, buffer);
      savedPaths.push(outputPath);
    }

    return model;
  }

  // ─── BFL (Black Forest Labs) ────────────────────────────────────────

  private async generateBfl(options: GenerateOptions, savedPaths: string[], outputDir: string, outputFilename?: string): Promise<string> {
    const model = options.model || 'flux-pro-1.1';
    const apiHost = 'https://api.bfl.ai';

    const size = options.size || '1024x1024';
    const [w, h] = size.split('x').map(Number);

    const body: Record<string, unknown> = {
      prompt: options.prompt,
      width: w || 1024,
      height: h || 1024,
    };

    if (options.steps != null) body.steps = options.steps;
    if (options.seed != null) body.seed = options.seed;
    if (options.guidanceScale != null) body.guidance = options.guidanceScale;

    if (options.debug) {
      console.error(`[debug] BFL request: POST ${apiHost}/v1/${model}`);
      console.error('[debug] BFL body:', JSON.stringify(body, null, 2));
    }

    const n = options.n || 1;
    for (let i = 0; i < n; i++) {
      // Submit generation request
      const submitRes = await fetch(`${apiHost}/v1/${model}`, {
        method: 'POST',
        headers: {
          'X-Key': this.apiKey!,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!submitRes.ok) {
        const errText = await submitRes.text();
        throw new Error(`BFL API error (${submitRes.status}): ${errText}`);
      }

      const submitData = await submitRes.json() as { id: string };

      // Poll for result
      const imageUrl = await this.pollBflResult(submitData.id, options.debug);

      const imgRes = await fetch(imageUrl);
      const buffer = Buffer.from(await imgRes.arrayBuffer());

      const ext = options.format || 'png';
      const outputPath = await this.getOutputPath(options.prompt, i, ext, outputDir, outputFilename);
      await fs.writeFile(outputPath, buffer);
      savedPaths.push(outputPath);
    }

    return model;
  }

  private async pollBflResult(taskId: string, debug?: boolean): Promise<string> {
    for (let attempt = 0; attempt < 60; attempt++) {
      await new Promise(r => setTimeout(r, 2000));

      const res = await fetch(`https://api.bfl.ai/v1/get_result?id=${taskId}`, {
        headers: { 'X-Key': this.apiKey! },
      });
      const data = await res.json() as { status: string; result?: { sample: string } };

      if (debug) {
        console.error(`[debug] BFL poll #${attempt + 1}: ${data.status}`);
      }

      if (data.status === 'Ready' && data.result?.sample) {
        return data.result.sample;
      }

      if (data.status === 'Error') {
        throw new Error('BFL generation failed');
      }
    }

    throw new Error('BFL generation timed out');
  }

  // ─── Google Imagen (Gemini API) ──────────────────────────────────

  private async generateGoogle(options: GenerateOptions, savedPaths: string[], outputDir: string, outputFilename?: string): Promise<string> {
    const model = options.model || 'imagen-4.0-generate-001';
    const apiHost = 'https://generativelanguage.googleapis.com';
    const endpoint = `/v1beta/models/${model}:predict`;

    const size = options.size || '1024x1024';
    const [w, h] = size.split('x').map(Number);
    const aspectRatio = this.simplifyRatio(w || 1024, h || 1024);

    const body = {
      instances: [{ prompt: options.prompt }],
      parameters: {
        sampleCount: options.n || 1,
        aspectRatio,
        outputOptions: {
          mimeType: options.format === 'jpeg' ? 'image/jpeg' : 'image/png',
        },
        ...(options.negativePrompt ? { negativePrompt: options.negativePrompt } : {}),
        ...(options.seed != null ? { seed: options.seed } : {}),
        ...(options.guidanceScale != null ? { guidanceScale: options.guidanceScale } : {}),
      },
    };

    if (options.debug) {
      console.error(`[debug] Google Imagen request: POST ${apiHost}${endpoint}`);
      console.error('[debug] Google body:', JSON.stringify(body, null, 2));
    }

    const response = await fetch(`${apiHost}${endpoint}?key=${this.apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Google Imagen API error (${response.status}): ${errText}`);
    }

    const result = await response.json() as { predictions: Array<{ bytesBase64Encoded: string; mimeType: string }> };

    for (let i = 0; i < (result.predictions?.length || 0); i++) {
      const prediction = result.predictions[i];
      const buffer = Buffer.from(prediction.bytesBase64Encoded, 'base64');
      const ext = prediction.mimeType === 'image/jpeg' ? 'jpeg' : 'png';
      const outputPath = await this.getOutputPath(options.prompt, i, ext, outputDir, outputFilename);
      await fs.writeFile(outputPath, buffer);
      savedPaths.push(outputPath);
    }

    return model;
  }

  // ─── Fireworks AI ─────────────────────────────────────────────────

  private async generateFireworks(options: GenerateOptions, savedPaths: string[], outputDir: string, outputFilename?: string): Promise<string> {
    const model = options.model || 'flux-1-schnell-fp8';
    const apiHost = 'https://api.fireworks.ai';
    const endpoint = `/inference/v1/workflows/accounts/fireworks/models/${model}/text_to_image`;

    const size = options.size || '1024x1024';
    const [w, h] = size.split('x').map(Number);
    const aspectRatio = this.simplifyRatio(w || 1024, h || 1024);

    const body: Record<string, unknown> = {
      prompt: options.prompt,
      aspect_ratio: aspectRatio,
    };

    if (options.guidanceScale != null) body.cfg_scale = options.guidanceScale;
    if (options.steps != null) body.steps = options.steps;
    if (options.seed != null) body.seed = options.seed;
    if (options.negativePrompt) body.negative_prompt = options.negativePrompt;

    if (options.debug) {
      console.error(`[debug] Fireworks request: POST ${apiHost}${endpoint}`);
      console.error('[debug] Fireworks body:', JSON.stringify(body, null, 2));
    }

    const n = options.n || 1;
    for (let i = 0; i < n; i++) {
      const response = await fetch(`${apiHost}${endpoint}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Fireworks API error (${response.status}): ${errText}`);
      }

      const result = await response.json() as { base64?: string[]; data?: Array<{ b64_json: string }> };

      // Fireworks returns base64 array or data array depending on model
      let b64: string | undefined;
      if (result.base64?.[0]) {
        b64 = result.base64[0];
      } else if (result.data?.[0]?.b64_json) {
        b64 = result.data[0].b64_json;
      }

      if (b64) {
        const buffer = Buffer.from(b64, 'base64');
        const ext = options.format || 'jpeg';
        const outputPath = await this.getOutputPath(options.prompt, i, ext, outputDir, outputFilename);
        await fs.writeFile(outputPath, buffer);
        savedPaths.push(outputPath);
      }
    }

    return model;
  }

  // ─── Ollama (Local) ─────────────────────────────────────────────────

  private async generateOllama(options: GenerateOptions, savedPaths: string[], outputDir: string, outputFilename?: string): Promise<string> {
    const model = options.model || 'x/flux2-klein:4b';
    // Support custom Ollama host via apiKey field (e.g. "http://my-server:11434")
    const isCustomHost = this.apiKey && this.apiKey.startsWith('http');
    const apiHost = isCustomHost ? this.apiKey! : 'http://localhost:11434';

    const body: Record<string, unknown> = {
      model,
      prompt: options.prompt,
      stream: false,
    };

    if (options.debug) {
      console.error(`[debug] Ollama request: POST ${apiHost}/api/generate`);
      console.error('[debug] Ollama body:', JSON.stringify(body, null, 2));
    }

    const n = options.n || 1;
    for (let i = 0; i < n; i++) {
      const response = await fetch(`${apiHost}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Ollama API error (${response.status}): ${errText}`);
      }

      const result = await response.json() as { image?: string; response?: string };

      const imageData = result.image || result.response;
      if (imageData) {
        const buffer = Buffer.from(imageData, 'base64');
        const ext = options.format || 'png';
        const outputPath = await this.getOutputPath(options.prompt, i, ext, outputDir, outputFilename);
        await fs.writeFile(outputPath, buffer);
        savedPaths.push(outputPath);
      }
    }

    return model;
  }

  // ─── Local (ai-image-server) ──────────────────────────────────────
  //
  // Global install at ~/.ai-image/:
  //   ~/.ai-image/
  //     server/.venv/         — single Python venv, shared across all projects
  //     models/               — HuggingFace model cache (explicit location)
  //     version.json          — tracks npm package version for auto-upgrade
  //
  // Models are stored via HF_HUB_CACHE=~/.ai-image/models so they're
  // visible, shared, and easy to clean up (rm -rf ~/.ai-image).

  private static localServerProcess: ChildProcess | null = null;
  private static readonly AI_IMAGE_HOME = path.join(process.env.HOME || process.env.USERPROFILE || '~', '.ai-image');

  private getLocalHost(): string {
    const isCustomHost = this.apiKey && this.apiKey.startsWith('http');
    return isCustomHost ? this.apiKey! : (process.env.AI_IMAGE_LOCAL_URL || 'http://localhost:8506');
  }

  private async isLocalServerRunning(apiHost: string): Promise<boolean> {
    try {
      const res = await fetch(`${apiHost}/health`, { signal: AbortSignal.timeout(2000) });
      return res.ok;
    } catch {
      return false;
    }
  }

  /** Locate the bundled server/ source (works from dist/ or src/) */
  private getServerSourceDir(): string {
    const pkgDir = path.dirname(new URL(import.meta.url).pathname);
    return path.resolve(pkgDir, '..', 'server');
  }

  /** Read the npm package version from package.json */
  private async getPackageVersion(): Promise<string> {
    const pkgDir = path.dirname(new URL(import.meta.url).pathname);
    try {
      const raw = await fs.readFile(path.resolve(pkgDir, '..', 'package.json'), 'utf-8');
      return JSON.parse(raw).version || '0.0.0';
    } catch {
      return '0.0.0';
    }
  }

  /** Check if the global install needs to be (re)created */
  private async needsInstall(): Promise<boolean> {
    const home = ImageGenerator.AI_IMAGE_HOME;
    const venvBin = path.join(home, 'server', '.venv', 'bin', 'ai-image-server');
    const versionFile = path.join(home, 'version.json');

    // No venv at all
    const hasVenv = await fs.access(venvBin).then(() => true, () => false);
    if (!hasVenv) return true;

    // Version mismatch
    const currentVersion = await this.getPackageVersion();
    try {
      const raw = await fs.readFile(versionFile, 'utf-8');
      const { version } = JSON.parse(raw);
      return version !== currentVersion;
    } catch {
      return true; // no version file = needs install
    }
  }

  /** Install or upgrade the server in ~/.ai-image/ */
  private async installServer(debug?: boolean): Promise<void> {
    const { execSync } = await import('child_process');
    const home = ImageGenerator.AI_IMAGE_HOME;
    const sourceDir = this.getServerSourceDir();
    const targetDir = path.join(home, 'server');

    // Verify source exists
    const hasSource = await fs.access(path.join(sourceDir, 'pyproject.toml')).then(() => true, () => false);
    if (!hasSource) {
      throw new Error(
        '[ai-image] Server source not found in the ai-image package.\n' +
        'Reinstall: npm install ai-image'
      );
    }

    // Check for Python
    const hasPython = (() => {
      try { execSync('which python3 2>/dev/null'); return true; } catch { return false; }
    })();
    if (!hasPython) {
      throw new Error(
        '[ai-image] Python 3.11+ is required for local image generation.\n\n' +
        'Install Python:\n' +
        '  macOS:   brew install python@3.13\n' +
        '  Ubuntu:  sudo apt install python3\n' +
        '  Windows: https://www.python.org/downloads/'
      );
    }

    // Check for uv (preferred) or fall back to pip
    const uvPath = (() => {
      try { return execSync('which uv 2>/dev/null', { encoding: 'utf-8' }).trim(); } catch { return null; }
    })();

    console.error('[ai-image] Setting up local image generation server...');
    console.error(`[ai-image] Install location: ${home}`);

    // Create dirs
    await fs.mkdir(targetDir, { recursive: true });

    // Copy server source to ~/.ai-image/server/
    // (copy pyproject.toml + ai_image_server/ package)
    const serverPkgDir = path.join(targetDir, 'ai_image_server');
    await fs.mkdir(serverPkgDir, { recursive: true });

    // Copy pyproject.toml
    await fs.copyFile(path.join(sourceDir, 'pyproject.toml'), path.join(targetDir, 'pyproject.toml'));

    // Copy only .py files from source (skip __pycache__ etc)
    const sourceFiles = await fs.readdir(path.join(sourceDir, 'ai_image_server'));
    for (const file of sourceFiles) {
      if (!file.endsWith('.py')) continue;
      await fs.copyFile(
        path.join(sourceDir, 'ai_image_server', file),
        path.join(serverPkgDir, file),
      );
    }

    // Create venv and install
    try {
      if (uvPath) {
        if (debug) console.error('[debug] Installing with uv');
        execSync(`${uvPath} venv`, { cwd: targetDir, stdio: debug ? 'inherit' : 'pipe' });
        execSync(`${uvPath} pip install -e .`, { cwd: targetDir, stdio: debug ? 'inherit' : 'pipe' });
      } else {
        if (debug) console.error('[debug] Installing with pip (uv not found)');
        execSync('python3 -m venv .venv', { cwd: targetDir, stdio: debug ? 'inherit' : 'pipe' });
        execSync('.venv/bin/pip install -e .', { cwd: targetDir, stdio: debug ? 'inherit' : 'pipe' });
      }
    } catch (e) {
      throw new Error(
        `[ai-image] Failed to install the local server.\n\n` +
        (uvPath
          ? `Install uv for faster setup: brew install uv\n\n`
          : '') +
        `Try manually:\n` +
        `  cd ${targetDir}\n` +
        `  ${uvPath ? 'uv venv && uv pip install -e .' : 'python3 -m venv .venv && .venv/bin/pip install -e .'}\n\n` +
        `Error: ${e instanceof Error ? e.message : e}`
      );
    }

    // Write version file
    const version = await this.getPackageVersion();
    await fs.writeFile(
      path.join(home, 'version.json'),
      JSON.stringify({ version, installedAt: new Date().toISOString() }, null, 2),
    );

    console.error('[ai-image] Server installed successfully.');
    console.error('[ai-image] Models cached in: ~/.cache/huggingface/hub/');
  }

  private async startLocalServer(apiHost: string, debug?: boolean): Promise<void> {
    if (ImageGenerator.localServerProcess) return;

    const url = new URL(apiHost);
    const port = url.port || '8506';
    const home = ImageGenerator.AI_IMAGE_HOME;

    // Install or upgrade if needed
    if (await this.needsInstall()) {
      await this.installServer(debug);
    }

    const cmd = path.join(home, 'server', '.venv', 'bin', 'ai-image-server');
    const args = ['--port', port, '--auto-sleep', '300'];

    // Verify binary exists
    const hasBin = await fs.access(cmd).then(() => true, () => false);
    if (!hasBin) {
      throw new Error(
        `[ai-image] Server binary not found at ${cmd}\n` +
        `Try removing ~/.ai-image and running again:\n` +
        `  rm -rf ~/.ai-image`
      );
    }

    if (debug) {
      console.error(`[debug] Starting local server: ${cmd} ${args.join(' ')}`);
    }

    let procExited = false;
    let procError = '';

    const proc = spawn(cmd, args, {
      stdio: debug ? 'inherit' : ['ignore', 'ignore', 'pipe'],
      detached: true,
      env: process.env,
    });

    if (!debug && proc.stderr) {
      const chunks: Buffer[] = [];
      proc.stderr.on('data', (chunk: Buffer) => chunks.push(chunk));
      proc.on('close', () => { procError = Buffer.concat(chunks).toString().trim(); });
    }

    proc.on('exit', (code) => {
      procExited = true;
      if (code !== 0 && code !== null) {
        procError = procError || `Server exited with code ${code}`;
      }
    });

    proc.unref();
    ImageGenerator.localServerProcess = proc;

    // Wait for server to be ready
    const maxWait = 120_000;
    const start = Date.now();
    while (Date.now() - start < maxWait) {
      if (procExited) {
        ImageGenerator.localServerProcess = null;
        throw new Error(
          `[ai-image] Local server failed to start.\n` +
          (procError ? `Server output: ${procError}\n` : '') +
          `\nTry running manually:\n  ${cmd} ${args.join(' ')}`
        );
      }

      if (await this.isLocalServerRunning(apiHost)) {
        if (debug) console.error('[debug] Local server is ready');
        return;
      }
      await new Promise(r => setTimeout(r, 1000));
    }

    throw new Error(
      `[ai-image] Local server started but not ready after ${maxWait / 1000}s.\n` +
      'The model may still be downloading on first run.\n' +
      `Try running manually: ${cmd} ${args.join(' ')}`
    );
  }

  private async ensureLocalServer(apiHost: string, debug?: boolean): Promise<void> {
    if (await this.isLocalServerRunning(apiHost)) return;
    console.error('[ai-image] Starting local server (auto-sleeps after 5 min idle)...');
    await this.startLocalServer(apiHost, debug);
  }

  private async generateLocal(options: GenerateOptions, savedPaths: string[], outputDir: string, outputFilename?: string): Promise<string> {
    const model = options.model || 'flux2-klein-4b';
    const apiHost = this.getLocalHost();

    await this.ensureLocalServer(apiHost, options.debug);

    const size = options.size || '512x512';
    const [w, h] = size.split('x').map(Number);

    const body: Record<string, unknown> = {
      prompt: options.prompt,
      width: w || 512,
      height: h || 512,
    };

    if (options.steps != null) body.steps = options.steps;
    if (options.seed != null) body.seed = options.seed;
    if (options.guidanceScale != null) body.guidance = options.guidanceScale;
    if (options.negativePrompt) body.negative_prompt = options.negativePrompt;

    if (options.debug) {
      console.error(`[debug] Local server request: POST ${apiHost}/generate`);
      console.error('[debug] Local body:', JSON.stringify(body, null, 2));
    }

    const n = options.n || 1;
    for (let i = 0; i < n; i++) {
      if (n > 1 && options.seed != null) {
        body.seed = options.seed + i;
      }

      const response = await fetch(`${apiHost}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Local server error (${response.status}): ${errText}`);
      }

      const contentType = response.headers.get('Content-Type') || '';

      if (contentType.includes('image/')) {
        const buffer = Buffer.from(await response.arrayBuffer());
        const ext = options.format || 'png';
        const outputPath = await this.getOutputPath(options.prompt, i, ext, outputDir, outputFilename);
        await fs.writeFile(outputPath, buffer);
        savedPaths.push(outputPath);
      } else {
        const result = await response.json() as { output?: string; status?: string };
        if (result.output) {
          savedPaths.push(result.output);
        }
      }
    }

    return model;
  }

  private simplifyRatio(w: number, h: number): string {
    const gcd = (a: number, b: number): number => b === 0 ? a : gcd(b, a % b);
    const d = gcd(w, h);
    return `${w / d}:${h / d}`;
  }
}

// ─── Convenience function for one-shot generation ─────────────────────

export async function generateImage(
  prompt: string,
  options: Partial<GenerateOptions> & { provider?: Provider; apiKey?: string; outputDir?: string } = {}
): Promise<GenerateResult> {
  const provider = options.provider || 'openai';
  const generator = new ImageGenerator({
    provider,
    apiKey: options.apiKey,
    outputDir: options.outputDir,
  });
  return generator.generate({ prompt, ...options });
}

// Re-export types and SDK classes
export { OpenAI, Replicate };
