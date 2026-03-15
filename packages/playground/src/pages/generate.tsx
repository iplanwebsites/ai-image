import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  PromptForm,
  ProviderSelect,
  GenerationSettings,
  ImageGrid,
  GenerationStatus,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Separator,
} from '@ai-image/ui';
import { getModels, checkHealth } from '../api/client.js';
import { useGeneration } from '../hooks/use-generation.js';
import type { ProviderInfo } from '../api/types.js';

export function GeneratePage() {
  const [providers, setProviders] = useState<Record<string, ProviderInfo>>({});
  const [apiOnline, setApiOnline] = useState<boolean | null>(null);
  const gen = useGeneration();

  const currentProvider = providers[gen.provider];

  // Load providers on mount
  useEffect(() => {
    async function load() {
      const online = await checkHealth();
      setApiOnline(online);
      if (!online) {
        toast.error('API server is not running', {
          description: 'Start it with: cd packages/api && pnpm dev',
        });
        return;
      }

      try {
        const data = await getModels();
        setProviders(data.providers);
      } catch (err) {
        toast.error('Failed to load providers');
      }
    }
    load();
  }, []);

  const handleGenerate = async (prompt: string) => {
    try {
      const result = await gen.generate(prompt);
      toast.success('Image generated', {
        description: `${result.provider} / ${result.model} in ${(result.elapsed / 1000).toFixed(1)}s`,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Generation failed';
      toast.error('Generation failed', { description: msg });
    }
  };

  const handleProviderChange = (provider: string) => {
    gen.setProvider(provider, providers);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
      {/* Sidebar */}
      <div className="space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Prompt</CardTitle>
          </CardHeader>
          <CardContent>
            <PromptForm
              onSubmit={handleGenerate}
              isLoading={gen.status === 'generating'}
              disabled={apiOnline === false}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Provider</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ProviderSelect
              providers={providers}
              selectedProvider={gen.provider}
              selectedModel={gen.model}
              onProviderChange={handleProviderChange}
              onModelChange={gen.setModel}
              disabled={gen.status === 'generating'}
            />
            <Separator />
            <GenerationSettings
              settings={gen.settings}
              onChange={gen.setSettings}
              availableSettings={currentProvider?.settings || []}
              disabled={gen.status === 'generating'}
            />
          </CardContent>
        </Card>

        {apiOnline === false && (
          <Card className="border-destructive">
            <CardContent className="pt-6">
              <p className="text-sm text-destructive">
                API server offline. Start it with:
              </p>
              <code className="mt-2 block rounded bg-muted p-2 text-xs">
                cd packages/api && pnpm dev
              </code>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Results area */}
      <div className="space-y-4">
        {gen.status === 'generating' && gen.startedAt && (
          <GenerationStatus
            provider={currentProvider?.label || gen.provider}
            startedAt={gen.startedAt}
          />
        )}
        <ImageGrid results={gen.results} />
      </div>
    </div>
  );
}
