import { useReducer, useCallback, useEffect, useMemo } from 'react';
import { generateImage } from '../api/client.js';
import type { GenerateResponse, Provider, ProviderInfo } from '../api/types.js';
import type { GenerationSettingsValues } from '@ai-image/ui';

interface GenerationResult {
  images: Array<{ url: string | null; filename: string; filePath: string }>;
  provider: string;
  model: string;
  elapsed: number;
  prompt: string;
}

interface State {
  status: 'idle' | 'generating' | 'success' | 'error';
  provider: string;
  model: string;
  settings: GenerationSettingsValues;
  outputDir: string;
  results: GenerationResult[];
  error: string | null;
  startedAt: number | null;
}

type Action =
  | { type: 'SET_PROVIDER'; provider: string; model: string }
  | { type: 'SET_MODEL'; model: string }
  | { type: 'SET_SETTINGS'; settings: GenerationSettingsValues }
  | { type: 'SET_OUTPUT_DIR'; outputDir: string }
  | { type: 'GENERATE_START' }
  | { type: 'GENERATE_SUCCESS'; result: GenerationResult }
  | { type: 'GENERATE_ERROR'; error: string };

const STORAGE_KEY = 'ai-image-playground-state';

function loadPersistedState(): Partial<State> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        provider: parsed.provider,
        model: parsed.model,
        settings: parsed.settings,
        outputDir: parsed.outputDir,
      };
    }
  } catch {}
  return {};
}

function persistState(state: State) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        provider: state.provider,
        model: state.model,
        settings: state.settings,
        outputDir: state.outputDir,
      })
    );
  } catch {}
}

const DEFAULT_SETTINGS: GenerationSettingsValues = {
  size: '1024x1024',
  quality: 'auto',
  format: 'png',
  n: 1,
};

function getInitialState(): State {
  const persisted = loadPersistedState();
  return {
    status: 'idle',
    provider: persisted.provider || 'openai',
    model: persisted.model || 'gpt-image-1',
    settings: persisted.settings || DEFAULT_SETTINGS,
    outputDir: persisted.outputDir || '',
    results: [],
    error: null,
    startedAt: null,
  };
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'SET_PROVIDER':
      return { ...state, provider: action.provider, model: action.model };
    case 'SET_MODEL':
      return { ...state, model: action.model };
    case 'SET_SETTINGS':
      return { ...state, settings: action.settings };
    case 'SET_OUTPUT_DIR':
      return { ...state, outputDir: action.outputDir };
    case 'GENERATE_START':
      return { ...state, status: 'generating', error: null, startedAt: Date.now() };
    case 'GENERATE_SUCCESS':
      return {
        ...state,
        status: 'success',
        results: [action.result, ...state.results],
        startedAt: null,
      };
    case 'GENERATE_ERROR':
      return { ...state, status: 'error', error: action.error, startedAt: null };
    default:
      return state;
  }
}

export function useGeneration() {
  const [state, dispatch] = useReducer(reducer, undefined, getInitialState);

  // Persist provider/model/settings changes
  useEffect(() => {
    persistState(state);
  }, [state.provider, state.model, state.settings, state.outputDir]);

  const generate = useCallback(
    async (prompt: string) => {
      dispatch({ type: 'GENERATE_START' });

      try {
        const response: GenerateResponse = await generateImage({
          prompt,
          provider: state.provider as Provider,
          model: state.model,
          size: state.settings.size,
          quality: state.settings.quality,
          format: state.settings.format,
          compression: state.settings.compression,
          background: state.settings.background,
          n: state.settings.n,
          negativePrompt: state.settings.negativePrompt,
          guidanceScale: state.settings.guidanceScale,
          steps: state.settings.steps,
          seed: state.settings.seed,
          stylePreset: state.settings.stylePreset,
          outputDir: state.outputDir || undefined,
        });

        if (!response.success) {
          throw new Error(response.error || 'Generation failed');
        }

        dispatch({
          type: 'GENERATE_SUCCESS',
          result: {
            images: response.images,
            provider: response.provider,
            model: response.model,
            elapsed: response.elapsed,
            prompt: response.prompt,
          },
        });

        return response;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        dispatch({ type: 'GENERATE_ERROR', error: msg });
        throw err;
      }
    },
    [state.provider, state.model, state.settings]
  );

  const setProvider = useCallback(
    (provider: string, providers: Record<string, ProviderInfo>) => {
      const info = providers[provider];
      const defaultModel = info?.models.find((m) => m.default)?.id || info?.models[0]?.id || '';
      dispatch({ type: 'SET_PROVIDER', provider, model: defaultModel });
    },
    []
  );

  const setModel = useCallback((model: string) => {
    dispatch({ type: 'SET_MODEL', model });
  }, []);

  const setSettings = useCallback((settings: GenerationSettingsValues) => {
    dispatch({ type: 'SET_SETTINGS', settings });
  }, []);

  const setOutputDir = useCallback((outputDir: string) => {
    dispatch({ type: 'SET_OUTPUT_DIR', outputDir });
  }, []);

  // Collect all file paths from results for CLIP search
  const allImagePaths = useMemo(
    () => state.results.flatMap((r) => r.images.map((img) => img.filePath)),
    [state.results]
  );

  return {
    ...state,
    generate,
    setProvider,
    setModel,
    setSettings,
    setOutputDir,
    allImagePaths,
  };
}
