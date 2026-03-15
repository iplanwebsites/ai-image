import * as React from 'react';
import { Textarea } from './ui/textarea.js';
import { Button } from './ui/button.js';
import { Loader2, Sparkles } from 'lucide-react';

interface PromptFormProps {
  onSubmit: (prompt: string) => void;
  isLoading?: boolean;
  disabled?: boolean;
}

export function PromptForm({ onSubmit, isLoading, disabled }: PromptFormProps) {
  const [prompt, setPrompt] = React.useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (prompt.trim() && !isLoading) {
      onSubmit(prompt.trim());
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      if (prompt.trim() && !isLoading) {
        onSubmit(prompt.trim());
      }
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <Textarea
        placeholder="Describe the image you want to generate..."
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        onKeyDown={handleKeyDown}
        rows={3}
        className="resize-none"
        disabled={isLoading || disabled}
      />
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {prompt.length > 0 ? `${prompt.length} chars` : 'Cmd+Enter to submit'}
        </span>
        <Button type="submit" disabled={!prompt.trim() || isLoading || disabled}>
          {isLoading ? (
            <>
              <Loader2 className="animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Sparkles />
              Generate
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
