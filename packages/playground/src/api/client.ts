import type {
  GenerateRequest, GenerateResponse, ModelsResponse,
  EmbedRequest, EmbedResponse,
  ClassifyRequest, ClassifyResponse,
  SearchRequest, SearchResponse,
} from './types.js';

async function fetchJSON<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const data = await res.json();

  if (!res.ok) {
    throw new Error((data as { error?: string }).error || `Request failed (${res.status})`);
  }

  return data as T;
}

export async function generateImage(params: GenerateRequest): Promise<GenerateResponse> {
  return fetchJSON<GenerateResponse>('/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
}

export async function getModels(): Promise<ModelsResponse> {
  return fetchJSON<ModelsResponse>('/api/models');
}

export async function checkHealth(): Promise<boolean> {
  try {
    const res = await fetch('/api/health');
    return res.ok;
  } catch {
    return false;
  }
}

// CLIP endpoints

export async function clipEmbed(params: EmbedRequest): Promise<EmbedResponse> {
  return fetchJSON<EmbedResponse>('/api/clip/embed', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
}

export async function clipClassify(params: ClassifyRequest): Promise<ClassifyResponse> {
  return fetchJSON<ClassifyResponse>('/api/clip/classify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
}

export async function clipSearch(params: SearchRequest): Promise<SearchResponse> {
  return fetchJSON<SearchResponse>('/api/clip/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
}
