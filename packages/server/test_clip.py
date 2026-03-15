#!/usr/bin/env python3
"""Test CLIP embedding and classification, save results to JSON files."""

import json
import sys
import time

sys.path.insert(0, "/Users/felix/.ai-image/server")

from ai_image_server.clip_model import classify_image, embed_image, embed_text

# Test images
IMAGES = [
    "/Users/felix/web/git/ai-image/ai-image/A_futuristic_robot_in_a_garden_with_a_pizza 4.png",
    "/Users/felix/web/git/ai-image/ai-image/A_mischievous_raccoon_cooking_rendang_beef_(indonesian_recipe),_closeup,_realistic_artsy_disorted_stylish_magazine_photo,_shot_of_cooking_raccoon,_raccoon_is_cute,_adding_lemongrass_(chopped)_and_gril_1.png",
]

LABELS = ["robot", "raccoon", "pizza", "garden", "cooking", "animal", "food", "technology"]

results = {}

# --- Embeddings ---
print("=== Image Embeddings ===")
for img in IMAGES:
    name = img.rsplit("/", 1)[-1]
    print(f"\nEmbedding: {name[:60]}...")
    start = time.time()
    emb = embed_image(img)
    elapsed = time.time() - start
    print(f"  dims={len(emb)}, elapsed={elapsed:.3f}s")
    results[f"image_embed_{name[:40]}"] = {
        "type": "image_embedding",
        "image": name,
        "embedding": emb,
        "dims": len(emb),
        "elapsed": round(elapsed, 3),
    }

print("\n=== Text Embeddings ===")
for label in LABELS:
    start = time.time()
    emb = embed_text(label)
    elapsed = time.time() - start
    print(f"  '{label}': dims={len(emb)}, elapsed={elapsed:.3f}s")
    results[f"text_embed_{label}"] = {
        "type": "text_embedding",
        "text": label,
        "embedding": emb,
        "dims": len(emb),
        "elapsed": round(elapsed, 3),
    }

# --- Classification ---
print("\n=== Classification ===")
for img in IMAGES:
    name = img.rsplit("/", 1)[-1]
    print(f"\nClassifying: {name[:60]}...")
    start = time.time()
    scores = classify_image(img, LABELS)
    elapsed = time.time() - start
    print(f"  elapsed={elapsed:.3f}s")
    for s in scores:
        print(f"    {s['label']:>12s}: {s['score']:.4f}")
    results[f"classify_{name[:40]}"] = {
        "type": "classification",
        "image": name,
        "labels": scores,
        "elapsed": round(elapsed, 3),
    }

# --- Save ---
out_path = "/Users/felix/web/git/ai-image/ai-image/packages/server/test_clip_results.json"
with open(out_path, "w") as f:
    json.dump(results, f, indent=2)
print(f"\nResults saved to {out_path}")
