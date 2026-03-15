import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import path from 'path';
import fs from 'fs/promises';
import { generateRoute } from './routes/generate.js';
import { modelsRoute } from './routes/models.js';
import { healthRoute } from './routes/health.js';
import { clipRoute } from './routes/clip.js';

const PORT = parseInt(process.env.API_PORT || '4396');
const OUTPUT_DIR = path.resolve(process.env.OUTPUT_DIR || './output');

async function start() {
  // Ensure output directory exists
  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  const app = Fastify({ logger: true });

  await app.register(cors, { origin: true });

  await app.register(fastifyStatic, {
    root: OUTPUT_DIR,
    prefix: '/images/',
    decorateReply: false,
  });

  // Register routes
  app.register(generateRoute, { prefix: '/api', outputDir: OUTPUT_DIR });
  app.register(modelsRoute, { prefix: '/api' });
  app.register(healthRoute, { prefix: '/api' });
  app.register(clipRoute, { prefix: '/api' });

  try {
    await app.listen({ port: PORT, host: '0.0.0.0' });
    console.log(`API server listening on http://localhost:${PORT}`);
    console.log(`Serving generated images from ${OUTPUT_DIR}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
