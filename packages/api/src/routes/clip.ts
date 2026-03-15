import { FastifyInstance } from 'fastify';

const CLIP_SERVER = process.env.CLIP_SERVER_URL || 'http://localhost:8506';

interface EmbedBody {
  image_path?: string;
  text?: string;
}

interface ClassifyBody {
  image_path: string;
  labels: string[];
}

interface SearchBody {
  text: string;
  image_paths: string[];
  top_k?: number;
}

export async function clipRoute(app: FastifyInstance) {
  // Proxy embed request to Python server
  app.post<{ Body: EmbedBody }>('/clip/embed', {
    schema: {
      body: {
        type: 'object',
        properties: {
          image_path: { type: 'string' },
          text: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const body = request.body;
    if (!body.image_path && !body.text) {
      return reply.status(400).send({ error: 'image_path or text is required' });
    }

    try {
      const res = await fetch(`${CLIP_SERVER}/embed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json() as { error?: string };
        return reply.status(res.status).send({ error: err.error || 'CLIP server error' });
      }

      const data = await res.json();
      return reply.send(data);
    } catch {
      return reply.status(503).send({
        error: 'CLIP server unavailable. Start the Python server: cd packages/server && ai-image-server',
      });
    }
  });

  // Proxy classify request to Python server
  app.post<{ Body: ClassifyBody }>('/clip/classify', {
    schema: {
      body: {
        type: 'object',
        required: ['image_path', 'labels'],
        properties: {
          image_path: { type: 'string' },
          labels: { type: 'array', items: { type: 'string' } },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const res = await fetch(`${CLIP_SERVER}/classify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request.body),
      });

      if (!res.ok) {
        const err = await res.json() as { error?: string };
        return reply.status(res.status).send({ error: err.error || 'CLIP server error' });
      }

      const data = await res.json();
      return reply.send(data);
    } catch {
      return reply.status(503).send({
        error: 'CLIP server unavailable. Start the Python server: cd packages/server && ai-image-server',
      });
    }
  });

  // Search: embed text, then embed each image, return ranked by similarity
  app.post<{ Body: SearchBody }>('/clip/search', {
    schema: {
      body: {
        type: 'object',
        required: ['text', 'image_paths'],
        properties: {
          text: { type: 'string', minLength: 1 },
          image_paths: { type: 'array', items: { type: 'string' } },
          top_k: { type: 'number', minimum: 1 },
        },
      },
    },
  }, async (request, reply) => {
    const { text, image_paths, top_k } = request.body;

    try {
      // Get text embedding
      const textRes = await fetch(`${CLIP_SERVER}/embed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      if (!textRes.ok) {
        const err = await textRes.json() as { error?: string };
        return reply.status(textRes.status).send({ error: err.error || 'Failed to embed text' });
      }
      const textData = await textRes.json() as { embedding: number[] };
      const textEmb = textData.embedding;

      // Get image embeddings in parallel
      const imageResults = await Promise.allSettled(
        image_paths.map(async (imagePath) => {
          const res = await fetch(`${CLIP_SERVER}/embed`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image_path: imagePath }),
          });
          if (!res.ok) return null;
          const data = await res.json() as { embedding: number[] };
          return { path: imagePath, embedding: data.embedding };
        })
      );

      // Compute cosine similarity and rank
      const results: Array<{ path: string; score: number }> = [];
      for (const r of imageResults) {
        if (r.status === 'fulfilled' && r.value) {
          const sim = cosineSimilarity(textEmb, r.value.embedding);
          results.push({ path: r.value.path, score: Math.round(sim * 10000) / 10000 });
        }
      }

      results.sort((a, b) => b.score - a.score);
      const limited = top_k ? results.slice(0, top_k) : results;

      return reply.send({ results: limited, query: text });
    } catch {
      return reply.status(503).send({
        error: 'CLIP server unavailable',
      });
    }
  });
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
