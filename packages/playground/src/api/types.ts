export type Provider =
  | 'openai' | 'replicate' | 'stability' | 'fal' | 'together'
  | 'bfl' | 'google' | 'fireworks' | 'ollama' | 'local';

export interface GenerateRequest {
  prompt: string;
  provider?: Provider;
  model?: string;
  size?: string;
  quality?: string;
  format?: string;
  compression?: number;
  background?: string;
  n?: number;
  negativePrompt?: string;
  guidanceScale?: number;
  steps?: number;
  seed?: number;
  stylePreset?: string;
}

export interface GenerateResponse {
  success: boolean;
  images: Array<{ url: string; filename: string }>;
  provider: string;
  model: string;
  elapsed: number;
  prompt: string;
  error?: string;
}

export interface ProviderInfo {
  label: string;
  models: Array<{ id: string; description: string; default?: boolean }>;
  configured: boolean;
  requiresKey: boolean;
  settings: string[];
}

export interface ModelsResponse {
  providers: Record<string, ProviderInfo>;
}
