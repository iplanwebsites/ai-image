import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ImageGenerator } from '../src/index.js';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

let tmpDir: string;
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ai-image-provider-'));
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(async () => {
  vi.restoreAllMocks();
  await fs.rm(tmpDir, { recursive: true, force: true });
});

const fakeImageB64 = Buffer.from('PNG-FAKE-IMAGE-DATA').toString('base64');
const fakeImageBytes = Buffer.from('PNG-FAKE-IMAGE-DATA');

// ─── Together AI ────────────────────────────────────────────────────────

describe('Together AI provider', () => {
  it('sends correct request and saves b64_json image', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [{ b64_json: fakeImageB64 }] }),
    });

    const gen = new ImageGenerator({ provider: 'together', apiKey: 'tok-123', outputDir: tmpDir });
    const result = await gen.generate({ prompt: 'a cat', size: '512x512', seed: 42 });

    expect(result.provider).toBe('together');
    expect(result.model).toBe('black-forest-labs/FLUX.1-schnell-Free');
    expect(result.filePaths).toHaveLength(1);

    // Verify file content
    const content = await fs.readFile(result.filePaths[0]);
    expect(content).toEqual(fakeImageBytes);

    // Verify fetch was called correctly
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.together.xyz/v1/images/generations');
    expect(opts.method).toBe('POST');
    expect(opts.headers['Authorization']).toBe('Bearer tok-123');
    const body = JSON.parse(opts.body);
    expect(body.prompt).toBe('a cat');
    expect(body.width).toBe(512);
    expect(body.height).toBe(512);
    expect(body.seed).toBe(42);
    expect(body.response_format).toBe('b64_json');
  });

  it('handles URL response format', async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [{ url: 'https://example.com/image.png' }] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        arrayBuffer: async () => fakeImageBytes.buffer.slice(
          fakeImageBytes.byteOffset,
          fakeImageBytes.byteOffset + fakeImageBytes.byteLength
        ),
      });

    const gen = new ImageGenerator({ provider: 'together', apiKey: 'tok', outputDir: tmpDir });
    const result = await gen.generate({ prompt: 'a dog' });

    expect(result.filePaths).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('throws on API error', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: async () => 'Unauthorized',
    });

    const gen = new ImageGenerator({ provider: 'together', apiKey: 'bad', outputDir: tmpDir });
    await expect(gen.generate({ prompt: 'fail' }))
      .rejects.toThrow('Together API error (401): Unauthorized');
  });

  it('passes optional parameters', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [{ b64_json: fakeImageB64 }] }),
    });

    const gen = new ImageGenerator({ provider: 'together', apiKey: 'tok', outputDir: tmpDir });
    await gen.generate({
      prompt: 'test',
      steps: 20,
      negativePrompt: 'blurry',
      model: 'black-forest-labs/FLUX.1-schnell',
    });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.steps).toBe(20);
    expect(body.negative_prompt).toBe('blurry');
    expect(body.model).toBe('black-forest-labs/FLUX.1-schnell');
  });
});

// ─── Stability AI ───────────────────────────────────────────────────────

describe('Stability AI provider', () => {
  it('sends FormData request with correct headers', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      arrayBuffer: async () => fakeImageBytes.buffer.slice(
        fakeImageBytes.byteOffset,
        fakeImageBytes.byteOffset + fakeImageBytes.byteLength
      ),
    });

    const gen = new ImageGenerator({ provider: 'stability', apiKey: 'sk-123', outputDir: tmpDir });
    const result = await gen.generate({ prompt: 'landscape', format: 'jpeg' });

    expect(result.provider).toBe('stability');
    expect(result.model).toBe('sd3.5-large');
    expect(result.filePaths).toHaveLength(1);
    expect(result.filePaths[0]).toMatch(/\.jpeg$/);

    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toContain('api.stability.ai');
    expect(url).toContain('/v2beta/stable-image/generate/sd3');
    expect(opts.headers['Authorization']).toBe('Bearer sk-123');
    expect(opts.headers['Accept']).toBe('image/*');
    expect(opts.body).toBeInstanceOf(FormData);
  });

  it('throws on API error', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 403,
      text: async () => 'Forbidden',
    });

    const gen = new ImageGenerator({ provider: 'stability', apiKey: 'bad', outputDir: tmpDir });
    await expect(gen.generate({ prompt: 'fail' }))
      .rejects.toThrow('Stability API error (403): Forbidden');
  });
});

// ─── FAL.ai ─────────────────────────────────────────────────────────────

describe('FAL.ai provider', () => {
  it('handles synchronous image response', async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ images: [{ url: 'https://fal.media/result.png' }] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        arrayBuffer: async () => fakeImageBytes.buffer.slice(
          fakeImageBytes.byteOffset,
          fakeImageBytes.byteOffset + fakeImageBytes.byteLength
        ),
      });

    const gen = new ImageGenerator({ provider: 'fal', apiKey: 'fal-key', outputDir: tmpDir });
    const result = await gen.generate({ prompt: 'sunset' });

    expect(result.provider).toBe('fal');
    expect(result.model).toBe('fal-ai/flux/dev');
    expect(result.filePaths).toHaveLength(1);

    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toBe('https://queue.fal.run/fal-ai/flux/dev');
    expect(opts.headers['Authorization']).toBe('Key fal-key');
  });

  it('handles async queue response with polling', async () => {
    // Submit returns request_id
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ request_id: 'req-abc' }),
      })
      // First poll: IN_PROGRESS
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: 'IN_PROGRESS' }),
      })
      // Second poll: COMPLETED
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: 'COMPLETED' }),
      })
      // Fetch result
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ images: [{ url: 'https://fal.media/done.png' }] }),
      })
      // Download image
      .mockResolvedValueOnce({
        ok: true,
        arrayBuffer: async () => fakeImageBytes.buffer.slice(
          fakeImageBytes.byteOffset,
          fakeImageBytes.byteOffset + fakeImageBytes.byteLength
        ),
      });

    const gen = new ImageGenerator({ provider: 'fal', apiKey: 'fal-key', outputDir: tmpDir });
    const result = await gen.generate({ prompt: 'async test' });

    expect(result.filePaths).toHaveLength(1);
    // submit + 2 polls + result fetch + image download = 5 calls
    expect(fetchMock).toHaveBeenCalledTimes(5);
  });

  it('throws on FAL API error', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 422,
      text: async () => 'Invalid model',
    });

    const gen = new ImageGenerator({ provider: 'fal', apiKey: 'key', outputDir: tmpDir });
    await expect(gen.generate({ prompt: 'fail' }))
      .rejects.toThrow('FAL API error (422): Invalid model');
  });
});

// ─── BFL (Black Forest Labs) ────────────────────────────────────────────

describe('BFL provider', () => {
  it('submits, polls, and downloads image', async () => {
    fetchMock
      // Submit
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'task-123' }),
      })
      // Poll: Pending
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: 'Pending' }),
      })
      // Poll: Ready
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: 'Ready', result: { sample: 'https://bfl.ai/image.png' } }),
      })
      // Download
      .mockResolvedValueOnce({
        ok: true,
        arrayBuffer: async () => fakeImageBytes.buffer.slice(
          fakeImageBytes.byteOffset,
          fakeImageBytes.byteOffset + fakeImageBytes.byteLength
        ),
      });

    const gen = new ImageGenerator({ provider: 'bfl', apiKey: 'bfl-key', outputDir: tmpDir });
    const result = await gen.generate({ prompt: 'landscape', seed: 42, guidanceScale: 2.5 });

    expect(result.provider).toBe('bfl');
    expect(result.model).toBe('flux-pro-1.1');
    expect(result.filePaths).toHaveLength(1);

    // Check submit request
    const [submitUrl, submitOpts] = fetchMock.mock.calls[0];
    expect(submitUrl).toBe('https://api.bfl.ai/v1/flux-pro-1.1');
    expect(submitOpts.headers['X-Key']).toBe('bfl-key');
    const body = JSON.parse(submitOpts.body);
    expect(body.seed).toBe(42);
    expect(body.guidance).toBe(2.5);

    // Check poll used correct URL
    const pollUrl = fetchMock.mock.calls[1][0];
    expect(pollUrl).toContain('api.bfl.ai/v1/get_result?id=task-123');
  });

  it('throws on BFL submit error', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 400,
      text: async () => 'Bad Request',
    });

    const gen = new ImageGenerator({ provider: 'bfl', apiKey: 'key', outputDir: tmpDir });
    await expect(gen.generate({ prompt: 'fail' }))
      .rejects.toThrow('BFL API error (400): Bad Request');
  });
});

// ─── Google Imagen ──────────────────────────────────────────────────────

describe('Google Imagen provider', () => {
  it('sends correct predict request and saves image', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        predictions: [{ bytesBase64Encoded: fakeImageB64, mimeType: 'image/png' }],
      }),
    });

    const gen = new ImageGenerator({ provider: 'google', apiKey: 'goog-key', outputDir: tmpDir });
    const result = await gen.generate({ prompt: 'mountain', n: 1 });

    expect(result.provider).toBe('google');
    expect(result.model).toBe('imagen-4.0-generate-001');
    expect(result.filePaths).toHaveLength(1);
    expect(result.filePaths[0]).toMatch(/\.png$/);

    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain('generativelanguage.googleapis.com');
    expect(url).toContain('imagen-4.0-generate-001:predict');
    expect(url).toContain('key=goog-key');
  });

  it('saves as jpeg when mimeType indicates jpeg', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        predictions: [{ bytesBase64Encoded: fakeImageB64, mimeType: 'image/jpeg' }],
      }),
    });

    const gen = new ImageGenerator({ provider: 'google', apiKey: 'goog-key', outputDir: tmpDir });
    const result = await gen.generate({ prompt: 'test', format: 'jpeg' });

    expect(result.filePaths[0]).toMatch(/\.jpeg$/);
  });
});

// ─── Fireworks AI ───────────────────────────────────────────────────────

describe('Fireworks AI provider', () => {
  it('sends correct request and handles base64 array response', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ base64: [fakeImageB64], finishReason: 'SUCCESS', seed: 12345 }),
    });

    const gen = new ImageGenerator({ provider: 'fireworks', apiKey: 'fw-key', outputDir: tmpDir });
    const result = await gen.generate({ prompt: 'car', size: '1024x1024' });

    expect(result.provider).toBe('fireworks');
    expect(result.model).toBe('flux-1-schnell-fp8');
    expect(result.filePaths).toHaveLength(1);
    // Fireworks defaults to jpeg
    expect(result.filePaths[0]).toMatch(/\.jpeg$/);

    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toContain('api.fireworks.ai');
    expect(url).toContain('flux-1-schnell-fp8');
    expect(opts.headers['Authorization']).toBe('Bearer fw-key');
    expect(opts.headers['Accept']).toBe('application/json');
  });

  it('handles data array response format', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [{ b64_json: fakeImageB64 }] }),
    });

    const gen = new ImageGenerator({ provider: 'fireworks', apiKey: 'fw-key', outputDir: tmpDir });
    const result = await gen.generate({ prompt: 'boat' });

    expect(result.filePaths).toHaveLength(1);
  });

  it('throws on error', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 429,
      text: async () => 'Rate limited',
    });

    const gen = new ImageGenerator({ provider: 'fireworks', apiKey: 'fw-key', outputDir: tmpDir });
    await expect(gen.generate({ prompt: 'fail' }))
      .rejects.toThrow('Fireworks API error (429): Rate limited');
  });
});

// ─── Ollama (Local) ─────────────────────────────────────────────────────

describe('Ollama provider', () => {
  it('sends correct request to localhost', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ image: fakeImageB64, done: true }),
    });

    const gen = new ImageGenerator({ provider: 'ollama', outputDir: tmpDir });
    const result = await gen.generate({ prompt: 'cat' });

    expect(result.provider).toBe('ollama');
    expect(result.model).toBe('x/flux2-klein:4b');
    expect(result.filePaths).toHaveLength(1);

    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toBe('http://localhost:11434/api/generate');
    const body = JSON.parse(opts.body);
    expect(body.model).toBe('x/flux2-klein:4b');
    expect(body.stream).toBe(false);
  });

  it('uses custom host when apiKey starts with http', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ image: fakeImageB64, done: true }),
    });

    const gen = new ImageGenerator({ provider: 'ollama', apiKey: 'http://my-server:11434', outputDir: tmpDir });
    const result = await gen.generate({ prompt: 'dog' });

    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe('http://my-server:11434/api/generate');
    expect(result.filePaths).toHaveLength(1);
  });

  it('handles response field as fallback', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ response: fakeImageB64, done: true }),
    });

    const gen = new ImageGenerator({ provider: 'ollama', outputDir: tmpDir });
    const result = await gen.generate({ prompt: 'bird' });
    expect(result.filePaths).toHaveLength(1);
  });

  it('throws on error', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 404,
      text: async () => 'model not found',
    });

    const gen = new ImageGenerator({ provider: 'ollama', outputDir: tmpDir });
    await expect(gen.generate({ prompt: 'fail' }))
      .rejects.toThrow('Ollama API error (404): model not found');
  });
});

// ─── General generate() behavior ────────────────────────────────────────

describe('generate() general', () => {
  it('returns elapsed time', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [{ b64_json: fakeImageB64 }] }),
    });

    const gen = new ImageGenerator({ provider: 'together', apiKey: 'tok', outputDir: tmpDir });
    const result = await gen.generate({ prompt: 'fast' });

    expect(result.elapsed).toBeGreaterThanOrEqual(0);
    expect(typeof result.elapsed).toBe('number');
  });

  it('wraps provider errors in standard format', async () => {
    fetchMock.mockRejectedValueOnce(new Error('Network timeout'));

    const gen = new ImageGenerator({ provider: 'together', apiKey: 'tok', outputDir: tmpDir });
    await expect(gen.generate({ prompt: 'fail' }))
      .rejects.toThrow('[AI-IMAGE] Image generation failed (together): Network timeout');
  });

  it('supports multiple images with n > 1', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [
          { b64_json: fakeImageB64 },
          { b64_json: fakeImageB64 },
        ],
      }),
    });

    const gen = new ImageGenerator({ provider: 'together', apiKey: 'tok', outputDir: tmpDir });
    const result = await gen.generate({ prompt: 'multi', n: 2 });

    expect(result.filePaths).toHaveLength(2);
    // Second image should have _1 suffix
    expect(path.basename(result.filePaths[1])).toMatch(/_1\./);
  });

  it('uses per-call outputFilename override', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [{ b64_json: fakeImageB64 }] }),
    });

    const gen = new ImageGenerator({ provider: 'together', apiKey: 'tok', outputDir: tmpDir });
    const result = await gen.generate({ prompt: 'test', outputFilename: 'override.webp' });

    expect(path.basename(result.filePaths[0])).toBe('override.webp');
  });
});
