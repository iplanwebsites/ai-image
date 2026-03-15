import { ImageCard } from './image-card.js';

interface GenerationResult {
  images: Array<{ url: string; filename: string }>;
  provider: string;
  model: string;
  elapsed: number;
  prompt: string;
}

interface ImageGridProps {
  results: GenerationResult[];
}

export function ImageGrid({ results }: ImageGridProps) {
  if (results.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
        Generated images will appear here
      </div>
    );
  }

  const allImages = results.flatMap((result) =>
    result.images.map((img) => ({
      ...img,
      provider: result.provider,
      model: result.model,
      elapsed: result.elapsed,
      prompt: result.prompt,
    }))
  );

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {allImages.map((img, i) => (
        <ImageCard key={`${img.url}-${i}`} {...img} />
      ))}
    </div>
  );
}
