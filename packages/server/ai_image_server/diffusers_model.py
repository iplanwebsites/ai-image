"""Diffusers-based model wrapper for GGUF quantized models (e.g. FLUX.2-dev).

Presents the same generate_image() interface as MFLUX models so it can be
used as a drop-in replacement in the server and worker.

Memory budget for FLUX.2-dev Q4_K_M on 48GB Apple Silicon:
  - GGUF transformer: ~20 GB
  - Mistral3 text encoder (float16): ~6 GB
  - VAE: ~0.3 GB
  - Inference overhead: ~5 GB
  Total: ~31 GB (fits comfortably in 48 GB unified memory)

Loading order matters: we load each component separately to control
peak memory usage and avoid the ~40+ GB peak that occurs when
from_pretrained loads everything simultaneously.
"""
from __future__ import annotations

import gc
from dataclasses import dataclass

from PIL import Image


@dataclass
class GeneratedImage:
    """Wraps a PIL image to match the MFLUX result interface."""
    image: Image.Image

    def save(self, path: str):
        self.image.save(path)


class DiffusersModel:
    """Loads a GGUF-quantized model via diffusers and wraps it for the server."""

    def __init__(self, gguf_url: str, base_repo: str, pipeline_class: str, quantize: int | None = None):
        import torch

        # Pick device: MPS on Apple Silicon, CUDA if available, else CPU
        if torch.backends.mps.is_available():
            self.device = "mps"
            self.dtype = torch.float16
        elif torch.cuda.is_available():
            self.device = "cuda"
            self.dtype = torch.bfloat16
        else:
            self.device = "cpu"
            self.dtype = torch.float32

        self._load_pipeline(gguf_url, base_repo, pipeline_class)

    def _load_pipeline(self, gguf_url: str, base_repo: str, pipeline_class: str):
        import torch
        from diffusers import GGUFQuantizationConfig

        # Import the right pipeline and transformer classes
        if pipeline_class == "Flux2Pipeline":
            from diffusers import Flux2Pipeline, Flux2Transformer2DModel
            from diffusers import AutoencoderKLFlux2
            PipeClass = Flux2Pipeline
            TransformerClass = Flux2Transformer2DModel
            VAEClass = AutoencoderKLFlux2
        elif pipeline_class == "FluxPipeline":
            from diffusers import FluxPipeline, FluxTransformer2DModel
            from diffusers import AutoencoderKL
            PipeClass = FluxPipeline
            TransformerClass = FluxTransformer2DModel
            VAEClass = AutoencoderKL
        else:
            raise ValueError(f"Unsupported pipeline class: {pipeline_class}")

        compute_dtype = torch.bfloat16 if self.device != "mps" else torch.float16

        # Load components individually to control peak memory.

        # Step 1: Text encoder (~6 GB in float16 for Mistral3)
        print(f"  Loading text encoder from {base_repo}...")
        from transformers import AutoProcessor
        tokenizer = AutoProcessor.from_pretrained(base_repo, subfolder="tokenizer")

        from transformers import Mistral3ForConditionalGeneration
        text_encoder = Mistral3ForConditionalGeneration.from_pretrained(
            base_repo,
            subfolder="text_encoder",
            torch_dtype=compute_dtype,
            low_cpu_mem_usage=True,
        )
        text_encoder.to(self.device)
        gc.collect()

        # Step 2: VAE (~0.3 GB)
        print(f"  Loading VAE from {base_repo}...")
        vae = VAEClass.from_pretrained(
            base_repo,
            subfolder="vae",
            torch_dtype=compute_dtype,
        )
        vae.to(self.device)
        gc.collect()

        # Step 3: Scheduler
        from diffusers import FlowMatchEulerDiscreteScheduler
        scheduler = FlowMatchEulerDiscreteScheduler.from_pretrained(
            base_repo,
            subfolder="scheduler",
        )

        # Step 4: GGUF transformer (~20 GB for Q4_K_M)
        print(f"  Loading GGUF transformer from {gguf_url}...")
        transformer = TransformerClass.from_single_file(
            gguf_url,
            quantization_config=GGUFQuantizationConfig(compute_dtype=compute_dtype),
            torch_dtype=compute_dtype,
        )
        transformer.to(self.device)
        gc.collect()

        # Assemble pipeline from pre-loaded components
        print(f"  Assembling pipeline...")
        self.pipe = PipeClass(
            scheduler=scheduler,
            vae=vae,
            text_encoder=text_encoder,
            tokenizer=tokenizer,
            transformer=transformer,
        )
        self.pipe.enable_attention_slicing()

        print(f"  Pipeline ready on {self.device}")

    def generate_image(
        self,
        prompt: str,
        seed: int = 0,
        num_inference_steps: int = 50,
        width: int = 1024,
        height: int = 1024,
        guidance: float | None = None,
        negative_prompt: str | None = None,
        **kwargs,
    ) -> GeneratedImage:
        import torch

        generator = torch.Generator(device="cpu").manual_seed(seed)

        pipe_kwargs = {
            "prompt": prompt,
            "num_inference_steps": num_inference_steps,
            "width": width,
            "height": height,
            "generator": generator,
        }

        if guidance is not None:
            pipe_kwargs["guidance_scale"] = guidance

        result = self.pipe(**pipe_kwargs)
        image = result.images[0]

        return GeneratedImage(image=image)
