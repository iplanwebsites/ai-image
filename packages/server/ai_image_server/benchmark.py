#!/usr/bin/env python3
"""Benchmark local image generation models and output results as Markdown.

Usage:
    ai-image-benchmark                         # benchmark default models
    ai-image-benchmark -m flux2-klein-4b       # benchmark specific model
    ai-image-benchmark --all                   # benchmark all installed models
    ai-image-benchmark -o benchmarks.md        # write to file
    ai-image-benchmark --append                # append to existing file
    ai-image-benchmark --sizes 512x512 1024x1024  # custom sizes
"""

import argparse
import json
import platform
import random
import subprocess
import sys
import tempfile
import time
from datetime import datetime, timezone
from pathlib import Path

from ai_image_server.cli import MODELS, load_model

PROMPT = "A red fox sitting in a snowy forest, photorealistic"
DEFAULT_MODELS = ["flux2-klein-4b"]
DEFAULT_SIZES = ["512x512", "1024x1024"]


def get_device_info() -> dict:
    """Collect device information."""
    info: dict = {
        "platform": platform.platform(),
        "machine": platform.machine(),
        "python": platform.python_version(),
    }

    # macOS: get chip, memory, GPU cores via system_profiler
    if platform.system() == "Darwin":
        try:
            out = subprocess.check_output(
                ["system_profiler", "SPHardwareDataType", "-json"],
                text=True, timeout=10,
            )
            hw = json.loads(out)["SPHardwareDataType"][0]
            info["chip"] = hw.get("chip_type", "unknown")
            info["model"] = hw.get("machine_name", "unknown")
            info["cpu_cores"] = hw.get("number_processors", "unknown")

            # Memory: try physical_memory first, fall back to parsing
            mem = hw.get("physical_memory", "")
            info["memory"] = mem
        except Exception:
            pass

        # GPU core count from system_profiler
        try:
            out = subprocess.check_output(
                ["system_profiler", "SPDisplaysDataType", "-json"],
                text=True, timeout=10,
            )
            displays = json.loads(out).get("SPDisplaysDataType", [])
            for d in displays:
                cores = d.get("sppci_cores")
                if cores:
                    info["gpu_cores"] = cores
                    break
        except Exception:
            pass

    # MLX memory bandwidth (Apple Silicon specific)
    try:
        import mlx.core as mx
        info["mlx_backend"] = str(mx.default_device())
    except Exception:
        pass

    return info


def format_device_header(info: dict) -> str:
    """Format device info as a Markdown section."""
    lines = ["## Device\n"]
    lines.append(f"| Property | Value |")
    lines.append(f"|----------|-------|")

    labels = {
        "model": "Computer",
        "chip": "Chip",
        "memory": "Memory",
        "gpu_cores": "GPU Cores",
        "cpu_cores": "CPU Cores",
        "platform": "OS",
        "python": "Python",
        "mlx_backend": "MLX Device",
    }
    for key, label in labels.items():
        if key in info:
            lines.append(f"| {label} | {info[key]} |")

    return "\n".join(lines)


def benchmark_model(
    model_name: str,
    sizes: list[str],
    quantize: int,
    warmup: bool = True,
) -> dict:
    """Benchmark a single model at multiple sizes. Returns results dict."""

    spec = MODELS[model_name]
    defaults = spec["defaults"]
    steps = defaults["steps"]
    is_diffusers = spec.get("backend") == "diffusers"

    results: dict = {
        "model": model_name,
        "quantize": "GGUF Q4" if is_diffusers else f"q{quantize}",
        "steps": steps,
        "runs": [],
    }

    print(f"\n{'='*60}")
    print(f"  Model: {model_name} ({results['quantize']})")
    print(f"  Steps: {steps}")
    print(f"{'='*60}")

    # Load model (timed)
    print(f"  Loading model...", end="", flush=True)
    t0 = time.time()
    model = load_model(model_name, quantize, None, None)
    load_time = time.time() - t0
    print(f" {load_time:.1f}s")
    results["load_time_s"] = round(load_time, 1)

    # Warmup run (not counted)
    if warmup:
        print(f"  Warmup run...", end="", flush=True)
        wsize = sizes[0] if sizes else f"{defaults['width']}x{defaults['height']}"
        ww, wh = map(int, wsize.split("x"))
        t0 = time.time()
        with tempfile.NamedTemporaryFile(suffix=".png") as f:
            result = model.generate_image(
                prompt=PROMPT, seed=42,
                num_inference_steps=max(steps // 2, 1),
                width=min(ww, 512), height=min(wh, 512),
            )
            result.save(f.name)
        print(f" {time.time() - t0:.1f}s")

    # Benchmark each size
    for size in sizes:
        w, h = map(int, size.split("x"))
        megapixels = (w * h) / 1_000_000
        seed = random.randint(0, 2**32 - 1)

        print(f"  Generating {size} ({steps} steps)...", end="", flush=True)

        with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as f:
            t0 = time.time()
            result = model.generate_image(
                prompt=PROMPT, seed=seed,
                num_inference_steps=steps,
                width=w, height=h,
            )
            result.save(f.name)
            elapsed = time.time() - t0

            file_size = Path(f.name).stat().st_size
            Path(f.name).unlink()

        sps = steps / elapsed
        print(f" {elapsed:.1f}s ({sps:.2f} steps/s)")

        results["runs"].append({
            "size": size,
            "megapixels": round(megapixels, 2),
            "time_s": round(elapsed, 1),
            "steps_per_s": round(sps, 2),
            "seed": seed,
            "file_size_kb": round(file_size / 1024, 1),
        })

    # Cleanup: free memory
    del model

    return results


def format_results_md(device: dict, all_results: list[dict]) -> str:
    """Format all benchmark results as Markdown."""
    lines = []

    lines.append(f"# Local Model Benchmarks")
    lines.append(f"")
    lines.append(f"*Generated {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}*")
    lines.append(f"")

    # Device info
    lines.append(format_device_header(device))
    lines.append("")

    # Results table
    lines.append("## Results\n")
    lines.append("| Model | Quant | Size | Steps | Time | Steps/s | MP/s |")
    lines.append("|-------|-------|------|-------|------|---------|------|")

    for result in all_results:
        for run in result["runs"]:
            mp_per_s = run["megapixels"] / run["time_s"] if run["time_s"] > 0 else 0
            lines.append(
                f"| {result['model']} "
                f"| {result['quantize']} "
                f"| {run['size']} "
                f"| {result['steps']} "
                f"| {run['time_s']}s "
                f"| {run['steps_per_s']} "
                f"| {mp_per_s:.3f} |"
            )

    lines.append("")

    # Load times
    lines.append("### Load Times\n")
    lines.append("| Model | Quant | Load Time |")
    lines.append("|-------|-------|-----------|")
    for result in all_results:
        lines.append(f"| {result['model']} | {result['quantize']} | {result['load_time_s']}s |")

    lines.append("")

    # Notes
    lines.append("### Notes\n")
    lines.append(f"- Prompt: *\"{PROMPT}\"*")
    lines.append(f"- Each model uses its recommended default step count")
    lines.append(f"- Times include inference only (not model loading)")
    lines.append(f"- First run after load includes a warmup pass (not counted)")
    lines.append(f"- Steps/s = inference steps per second (higher is better)")
    lines.append(f"- MP/s = megapixels per second (higher is better)")

    return "\n".join(lines) + "\n"


def main():
    parser = argparse.ArgumentParser(
        description="Benchmark local image generation models",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "-m", "--models", nargs="+", default=None, choices=list(MODELS.keys()),
        help="Models to benchmark (default: flux2-klein-4b)",
    )
    parser.add_argument(
        "--all", action="store_true",
        help="Benchmark all available models (skips models not yet downloaded)",
    )
    parser.add_argument(
        "--sizes", nargs="+", default=DEFAULT_SIZES,
        help=f"Image sizes to test (default: {' '.join(DEFAULT_SIZES)})",
    )
    parser.add_argument(
        "-q", "--quantize", type=int, choices=[4, 8], default=8,
        help="Quantization level for MFLUX models (default: 8)",
    )
    parser.add_argument(
        "-o", "--output", default=None,
        help="Output markdown file (default: print to stdout)",
    )
    parser.add_argument(
        "--append", action="store_true",
        help="Append to output file instead of overwriting",
    )
    parser.add_argument(
        "--json", action="store_true",
        help="Output raw JSON instead of Markdown",
    )
    parser.add_argument(
        "--no-warmup", action="store_true",
        help="Skip warmup run",
    )
    args = parser.parse_args()

    # Determine which models to run
    if args.all:
        model_names = list(MODELS.keys())
    elif args.models:
        model_names = args.models
    else:
        model_names = DEFAULT_MODELS

    # Collect device info
    print("Collecting device info...")
    device = get_device_info()
    print(f"  {device.get('chip', 'unknown')} / {device.get('memory', 'unknown')}")

    # Run benchmarks
    all_results = []
    for name in model_names:
        try:
            result = benchmark_model(
                name, args.sizes, args.quantize,
                warmup=not args.no_warmup,
            )
            all_results.append(result)
        except Exception as e:
            print(f"\n  SKIP {name}: {e}")

    if not all_results:
        print("\nNo models were benchmarked.", file=sys.stderr)
        sys.exit(1)

    # Format output
    if args.json:
        output = json.dumps({"device": device, "results": all_results}, indent=2)
    else:
        output = format_results_md(device, all_results)

    # Write output
    if args.output:
        mode = "a" if args.append else "w"
        with open(args.output, mode) as f:
            if args.append:
                f.write("\n---\n\n")
            f.write(output)
        print(f"\nResults written to {args.output}")
    else:
        print(f"\n{'='*60}\n")
        print(output)


if __name__ == "__main__":
    main()
