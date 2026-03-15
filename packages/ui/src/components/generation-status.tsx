import * as React from 'react';
import { Loader2 } from 'lucide-react';

interface GenerationStatusProps {
  provider: string;
  startedAt: number;
}

export function GenerationStatus({ provider, startedAt }: GenerationStatusProps) {
  const [elapsed, setElapsed] = React.useState(0);

  React.useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Date.now() - startedAt);
    }, 100);
    return () => clearInterval(interval);
  }, [startedAt]);

  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-4">
      <Loader2 className="h-5 w-5 animate-spin text-primary" />
      <div>
        <p className="text-sm font-medium">
          Generating via {provider}...
        </p>
        <p className="text-xs text-muted-foreground">
          {(elapsed / 1000).toFixed(1)}s elapsed
        </p>
      </div>
    </div>
  );
}
