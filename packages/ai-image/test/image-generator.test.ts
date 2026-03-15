import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ImageGenerator, Provider } from '../src/index.js';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

// ─── Constructor & Configuration ────────────────────────────────────────

describe('ImageGenerator constructor', () => {
  it('throws when no API key is available', () => {
    expect(() => new ImageGenerator({ provider: 'openai' }))
      .toThrow('[AI-IMAGE] API key for openai not found');
  });

  it('accepts an explicit API key', () => {
    const gen = new ImageGenerator({ provider: 'stability', apiKey: 'test-key' });
    expect(gen).toBeDefined();
  });

  it('reads OPENAI_API_KEY from env', () => {
    process.env.OPENAI_API_KEY = 'env-key';
    const gen = new ImageGenerator({ provider: 'openai' });
    expect(gen).toBeDefined();
    delete process.env.OPENAI_API_KEY;
  });

  it('reads REPLICATE_API_TOKEN from env', () => {
    process.env.REPLICATE_API_TOKEN = 'env-token';
    const gen = new ImageGenerator({ provider: 'replicate' });
    expect(gen).toBeDefined();
    delete process.env.REPLICATE_API_TOKEN;
  });

  it('reads STABILITY_API_KEY from env', () => {
    process.env.STABILITY_API_KEY = 'env-key';
    const gen = new ImageGenerator({ provider: 'stability' });
    expect(gen).toBeDefined();
    delete process.env.STABILITY_API_KEY;
  });

  it('reads FAL_KEY from env', () => {
    process.env.FAL_KEY = 'env-key';
    const gen = new ImageGenerator({ provider: 'fal' });
    expect(gen).toBeDefined();
    delete process.env.FAL_KEY;
  });

  it('reads TOGETHER_API_KEY from env', () => {
    process.env.TOGETHER_API_KEY = 'env-key';
    const gen = new ImageGenerator({ provider: 'together' });
    expect(gen).toBeDefined();
    delete process.env.TOGETHER_API_KEY;
  });

  it('reads BFL_API_KEY from env', () => {
    process.env.BFL_API_KEY = 'env-key';
    const gen = new ImageGenerator({ provider: 'bfl' });
    expect(gen).toBeDefined();
    delete process.env.BFL_API_KEY;
  });

  it('reads GOOGLE_API_KEY from env', () => {
    process.env.GOOGLE_API_KEY = 'env-key';
    const gen = new ImageGenerator({ provider: 'google' });
    expect(gen).toBeDefined();
    delete process.env.GOOGLE_API_KEY;
  });

  it('reads FIREWORKS_API_KEY from env', () => {
    process.env.FIREWORKS_API_KEY = 'env-key';
    const gen = new ImageGenerator({ provider: 'fireworks' });
    expect(gen).toBeDefined();
    delete process.env.FIREWORKS_API_KEY;
  });

  it('ollama does not require an API key', () => {
    const gen = new ImageGenerator({ provider: 'ollama' });
    expect(gen).toBeDefined();
  });

  it('uses custom outputDir and outputFilename', () => {
    const gen = new ImageGenerator({
      provider: 'stability',
      apiKey: 'k',
      outputDir: '/tmp/test-images',
      outputFilename: 'my-image.png',
    });
    expect(gen).toBeDefined();
  });

  const allProviders: Provider[] = ['openai', 'replicate', 'stability', 'fal', 'together', 'bfl', 'google', 'fireworks', 'ollama'];
  for (const p of allProviders) {
    it(`creates instance for provider "${p}"`, () => {
      const gen = new ImageGenerator({ provider: p, apiKey: 'test-key' });
      expect(gen).toBeDefined();
    });
  }
});

// ─── File output logic ──────────────────────────────────────────────────

describe('ImageGenerator file handling', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ai-image-test-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('creates output directory if missing', async () => {
    const nestedDir = path.join(tmpDir, 'nested', 'deep');
    const gen = new ImageGenerator({
      provider: 'together',
      apiKey: 'test-key',
      outputDir: nestedDir,
    });

    // Mock fetch for Together API
    const fakeB64 = Buffer.from('fake-png-data').toString('base64');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ b64_json: fakeB64 }] }),
    }));

    const result = await gen.generate({ prompt: 'test image' });

    expect(result.filePaths).toHaveLength(1);
    expect(result.filePaths[0]).toContain(nestedDir);
    expect(result.provider).toBe('together');

    const stat = await fs.stat(nestedDir);
    expect(stat.isDirectory()).toBe(true);

    vi.restoreAllMocks();
  });

  it('sanitizes filenames from prompts', async () => {
    const gen = new ImageGenerator({
      provider: 'together',
      apiKey: 'test-key',
      outputDir: tmpDir,
    });

    const fakeB64 = Buffer.from('fake').toString('base64');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ b64_json: fakeB64 }] }),
    }));

    const result = await gen.generate({ prompt: 'a "cool" <image> with/slashes' });
    const filename = path.basename(result.filePaths[0]);
    // Should not contain special characters
    expect(filename).not.toMatch(/[<>:"/\\|?*]/);
    expect(filename).toContain('a_cool_image_withslashes');

    vi.restoreAllMocks();
  });

  it('handles filename collisions by appending counter', async () => {
    const gen = new ImageGenerator({
      provider: 'together',
      apiKey: 'test-key',
      outputDir: tmpDir,
    });

    // Pre-create a file to cause collision
    await fs.writeFile(path.join(tmpDir, 'collision_test.png'), 'existing');

    const fakeB64 = Buffer.from('fake').toString('base64');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ b64_json: fakeB64 }] }),
    }));

    const result = await gen.generate({ prompt: 'collision test' });
    const filename = path.basename(result.filePaths[0]);
    // Should have counter appended
    expect(filename).toMatch(/collision_test \d+\.png/);

    vi.restoreAllMocks();
  });

  it('uses custom output filename', async () => {
    const gen = new ImageGenerator({
      provider: 'together',
      apiKey: 'test-key',
      outputDir: tmpDir,
      outputFilename: 'my-custom.jpeg',
    });

    const fakeB64 = Buffer.from('fake').toString('base64');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ b64_json: fakeB64 }] }),
    }));

    const result = await gen.generate({ prompt: 'test' });
    expect(path.basename(result.filePaths[0])).toBe('my-custom.jpeg');

    vi.restoreAllMocks();
  });

  it('uses per-call outputDir override', async () => {
    const overrideDir = path.join(tmpDir, 'override');
    const gen = new ImageGenerator({
      provider: 'together',
      apiKey: 'test-key',
      outputDir: tmpDir,
    });

    const fakeB64 = Buffer.from('fake').toString('base64');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ b64_json: fakeB64 }] }),
    }));

    const result = await gen.generate({ prompt: 'test', outputDir: overrideDir });
    expect(result.filePaths[0]).toContain('override');

    vi.restoreAllMocks();
  });
});
