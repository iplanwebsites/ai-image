import * as React from 'react';
import { Button } from './ui/button.js';
import { Input } from './ui/input.js';
import { Textarea } from './ui/textarea.js';
import { Label } from './ui/label.js';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card.js';
import { Separator } from './ui/separator.js';
import { Loader2, Search, Eye, Tag } from 'lucide-react';

// ─── Embedding Viewer ──────────────────────────────────────────────

interface EmbeddingViewerProps {
  onEmbed: (params: { image_path?: string; text?: string }) => Promise<{
    embedding: number[];
    elapsed: number;
  }>;
}

export function EmbeddingViewer({ onEmbed }: EmbeddingViewerProps) {
  const [input, setInput] = React.useState('');
  const [mode, setMode] = React.useState<'image' | 'text'>('text');
  const [embedding, setEmbedding] = React.useState<number[] | null>(null);
  const [elapsed, setElapsed] = React.useState<number | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleEmbed = async () => {
    if (!input.trim()) return;
    setLoading(true);
    setError(null);
    setEmbedding(null);

    try {
      const params = mode === 'image' ? { image_path: input } : { text: input };
      const result = await onEmbed(params);
      setEmbedding(result.embedding);
      setElapsed(result.elapsed);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to embed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Button
          variant={mode === 'text' ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => setMode('text')}
        >
          Text
        </Button>
        <Button
          variant={mode === 'image' ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => setMode('image')}
        >
          Image Path
        </Button>
      </div>

      <Input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder={mode === 'text' ? 'Enter text to embed...' : '/path/to/image.png'}
        className={mode === 'image' ? 'font-mono text-xs' : ''}
        onKeyDown={(e) => e.key === 'Enter' && handleEmbed()}
      />

      <Button onClick={handleEmbed} disabled={!input.trim() || loading} size="sm" className="w-full">
        {loading ? <Loader2 className="animate-spin" /> : <Eye className="h-4 w-4" />}
        {loading ? 'Embedding...' : 'Get Embedding'}
      </Button>

      {error && <p className="text-xs text-destructive">{error}</p>}

      {embedding && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{embedding.length} dimensions</span>
            {elapsed != null && <span>{(elapsed * 1000).toFixed(0)}ms</span>}
          </div>
          <EmbeddingViz values={embedding} />
          <details className="text-xs">
            <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
              Raw values
            </summary>
            <pre className="mt-1 max-h-32 overflow-auto rounded bg-muted p-2 text-[10px]">
              [{embedding.slice(0, 20).map((v) => v.toFixed(4)).join(', ')}
              {embedding.length > 20 ? `, ... (${embedding.length - 20} more)` : ''}]
            </pre>
          </details>
        </div>
      )}
    </div>
  );
}

function EmbeddingViz({ values }: { values: number[] }) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  // Sample ~100 values evenly for visualization
  const step = Math.max(1, Math.floor(values.length / 100));
  const sampled = values.filter((_, i) => i % step === 0);

  return (
    <div className="flex items-end gap-px h-12 rounded bg-muted/50 p-1">
      {sampled.map((v, i) => {
        const normalized = (v - min) / range;
        const hue = normalized > 0.5 ? 200 : 0;
        const lightness = 30 + normalized * 40;
        return (
          <div
            key={i}
            className="flex-1 rounded-sm min-w-px"
            style={{
              height: `${Math.max(2, normalized * 100)}%`,
              backgroundColor: `hsl(${hue}, 70%, ${lightness}%)`,
            }}
          />
        );
      })}
    </div>
  );
}

// ─── Classify Panel ─────────────────────────────────────────────────

interface ClassifyPanelProps {
  onClassify: (params: { image_path: string; labels: string[] }) => Promise<{
    labels: Array<{ label: string; score: number }>;
    elapsed: number;
  }>;
  defaultImagePath?: string;
}

export function ClassifyPanel({ onClassify, defaultImagePath }: ClassifyPanelProps) {
  const [imagePath, setImagePath] = React.useState(defaultImagePath || '');
  const [labelsText, setLabelsText] = React.useState('');
  const [results, setResults] = React.useState<Array<{ label: string; score: number }> | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleClassify = async () => {
    const labels = labelsText.split(',').map((l) => l.trim()).filter(Boolean);
    if (!imagePath.trim() || labels.length === 0) return;

    setLoading(true);
    setError(null);
    setResults(null);

    try {
      const result = await onClassify({ image_path: imagePath, labels });
      setResults(result.labels);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Classification failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label>Image Path</Label>
        <Input
          value={imagePath}
          onChange={(e) => setImagePath(e.target.value)}
          placeholder="/path/to/image.png"
          className="font-mono text-xs"
        />
      </div>

      <div className="space-y-1.5">
        <Label>Labels (comma-separated)</Label>
        <Textarea
          value={labelsText}
          onChange={(e) => setLabelsText(e.target.value)}
          placeholder="cat, dog, bird, car, landscape..."
          rows={2}
          className="resize-none"
        />
      </div>

      <Button onClick={handleClassify} disabled={!imagePath.trim() || !labelsText.trim() || loading} size="sm" className="w-full">
        {loading ? <Loader2 className="animate-spin" /> : <Tag className="h-4 w-4" />}
        {loading ? 'Classifying...' : 'Classify'}
      </Button>

      {error && <p className="text-xs text-destructive">{error}</p>}

      {results && (
        <div className="space-y-1">
          {results.map((r) => (
            <div key={r.label} className="flex items-center gap-2">
              <div className="flex-1 h-5 rounded bg-muted overflow-hidden">
                <div
                  className="h-full bg-primary/60 rounded"
                  style={{ width: `${r.score * 100}%` }}
                />
              </div>
              <span className="text-xs w-24 truncate">{r.label}</span>
              <span className="text-xs text-muted-foreground w-12 text-right">
                {(r.score * 100).toFixed(1)}%
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Search Panel ───────────────────────────────────────────────────

interface SearchPanelProps {
  onSearch: (params: { text: string; image_paths: string[]; top_k?: number }) => Promise<{
    results: Array<{ path: string; score: number }>;
    query: string;
  }>;
  imagePaths: string[];
}

export function SearchPanel({ onSearch, imagePaths }: SearchPanelProps) {
  const [query, setQuery] = React.useState('');
  const [results, setResults] = React.useState<Array<{ path: string; score: number }> | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleSearch = async () => {
    if (!query.trim() || imagePaths.length === 0) return;

    setLoading(true);
    setError(null);
    setResults(null);

    try {
      const result = await onSearch({ text: query, image_paths: imagePaths, top_k: 10 });
      setResults(result.results);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search generated images by text..."
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          className="flex-1"
        />
        <Button onClick={handleSearch} disabled={!query.trim() || imagePaths.length === 0 || loading} size="icon">
          {loading ? <Loader2 className="animate-spin" /> : <Search className="h-4 w-4" />}
        </Button>
      </div>

      {imagePaths.length === 0 && (
        <p className="text-xs text-muted-foreground">Generate some images first to search them</p>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}

      {results && (
        <div className="space-y-1">
          {results.map((r) => (
            <div key={r.path} className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground w-12 text-right shrink-0">
                {(r.score * 100).toFixed(1)}%
              </span>
              <span className="truncate font-mono">{r.path.split('/').pop()}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Combined CLIP Panel ────────────────────────────────────────────

interface ClipPanelProps {
  onEmbed: EmbeddingViewerProps['onEmbed'];
  onClassify: ClassifyPanelProps['onClassify'];
  onSearch: SearchPanelProps['onSearch'];
  imagePaths: string[];
}

export function ClipPanel({ onEmbed, onClassify, onSearch, imagePaths }: ClipPanelProps) {
  const [tab, setTab] = React.useState<'embed' | 'classify' | 'search'>('search');

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">CLIP</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-1">
          <Button
            variant={tab === 'search' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setTab('search')}
          >
            <Search className="h-3.5 w-3.5" />
            Search
          </Button>
          <Button
            variant={tab === 'embed' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setTab('embed')}
          >
            <Eye className="h-3.5 w-3.5" />
            Embed
          </Button>
          <Button
            variant={tab === 'classify' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setTab('classify')}
          >
            <Tag className="h-3.5 w-3.5" />
            Classify
          </Button>
        </div>

        <Separator />

        {tab === 'search' && <SearchPanel onSearch={onSearch} imagePaths={imagePaths} />}
        {tab === 'embed' && <EmbeddingViewer onEmbed={onEmbed} />}
        {tab === 'classify' && <ClassifyPanel onClassify={onClassify} />}
      </CardContent>
    </Card>
  );
}
