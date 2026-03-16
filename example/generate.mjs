#!/usr/bin/env node
/**
 * Example: Generate images locally with CLIP metadata.
 *
 * Usage:
 *   node example/generate.mjs
 *
 * This generates a few images using the local MFLUX provider (Apple Silicon),
 * writes .metadata.json sidecar files with CLIP embeddings and classification,
 * then prints a similarity matrix between the generated images.
 *
 * Requirements:
 *   - macOS with Apple Silicon
 *   - Python 3.11+
 *   - The local server auto-installs on first run (~8 GB model download)
 */

import { ImageGenerator } from "../packages/ai-image/dist/index.js";
import fs from "fs/promises";
import path from "path";

const OUTPUT_DIR = path.join(import.meta.dirname, "output");

const PROMPTS = [
  {
    prompt: "A tiny robot watering flowers in a sunlit garden",
    labels: ["robot", "garden", "flowers", "technology", "nature", "animal"],
  },
  {
    prompt: "A raccoon chef cooking pasta in a rustic kitchen",
    labels: ["raccoon", "cooking", "kitchen", "food", "animal", "nature"],
  },
  {
    prompt: "An astronaut floating above Earth, holding a coffee cup",
    labels: ["astronaut", "space", "earth", "coffee", "technology", "nature"],
  },
];

async function main() {
  const gen = new ImageGenerator({
    provider: "local",
    outputDir: OUTPUT_DIR,
  });

  console.log(`Generating ${PROMPTS.length} images to ${OUTPUT_DIR}/\n`);

  const results = [];

  for (const { prompt, labels } of PROMPTS) {
    console.log(`Prompt: "${prompt}"`);

    const result = await gen.generate({
      prompt,
      size: "512x512",
      metadata: true,
      metadataLabels: labels,
    });

    const imagePath = result.filePaths[0];
    const metaPath = imagePath.replace(/\.[^.]+$/, ".metadata.json");
    const meta = JSON.parse(await fs.readFile(metaPath, "utf-8"));

    console.log(`  Image: ${path.basename(imagePath)}`);
    console.log(`  Time:  ${(result.elapsed / 1000).toFixed(1)}s`);
    if (meta.clip?.labels) {
      const top3 = meta.clip.labels.slice(0, 3);
      console.log(
        `  CLIP:  ${top3.map((l) => `${l.label} ${(l.score * 100).toFixed(1)}%`).join(", ")}`
      );
    }
    console.log();

    results.push({ prompt, imagePath, meta });
  }

  // Print similarity matrix using CLIP embeddings
  console.log("CLIP Similarity Matrix:");
  console.log("─".repeat(60));

  const embeddings = results.map((r) => r.meta.clip?.embedding).filter(Boolean);
  if (embeddings.length === results.length) {
    const dot = (a, b) => a.reduce((sum, v, i) => sum + v * b[i], 0);

    // Header
    const shortNames = results.map((r) => r.prompt.split(" ").slice(1, 3).join(" "));
    console.log("".padEnd(20) + shortNames.map((n) => n.padStart(16)).join(""));

    for (let i = 0; i < results.length; i++) {
      const row = shortNames[i].padEnd(20);
      const scores = results
        .map((_, j) => dot(embeddings[i], embeddings[j]).toFixed(3).padStart(16))
        .join("");
      console.log(row + scores);
    }
  }

  console.log("\nDone! Check the output/ directory for images and .metadata.json files.");
}

main().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
