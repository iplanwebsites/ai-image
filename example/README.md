# ai-image example

Generate images locally with CLIP metadata sidecar files.

## Run

```bash
node example/generate.mjs
```

This will:
1. Generate 3 images using the local MFLUX provider (Apple Silicon)
2. Write `.metadata.json` files with generation params, CLIP embeddings, and classification scores
3. Print a CLIP similarity matrix between the generated images

## Output

```
example/output/
  A_tiny_robot_watering_flowers_in_a_sunlit_garden.png
  A_tiny_robot_watering_flowers_in_a_sunlit_garden.metadata.json
  A_raccoon_chef_cooking_pasta_in_a_rustic_kitchen.png
  A_raccoon_chef_cooking_pasta_in_a_rustic_kitchen.metadata.json
  An_astronaut_floating_above_Earth,_holding_a_coffee_cup.png
  An_astronaut_floating_above_Earth,_holding_a_coffee_cup.metadata.json
```

Each `.metadata.json` contains:
- Generation parameters (prompt, model, seed, size, elapsed time)
- 512-dim CLIP embedding vector
- Zero-shot classification scores against the specified labels

## Requirements

- macOS with Apple Silicon
- Python 3.11+ (for the local server)
- First run downloads ~8 GB model weights (cached for future runs)
