import * as React from 'react';
import { Card } from './ui/card.js';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from './ui/dialog.js';
import { Button } from './ui/button.js';
import { Download, Maximize2, FileImage } from 'lucide-react';

interface ImageCardProps {
  url: string | null;
  filename: string;
  filePath: string;
  provider: string;
  model: string;
  elapsed: number;
  prompt: string;
}

export function ImageCard({ url, filename, filePath, provider, model, elapsed, prompt }: ImageCardProps) {
  const [showFullscreen, setShowFullscreen] = React.useState(false);

  // If no URL (saved to custom dir), show a file path card instead
  if (!url) {
    return (
      <Card className="overflow-hidden">
        <div className="flex items-center justify-center aspect-square bg-muted/30">
          <div className="text-center space-y-2 p-4">
            <FileImage className="h-10 w-10 text-muted-foreground mx-auto" />
            <p className="text-xs font-mono text-muted-foreground break-all">{filePath}</p>
          </div>
        </div>
        <div className="p-3 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              {provider} / {model}
            </span>
            <span className="text-xs text-muted-foreground">
              {(elapsed / 1000).toFixed(1)}s
            </span>
          </div>
          <p className="text-xs text-muted-foreground truncate">{prompt}</p>
        </div>
      </Card>
    );
  }

  return (
    <>
      <Card className="overflow-hidden group">
        <div className="relative aspect-square">
          <img
            src={url}
            alt={prompt}
            loading="lazy"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
            <Button
              variant="secondary"
              size="icon"
              onClick={() => setShowFullscreen(true)}
            >
              <Maximize2 className="h-4 w-4" />
            </Button>
            <Button variant="secondary" size="icon" asChild>
              <a href={url} download={filename}>
                <Download className="h-4 w-4" />
              </a>
            </Button>
          </div>
        </div>
        <div className="p-3 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              {provider} / {model}
            </span>
            <span className="text-xs text-muted-foreground">
              {(elapsed / 1000).toFixed(1)}s
            </span>
          </div>
          <p className="text-xs text-muted-foreground truncate">{prompt}</p>
        </div>
      </Card>

      <Dialog open={showFullscreen} onOpenChange={setShowFullscreen}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden">
          <DialogTitle className="sr-only">Generated Image</DialogTitle>
          <DialogDescription className="sr-only">{prompt}</DialogDescription>
          <img src={url} alt={prompt} className="w-full h-auto" />
        </DialogContent>
      </Dialog>
    </>
  );
}
