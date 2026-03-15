#!/usr/bin/env python3
"""Minimal CLI to generate images locally using MFLUX on Apple Silicon."""

import argparse
import random
import sys
from pathlib import Path

MODELS = {
    "flux2-klein-4b": {
        "class": "mflux.models.flux2.Flux2Klein",
        "config": "flux2_klein_4b",
        "defaults": {"steps": 9, "width": 512, "height": 512},
    },
}


def load_model(name: str, quantize: int | None, lora_paths: list[str] | None, lora_scales: list[float] | None):
    spec = MODELS[name]
    module_path, class_name = spec["class"].rsplit(".", 1)

    import importlib
    mod = importlib.import_module(module_path)
    cls = getattr(mod, class_name)

    kwargs: dict = {"quantize": quantize, "lora_paths": lora_paths, "lora_scales": lora_scales}
    if "config" in spec:
        from mflux.models.common.config.model_config import ModelConfig
        kwargs["model_config"] = getattr(ModelConfig, spec["config"])()

    return cls(**kwargs)


def main():
    parser = argparse.ArgumentParser(
        description="Generate images locally with MFLUX (Apple Silicon)",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=f"Available models: {', '.join(MODELS)}",
    )
    parser.add_argument("prompt", help="Text prompt (use '-' to read from stdin)")
    parser.add_argument("-m", "--model", default="flux2-klein-4b", choices=MODELS, help="Model to use (default: flux2-klein-4b)")
    parser.add_argument("-o", "--output", default="output.png", help="Output path (default: output.png)")
    parser.add_argument("-W", "--width", type=int, default=None, help="Image width")
    parser.add_argument("-H", "--height", type=int, default=None, help="Image height")
    parser.add_argument("-s", "--steps", type=int, default=None, help="Inference steps")
    parser.add_argument("-q", "--quantize", type=int, choices=[4, 8], default=8, help="Quantization level (default: 8)")
    parser.add_argument("--seed", type=int, default=None, help="Random seed (default: random)")
    parser.add_argument("--guidance", type=float, default=None, help="Guidance scale")
    parser.add_argument("--negative-prompt", type=str, default=None, help="Negative prompt")
    parser.add_argument("--image-path", type=str, default=None, help="Input image for img2img")
    parser.add_argument("--image-strength", type=float, default=None, help="img2img strength (0-1)")
    parser.add_argument("--lora-paths", nargs="+", default=None, help="LoRA model paths (HuggingFace repo or local)")
    parser.add_argument("--lora-scales", nargs="+", type=float, default=None, help="LoRA weight scales")
    args = parser.parse_args()

    prompt = sys.stdin.read().strip() if args.prompt == "-" else args.prompt
    if not prompt:
        parser.error("prompt is required")

    defaults = MODELS[args.model]["defaults"]
    width = args.width or defaults["width"]
    height = args.height or defaults["height"]
    steps = args.steps or defaults["steps"]
    seed = args.seed if args.seed is not None else random.randint(0, 2**32 - 1)

    print(f"Model: {args.model} | q{args.quantize} | {width}x{height} | {steps} steps | seed {seed}")
    model = load_model(args.model, args.quantize, args.lora_paths, args.lora_scales)

    gen_kwargs: dict = {
        "prompt": prompt,
        "seed": seed,
        "num_inference_steps": steps,
        "width": width,
        "height": height,
    }
    if args.guidance is not None:
        gen_kwargs["guidance"] = args.guidance
    if args.negative_prompt is not None:
        gen_kwargs["negative_prompt"] = args.negative_prompt
    if args.image_path is not None:
        gen_kwargs["image_path"] = args.image_path
    if args.image_strength is not None:
        gen_kwargs["image_strength"] = args.image_strength

    result = model.generate_image(**gen_kwargs)

    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    result.save(str(output_path))
    print(f"Saved to {output_path}")


if __name__ == "__main__":
    main()
