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
  outputDir?: string;
}

export interface GenerateResponse {
  success: boolean;
  images: Array<{ url: string | null; filename: string; filePath: string }>;
  provider: string;
  model: string;
  elapsed: number;
  prompt: string;
  outputDir: string;
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

// CLIP types
export interface EmbedRequest {
  image_path?: string;
  text?: string;
}

export interface EmbedResponse {
  embedding: number[];
  elapsed: number;
}

export interface ClassifyRequest {
  image_path: string;
  labels: string[];
}

export interface ClassifyResponse {
  labels: Array<{ label: string; score: number }>;
  elapsed: number;
}

export interface SearchRequest {
  text: string;
  image_paths: string[];
  top_k?: number;
}

export interface SearchResponse {
  results: Array<{ path: string; score: number }>;
  query: string;
}
