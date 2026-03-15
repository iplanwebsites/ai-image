import * as React from 'react';
import * as Collapsible from '@radix-ui/react-collapsible';
import { Label } from './ui/label.js';
import { Input } from './ui/input.js';
import { Textarea } from './ui/textarea.js';
import { Button } from './ui/button.js';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select.js';
import { ChevronDown, Settings } from 'lucide-react';

export interface GenerationSettingsValues {
  size: string;
  quality: string;
  format: string;
  compression?: number;
  background?: string;
  negativePrompt?: string;
  guidanceScale?: number;
  steps?: number;
  seed?: number;
  n: number;
  stylePreset?: string;
}

interface GenerationSettingsProps {
  settings: GenerationSettingsValues;
  onChange: (settings: GenerationSettingsValues) => void;
  availableSettings: string[];
  disabled?: boolean;
}

const SIZE_PRESETS = [
  '512x512',
  '768x768',
  '1024x1024',
  '1024x1536',
  '1536x1024',
  '1024x1792',
  '1792x1024',
];

export function GenerationSettings({
  settings,
  onChange,
  availableSettings,
  disabled,
}: GenerationSettingsProps) {
  const [open, setOpen] = React.useState(false);
  const has = (key: string) => availableSettings.includes(key);

  const update = (partial: Partial<GenerationSettingsValues>) => {
    onChange({ ...settings, ...partial });
  };

  return (
    <Collapsible.Root open={open} onOpenChange={setOpen}>
      <Collapsible.Trigger asChild>
        <Button variant="ghost" size="sm" className="w-full justify-between">
          <span className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Settings
          </span>
          <ChevronDown
            className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`}
          />
        </Button>
      </Collapsible.Trigger>

      <Collapsible.Content className="mt-3 space-y-3">
        {has('size') && (
          <div className="space-y-1.5">
            <Label>Size</Label>
            <Select value={settings.size} onValueChange={(v) => update({ size: v })} disabled={disabled}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SIZE_PRESETS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {has('quality') && (
          <div className="space-y-1.5">
            <Label>Quality</Label>
            <Select value={settings.quality} onValueChange={(v) => update({ quality: v })} disabled={disabled}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {['auto', 'low', 'medium', 'high'].map((q) => (
                  <SelectItem key={q} value={q}>
                    {q.charAt(0).toUpperCase() + q.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {has('format') && (
          <div className="space-y-1.5">
            <Label>Format</Label>
            <Select value={settings.format} onValueChange={(v) => update({ format: v })} disabled={disabled}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {['png', 'jpeg', 'webp'].map((f) => (
                  <SelectItem key={f} value={f}>
                    {f.toUpperCase()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {has('background') && (
          <div className="space-y-1.5">
            <Label>Background</Label>
            <Select
              value={settings.background || 'opaque'}
              onValueChange={(v) => update({ background: v })}
              disabled={disabled}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="opaque">Opaque</SelectItem>
                <SelectItem value="transparent">Transparent</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {has('negativePrompt') && (
          <div className="space-y-1.5">
            <Label>Negative Prompt</Label>
            <Textarea
              placeholder="What to avoid..."
              value={settings.negativePrompt || ''}
              onChange={(e) => update({ negativePrompt: e.target.value || undefined })}
              rows={2}
              className="resize-none"
              disabled={disabled}
            />
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          {has('guidanceScale') && (
            <div className="space-y-1.5">
              <Label>Guidance Scale</Label>
              <Input
                type="number"
                min={1}
                max={30}
                step={0.5}
                value={settings.guidanceScale ?? ''}
                onChange={(e) =>
                  update({ guidanceScale: e.target.value ? parseFloat(e.target.value) : undefined })
                }
                placeholder="7.5"
                disabled={disabled}
              />
            </div>
          )}

          {has('steps') && (
            <div className="space-y-1.5">
              <Label>Steps</Label>
              <Input
                type="number"
                min={1}
                max={150}
                value={settings.steps ?? ''}
                onChange={(e) =>
                  update({ steps: e.target.value ? parseInt(e.target.value) : undefined })
                }
                placeholder="30"
                disabled={disabled}
              />
            </div>
          )}

          {has('seed') && (
            <div className="space-y-1.5">
              <Label>Seed</Label>
              <Input
                type="number"
                value={settings.seed ?? ''}
                onChange={(e) =>
                  update({ seed: e.target.value ? parseInt(e.target.value) : undefined })
                }
                placeholder="Random"
                disabled={disabled}
              />
            </div>
          )}

          {has('n') && (
            <div className="space-y-1.5">
              <Label>Count</Label>
              <Input
                type="number"
                min={1}
                max={10}
                value={settings.n}
                onChange={(e) => update({ n: parseInt(e.target.value) || 1 })}
                disabled={disabled}
              />
            </div>
          )}
        </div>

        {has('stylePreset') && (
          <div className="space-y-1.5">
            <Label>Style Preset</Label>
            <Input
              value={settings.stylePreset || ''}
              onChange={(e) => update({ stylePreset: e.target.value || undefined })}
              placeholder="e.g. photographic, anime..."
              disabled={disabled}
            />
          </div>
        )}
      </Collapsible.Content>
    </Collapsible.Root>
  );
}
