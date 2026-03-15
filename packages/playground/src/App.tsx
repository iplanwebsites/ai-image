import { GeneratePage } from './pages/generate.js';

export function App() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-6 py-3">
        <h1 className="text-lg font-semibold">AI Image Playground</h1>
      </header>
      <main className="p-6">
        <GeneratePage />
      </main>
    </div>
  );
}
