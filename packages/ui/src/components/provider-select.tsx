import * as React from 'react';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
  SelectSeparator,
} from './ui/select.js';
import { Label } from './ui/label.js';
import { Lock } from 'lucide-react';

interface ProviderInfo {
  label: string;
  models: Array<{ id: string; description: string; default?: boolean }>;
  configured: boolean;
  requiresKey: boolean;
  settings: string[];
}

interface ProviderSelectProps {
  providers: Record<string, ProviderInfo>;
  selectedProvider: string;
  selectedModel: string;
  onProviderChange: (provider: string) => void;
  onModelChange: (model: string) => void;
  disabled?: boolean;
}

export function ProviderSelect({
  providers,
  selectedProvider,
  selectedModel,
  onProviderChange,
  onModelChange,
  disabled,
}: ProviderSelectProps) {
  const currentProvider = providers[selectedProvider];
  const cloudProviders = Object.entries(providers).filter(
    ([key]) => !['ollama', 'local'].includes(key)
  );
  const localProviders = Object.entries(providers).filter(
    ([key]) => ['ollama', 'local'].includes(key)
  );

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label>Provider</Label>
        <Select value={selectedProvider} onValueChange={onProviderChange} disabled={disabled}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectLabel>Cloud</SelectLabel>
              {cloudProviders.map(([key, info]) => (
                <SelectItem key={key} value={key} disabled={!info.configured}>
                  <span className="flex items-center gap-2">
                    {info.label}
                    {!info.configured && <Lock className="h-3 w-3 text-muted-foreground" />}
                  </span>
                </SelectItem>
              ))}
            </SelectGroup>
            <SelectSeparator />
            <SelectGroup>
              <SelectLabel>Local</SelectLabel>
              {localProviders.map(([key, info]) => (
                <SelectItem key={key} value={key}>
                  {info.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>

      {currentProvider && (
        <div className="space-y-1.5">
          <Label>Model</Label>
          <Select value={selectedModel} onValueChange={onModelChange} disabled={disabled}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {currentProvider.models.map((model) => (
                <SelectItem key={model.id} value={model.id}>
                  {model.description}
                  {model.default && (
                    <span className="ml-1 text-xs text-muted-foreground">(default)</span>
                  )}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}
