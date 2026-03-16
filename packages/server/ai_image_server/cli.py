#!/usr/bin/env python3
"""Minimal CLI to generate images locally using MFLUX on Apple Silicon."""
from __future__ import annotations

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
    "flux2-klein-9b": {
        "class": "mflux.models.flux2.Flux2Klein",
        "config": "flux2_klein_9b",
        "defaults": {"steps": 9, "width": 512, "height": 512},
    },
    "flux2-klein-base-4b": {
        "class": "mflux.models.flux2.Flux2Klein",
        "config": "flux2_klein_base_4b",
        "defaults": {"steps": 9, "width": 512, "height": 512},
    },
    "flux2-klein-base-9b": {
        "class": "mflux.models.flux2.Flux2Klein",
        "config": "flux2_klein_base_9b",
        "defaults": {"steps": 9, "width": 512, "height": 512},
    },
    "flux1-dev": {
        "class": "mflux.models.flux.variants.txt2img.flux.Flux1",
        "config": "dev",
        "defaults": {"steps": 20, "width": 1024, "height": 1024},
    },
    "flux1-schnell": {
        "class": "mflux.models.flux.variants.txt2img.flux.Flux1",
        "config": "schnell",
        "defaults": {"steps": 4, "width": 1024, "height": 1024},
    },
    "z-image": {
        "class": "mflux.models.z_image.ZImage",
        "config": "z_image",
        "defaults": {"steps": 20, "width": 1024, "height": 1024},
    },
    "z-image-turbo": {
        "class": "mflux.models.z_image.ZImageTurbo",
        "config": "z_image_turbo",
        "defaults": {"steps": 8, "width": 1024, "height": 1024},
    },
    "fibo": {
        "class": "mflux.models.fibo.cli.fibo_generate.FIBO",
        "config": "fibo",
        "defaults": {"steps": 20, "width": 832, "height": 480},
    },
    "fibo-lite": {
        "class": "mflux.models.fibo.cli.fibo_generate.FIBO",
        "config": "fibo_lite",
        "defaults": {"steps": 20, "width": 832, "height": 480},
    },
    "qwen-image": {
        "class": "mflux.models.qwen.cli.qwen_image_generate.QwenImage",
        "config": "qwen_image",
        "defaults": {"steps": 30, "width": 1024, "height": 1024},
    },
    "seedvr2-3b": {
        "class": "mflux.models.seedvr2.SeedVR2",
        "config": "seedvr2_3b",
        "defaults": {"steps": 20, "width": 1024, "height": 1024},
    },
    "seedvr2-7b": {
        "class": "mflux.models.seedvr2.SeedVR2",
        "config": "seedvr2_7b",
        "defaults": {"steps": 20, "width": 1024, "height": 1024},
    },
    # ── Diffusers + GGUF models ──────────────────────────────────────
    "flux2-dev": {
        "backend": "diffusers",
        "gguf": "https://huggingface.co/city96/FLUX.2-dev-gguf/blob/main/flux2-dev-Q4_K_M.gguf",
        "base_repo": "black-forest-labs/FLUX.2-dev",
        "pipeline": "Flux2Pipeline",
        "defaults": {"steps": 30, "width": 1024, "height": 1024},
    },
}


def load_model(name: str, quantize: int | None, lora_paths: list[str] | None, lora_scales: list[float] | None):
    spec = MODELS[name]

    # Diffusers + GGUF backend
    if spec.get("backend") == "diffusers":
        from ai_image_server.diffusers_model import DiffusersModel
        return DiffusersModel(
            gguf_url=spec["gguf"],
            base_repo=spec["base_repo"],
            pipeline_class=spec["pipeline"],
        )

    # MFLUX backend
    module_path, class_name = spec["class"].rsplit(".", 1)

    import importlib
    import inspect
    mod = importlib.import_module(module_path)
    cls = getattr(mod, class_name)

    kwargs: dict = {"quantize": quantize}

    # Only pass lora args if the model supports them
    sig = inspect.signature(cls.__init__)
    if "lora_paths" in sig.parameters:
        kwargs["lora_paths"] = lora_paths
        kwargs["lora_scales"] = lora_scales

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
