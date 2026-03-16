"""CLIP embedding and zero-shot classification using Jina CLIP v2.

Jina CLIP v2 (0.9B params) provides state-of-the-art multimodal embeddings
with Matryoshka support (1024 → 64 dims). We use 512-dim for our Vectorize index.
Model weights (~3.5GB) are downloaded automatically on first use from HuggingFace.

Uses sentence-transformers for model loading, but calls the inner model's
encode_text/encode_image directly (sentence-transformers' encode() produces
NaN for images due to a wrapping issue with Jina's custom model).
"""

import numpy as np
from PIL import Image

_model = None  # SentenceTransformer wrapper (for loading)
_inner = None  # The actual JinaCLIPModel (for inference)

TRUNCATE_DIM = 512
MODEL_ID = "jinaai/jina-clip-v2"


def _patch_jina_eva_meta_tensor_bug():
    """Patch Jina's EVA model to avoid meta tensor crash with torch >= 2.10."""
    import torch
    _orig_linspace = torch.linspace

    def _patched_linspace(*args, **kwargs):
        if "device" not in kwargs:
            kwargs["device"] = "cpu"
        return _orig_linspace(*args, **kwargs)

    torch.linspace = _patched_linspace


def load_clip_model():
    """Load Jina CLIP v2. Returns the inner model for direct encode calls."""
    global _model, _inner

    if _inner is not None:
        return _inner

    from sentence_transformers import SentenceTransformer

    _patch_jina_eva_meta_tensor_bug()
    print(f"Loading Jina CLIP v2 ({TRUNCATE_DIM}d)...")
    _model = SentenceTransformer(
        MODEL_ID, trust_remote_code=True, truncate_dim=TRUNCATE_DIM,
        device="cpu",  # MPS produces NaN for vision encoder
    )
    # Get the inner JinaCLIPModel which has working encode_text/encode_image
    _inner = _model[0].model
    print("Jina CLIP v2 loaded.")

    return _inner


def embed_image(image_path: str) -> list[float]:
    """Return normalized 512-dim CLIP embedding for an image."""
    model = load_clip_model()
    embeddings = model.encode_image([image_path], truncate_dim=TRUNCATE_DIM)
    vec = embeddings[0]
    vec = vec / np.linalg.norm(vec)
    return vec.tolist()


def embed_text(text: str) -> list[float]:
    """Return normalized 512-dim CLIP embedding for a text string."""
    model = load_clip_model()
    embeddings = model.encode_text([text], truncate_dim=TRUNCATE_DIM)
    vec = embeddings[0]
    vec = vec / np.linalg.norm(vec)
    return vec.tolist()


def classify_image(image_path: str, labels: list[str]) -> list[dict]:
    """Zero-shot classify an image against a list of text labels.

    Returns a sorted list of {"label": str, "score": float} dicts,
    highest score first. Scores are softmax probabilities (sum to 1).
    """
    model = load_clip_model()

    image_embeddings = model.encode_image([image_path], truncate_dim=TRUNCATE_DIM)
    text_embeddings = model.encode_text(labels, truncate_dim=TRUNCATE_DIM)

    # Normalize
    image_embeddings = image_embeddings / np.linalg.norm(image_embeddings, axis=-1, keepdims=True)
    text_embeddings = text_embeddings / np.linalg.norm(text_embeddings, axis=-1, keepdims=True)

    # Cosine similarity → softmax
    logits = 100.0 * np.dot(image_embeddings, text_embeddings.T)
    exp_logits = np.exp(logits - np.max(logits))
    probs = exp_logits / exp_logits.sum()

    scores = probs[0].tolist()
    results = [{"label": label, "score": round(float(score), 4)} for label, score in zip(labels, scores)]
    results.sort(key=lambda x: x["score"], reverse=True)
    return results
