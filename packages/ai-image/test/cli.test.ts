import { describe, it, expect } from 'vitest';
import { execFileSync } from 'child_process';
import path from 'path';

const CLI_PATH = path.resolve('dist/cli.js');

function runCLI(args: string[]): { stdout: string; stderr: string; exitCode: number } {
  try {
    const stdout = execFileSync('node', [CLI_PATH, ...args], {
      encoding: 'utf-8',
      timeout: 10_000,
      env: { ...process.env, NODE_NO_WARNINGS: '1' },
    });
    return { stdout, stderr: '', exitCode: 0 };
  } catch (error: any) {
    return {
      stdout: error.stdout || '',
      stderr: error.stderr || '',
      exitCode: error.status ?? 1,
    };
  }
}

describe('CLI', () => {
  it('shows help with --help', () => {
    const { stdout, exitCode } = runCLI(['--help']);
    expect(exitCode).toBe(0);
    expect(stdout).toContain('ai-image');
    expect(stdout).toContain('generate');
    expect(stdout).toContain('models');
    expect(stdout).toContain('setup');
  });

  it('shows version with --version', () => {
    const { stdout, exitCode } = runCLI(['--version']);
    expect(exitCode).toBe(0);
    expect(stdout.trim()).toBe('0.1.0');
  });

  it('generate requires --prompt', () => {
    const { exitCode, stdout } = runCLI(['generate', '--json', '-p', 'together', '-k', 'fake']);
    expect(exitCode).toBe(1);
    expect(stdout).toContain('Prompt is required');
  });

  it('generate rejects invalid provider', () => {
    const { exitCode, stdout } = runCLI(['generate', '--json', '-p', 'invalid', '--prompt', 'test']);
    expect(exitCode).toBe(1);
    expect(stdout).toContain('Provider must be one of');
  });

  it('generate --json outputs JSON errors', () => {
    const { stdout } = runCLI(['generate', '--json', '-p', 'together', '--prompt', 'test']);
    // Should fail because no API key, but output valid JSON
    const parsed = JSON.parse(stdout.trim());
    expect(parsed.error).toBeDefined();
  });
});

describe('CLI models command', () => {
  it('outputs model list', () => {
    const { stdout, exitCode } = runCLI(['models']);
    expect(exitCode).toBe(0);
    expect(stdout).toContain('OpenAI');
    expect(stdout).toContain('gpt-image-1');
    expect(stdout).toContain('Replicate');
    expect(stdout).toContain('Stability');
    expect(stdout).toContain('FAL');
    expect(stdout).toContain('Together');
    expect(stdout).toContain('BFL');
    expect(stdout).toContain('Google');
    expect(stdout).toContain('Fireworks');
    expect(stdout).toContain('Ollama');
  });

  it('outputs valid JSON with --json', () => {
    const { stdout, exitCode } = runCLI(['models', '--json']);
    expect(exitCode).toBe(0);
    const models = JSON.parse(stdout);
    expect(models.openai).toBeInstanceOf(Array);
    expect(models.replicate).toBeInstanceOf(Array);
    expect(models.stability).toBeInstanceOf(Array);
    expect(models.fal).toBeInstanceOf(Array);
    expect(models.together).toBeInstanceOf(Array);
    expect(models.bfl).toBeInstanceOf(Array);
    expect(models.google).toBeInstanceOf(Array);
    expect(models.fireworks).toBeInstanceOf(Array);
    expect(models.ollama).toBeInstanceOf(Array);

    // Check each provider has at least one model with an id
    for (const provider of Object.keys(models)) {
      expect(models[provider].length).toBeGreaterThan(0);
      expect(models[provider][0].id).toBeDefined();
      expect(models[provider][0].description).toBeDefined();
    }
  });
});

describe('CLI setup command', () => {
  it('shows setup instructions', () => {
    const { stdout, exitCode } = runCLI(['setup']);
    expect(exitCode).toBe(0);
    expect(stdout).toContain('OPENAI_API_KEY');
    expect(stdout).toContain('REPLICATE_API_TOKEN');
    expect(stdout).toContain('STABILITY_API_KEY');
    expect(stdout).toContain('FAL_KEY');
    expect(stdout).toContain('TOGETHER_API_KEY');
    expect(stdout).toContain('BFL_API_KEY');
    expect(stdout).toContain('GOOGLE_API_KEY');
    expect(stdout).toContain('FIREWORKS_API_KEY');
    expect(stdout).toContain('Ollama');
  });
});
