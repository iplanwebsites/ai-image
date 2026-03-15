#!/usr/bin/env python3
"""Queue worker that keeps the model loaded and processes jobs from a directory.

Jobs are JSON files dropped into a watch directory. The worker picks them up
in order, generates images, and writes results.

    jobs/
      pending/   <- drop .json files here
      done/      <- completed jobs moved here (with result info)
      failed/    <- failed jobs moved here (with error info)

Job JSON format:
    {
      "prompt": "A puffin eating pizza",
      "output": "output/puffin.png",
      "width": 512,
      "height": 512,
      "steps": 9,
      "seed": 42,
      "guidance": null,
      "negative_prompt": null,
      "image_path": null,
      "image_strength": null
    }

Only "prompt" is required. Everything else has defaults.
"""

import json
import random
import time
import traceback
from pathlib import Path

from ai_image_server.cli import MODELS, load_model

POLL_INTERVAL = 0.5  # seconds


def process_job(model, job: dict, defaults: dict) -> str:
    prompt = job["prompt"]
    width = job.get("width") or defaults["width"]
    height = job.get("height") or defaults["height"]
    steps = job.get("steps") or defaults["steps"]
    seed = job.get("seed") if job.get("seed") is not None else random.randint(0, 2**32 - 1)
    output = job.get("output", "output.png")

    print(f"  Generating: {prompt!r} | {width}x{height} | {steps} steps | seed {seed}")

    gen_kwargs: dict = {
        "prompt": prompt,
        "seed": seed,
        "num_inference_steps": steps,
        "width": width,
        "height": height,
    }
    for key in ("guidance", "negative_prompt", "image_path", "image_strength"):
        if job.get(key) is not None:
            gen_kwargs[key] = job[key]

    result = model.generate_image(**gen_kwargs)

    output_path = Path(output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    result.save(str(output_path))
    print(f"  Saved to {output_path}")
    return str(output_path)


def main():
    import argparse

    parser = argparse.ArgumentParser(description="Image generation queue worker")
    parser.add_argument("-d", "--jobs-dir", default="jobs", help="Jobs directory (default: jobs)")
    parser.add_argument("-q", "--quantize", type=int, choices=[4, 8], default=8, help="Quantization level (default: 8)")
    parser.add_argument("-m", "--model", default="flux2-klein-4b", choices=MODELS, help="Model to use")
    args = parser.parse_args()

    jobs_dir = Path(args.jobs_dir)
    pending = jobs_dir / "pending"
    done = jobs_dir / "done"
    failed = jobs_dir / "failed"
    for d in (pending, done, failed):
        d.mkdir(parents=True, exist_ok=True)

    defaults = MODELS[args.model]["defaults"]

    print(f"Loading model: {args.model} (q{args.quantize})...")
    model = load_model(args.model, args.quantize, None, None)
    print(f"Model loaded. Watching {pending}/ for jobs...")

    while True:
        job_files = sorted(pending.glob("*.json"))
        if not job_files:
            time.sleep(POLL_INTERVAL)
            continue

        for job_file in job_files:
            print(f"Processing: {job_file.name}")
            try:
                job = json.loads(job_file.read_text())
                output_path = process_job(model, job, defaults)
                job["_result"] = {"output": output_path, "status": "done"}
                (done / job_file.name).write_text(json.dumps(job, indent=2))
                job_file.unlink()
            except Exception:
                tb = traceback.format_exc()
                print(f"  FAILED: {tb}")
                job_raw = job_file.read_text()
                try:
                    job = json.loads(job_raw)
                except Exception:
                    job = {"_raw": job_raw}
                job["_result"] = {"status": "failed", "error": tb}
                (failed / job_file.name).write_text(json.dumps(job, indent=2))
                job_file.unlink()


if __name__ == "__main__":
    main()
