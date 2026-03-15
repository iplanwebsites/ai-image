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

  private static localServerProcess: ChildProcess | null = null;

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

  private async startLocalServer(apiHost: string, debug?: boolean): Promise<void> {
    if (ImageGenerator.localServerProcess) return;

    const url = new URL(apiHost);
    const port = url.port || '8506';

    // Try to find ai-image-server, checking the bundled server/ venv first
    const { execSync } = await import('child_process');
    const pkgDir = path.dirname(new URL(import.meta.url).pathname);
    let cmd: string | null = null;
    let args: string[] = [];

    // 1. Check server/.venv in the package directory (dev / linked installs)
    const venvBin = path.resolve(pkgDir, '..', 'server', '.venv', 'bin', 'ai-image-server');
    try {
      await fs.access(venvBin);
      cmd = venvBin;
      args = ['--port', port, '--auto-sleep', '300'];
    } catch { /* not found */ }

    // 2. Check if ai-image-server is on PATH
    if (!cmd) {
      try {
        const which = execSync('which ai-image-server 2>/dev/null', { encoding: 'utf-8' }).trim();
        if (which) {
          cmd = which;
          args = ['--port', port, '--auto-sleep', '300'];
        }
      } catch { /* not found */ }
    }

    // 3. Fallback: try python -m
    if (!cmd) {
      for (const py of ['python3', 'python']) {
        try {
          const which = execSync(`which ${py} 2>/dev/null`, { encoding: 'utf-8' }).trim();
          // Verify the module is importable
          execSync(`${which} -c "import ai_image_server" 2>/dev/null`);
          cmd = which;
          args = ['-m', 'ai_image_server.server', '--port', port, '--auto-sleep', '300'];
          break;
        } catch { /* not found */ }
      }
    }

    if (!cmd) {
      throw new Error(
        'Cannot auto-start local server: ai-image-server not found.\n' +
        'Install it with: cd server && uv venv && uv pip install -e .'
      );
    }

    if (debug) {
      console.error(`[debug] Starting local server: ${cmd} ${args.join(' ')}`);
    }

    const proc = spawn(cmd, args, {
      stdio: debug ? 'inherit' : 'ignore',
      detached: true,
    });
    proc.unref();
    ImageGenerator.localServerProcess = proc;

    // Wait for server to be ready (model loading can take a while)
    const maxWait = 120_000; // 2 minutes for model download/load
    const start = Date.now();
    while (Date.now() - start < maxWait) {
      if (await this.isLocalServerRunning(apiHost)) {
        if (debug) console.error('[debug] Local server is ready');
        return;
      }
      await new Promise(r => setTimeout(r, 1000));
    }

    throw new Error(
      `Local server started but not ready after ${maxWait / 1000}s. ` +
      'The model may still be downloading. Try again or start the server manually.'
    );
  }

  private async ensureLocalServer(apiHost: string, debug?: boolean): Promise<void> {
    if (await this.isLocalServerRunning(apiHost)) return;
    console.error('Local server not running, starting automatically (this may take a moment on first run)...');
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
