import { describe, it, expect, vi, afterEach } from 'vitest';
import { generateImage } from '../src/index.js';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

const fakeImageB64 = Buffer.from('FAKE').toString('base64');

afterEach(() => {
  vi.restoreAllMocks();
});

describe('generateImage() convenience function', () => {
  it('works with minimal arguments (defaults to openai)', async () => {
    // OpenAI requires its client so this will throw about API key
    await expect(generateImage('test')).rejects.toThrow('API key for openai not found');
  });

  it('works with together provider and generates image', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ai-image-conv-'));

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ b64_json: fakeImageB64 }] }),
    }));

    const result = await generateImage('hello world', {
      provider: 'together',
      apiKey: 'test-key',
      outputDir: tmpDir,
    });

    expect(result.provider).toBe('together');
    expect(result.filePaths).toHaveLength(1);
    expect(result.filePaths[0]).toContain(tmpDir);

    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('passes through all options', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ai-image-opts-'));
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ b64_json: fakeImageB64 }] }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await generateImage('test prompt', {
      provider: 'together',
      apiKey: 'key',
      outputDir: tmpDir,
      size: '768x768',
      seed: 99,
      steps: 10,
    });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.width).toBe(768);
    expect(body.height).toBe(768);
    expect(body.seed).toBe(99);
    expect(body.steps).toBe(10);

    await fs.rm(tmpDir, { recursive: true, force: true });
  });
});
