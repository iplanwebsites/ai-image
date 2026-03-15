import { FastifyInstance } from 'fastify';

const ENV_VARS: Record<string, string> = {
  openai: 'OPENAI_API_KEY',
  replicate: 'REPLICATE_API_TOKEN',
  stability: 'STABILITY_API_KEY',
  fal: 'FAL_KEY',
  together: 'TOGETHER_API_KEY',
  bfl: 'BFL_API_KEY',
  google: 'GOOGLE_API_KEY',
  fireworks: 'FIREWORKS_API_KEY',
  ollama: '',
  local: '',
};

const MODELS: Record<string, Array<{ id: string; description: string; default?: boolean }>> = {
  openai: [
    { id: 'gpt-image-1', description: 'GPT Image 1', default: true },
    { id: 'dall-e-3', description: 'DALL-E 3' },
    { id: 'dall-e-2', description: 'DALL-E 2' },
  ],
  replicate: [
    { id: 'stability-ai/sdxl', description: 'Stable Diffusion XL', default: true },
    { id: 'black-forest-labs/flux-dev', description: 'Flux Dev' },
    { id: 'black-forest-labs/flux-schnell', description: 'Flux Schnell' },
    { id: 'stability-ai/stable-diffusion-3', description: 'SD 3' },
  ],
  stability: [
    { id: 'sd3.5-large', description: 'SD 3.5 Large', default: true },
    { id: 'sd3.5-large-turbo', description: 'SD 3.5 Large Turbo' },
    { id: 'sd3-medium', description: 'SD 3 Medium' },
  ],
  fal: [
    { id: 'fal-ai/flux/dev', description: 'Flux Dev', default: true },
    { id: 'fal-ai/flux/schnell', description: 'Flux Schnell' },
    { id: 'fal-ai/flux-pro/v1.1', description: 'Flux Pro v1.1' },
    { id: 'fal-ai/stable-diffusion-v3-medium', description: 'SD 3 Medium' },
  ],
  together: [
    { id: 'black-forest-labs/FLUX.1-schnell-Free', description: 'Flux Schnell Free', default: true },
    { id: 'black-forest-labs/FLUX.1-schnell', description: 'Flux Schnell' },
    { id: 'black-forest-labs/FLUX.1-dev', description: 'Flux Dev' },
    { id: 'stabilityai/stable-diffusion-xl-base-1.0', description: 'SDXL Base' },
  ],
  bfl: [
    { id: 'flux-pro-1.1', description: 'Flux Pro 1.1', default: true },
    { id: 'flux-pro', description: 'Flux Pro' },
    { id: 'flux-dev', description: 'Flux Dev' },
  ],
  google: [
    { id: 'imagen-4.0-generate-001', description: 'Imagen 4', default: true },
    { id: 'imagen-4.0-fast-generate-001', description: 'Imagen 4 Fast' },
    { id: 'imagen-4.0-ultra-generate-001', description: 'Imagen 4 Ultra' },
  ],
  fireworks: [
    { id: 'flux-1-schnell-fp8', description: 'Flux Schnell FP8', default: true },
  ],
  ollama: [
    { id: 'x/flux2-klein:4b', description: 'Flux 2 Klein 4B', default: true },
    { id: 'x/flux2-klein:9b', description: 'Flux 2 Klein 9B' },
    { id: 'x/z-image-turbo', description: 'Z-Image Turbo 6B' },
  ],
  local: [
    { id: 'flux2-klein-4b', description: 'FLUX.2 Klein 4B via MFLUX', default: true },
  ],
};

const PROVIDER_LABELS: Record<string, string> = {
  openai: 'OpenAI',
  replicate: 'Replicate',
  stability: 'Stability AI',
  fal: 'FAL.ai',
  together: 'Together AI',
  bfl: 'Black Forest Labs',
  google: 'Google Imagen',
  fireworks: 'Fireworks AI',
  ollama: 'Ollama',
  local: 'Local (MFLUX)',
};

// Which settings each provider supports
const PROVIDER_SETTINGS: Record<string, string[]> = {
  openai: ['size', 'quality', 'format', 'compression', 'background', 'n'],
  replicate: ['size', 'format', 'negativePrompt', 'guidanceScale', 'steps', 'seed', 'n'],
  stability: ['size', 'format', 'negativePrompt', 'guidanceScale', 'steps', 'seed', 'stylePreset', 'n'],
  fal: ['size', 'format', 'negativePrompt', 'guidanceScale', 'steps', 'seed', 'n'],
  together: ['size', 'format', 'negativePrompt', 'steps', 'seed', 'n'],
  bfl: ['size', 'format', 'guidanceScale', 'steps', 'seed', 'n'],
  google: ['size', 'format', 'negativePrompt', 'guidanceScale', 'seed', 'n'],
  fireworks: ['size', 'format', 'negativePrompt', 'guidanceScale', 'steps', 'seed', 'n'],
  ollama: ['format', 'n'],
  local: ['size', 'format', 'negativePrompt', 'guidanceScale', 'steps', 'seed', 'n'],
};

export async function modelsRoute(app: FastifyInstance) {
  app.get('/models', async () => {
    const providers: Record<string, {
      label: string;
      models: typeof MODELS[string];
      configured: boolean;
      requiresKey: boolean;
      settings: string[];
    }> = {};

    for (const [provider, models] of Object.entries(MODELS)) {
      const envVar = ENV_VARS[provider];
      const requiresKey = !!envVar;
      const configured = !requiresKey || !!process.env[envVar];

      providers[provider] = {
        label: PROVIDER_LABELS[provider] || provider,
        models,
        configured,
        requiresKey,
        settings: PROVIDER_SETTINGS[provider] || [],
      };
    }

    return { providers };
  });
}
