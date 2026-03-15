"""CLIP embedding and zero-shot classification using Apple's MobileCLIP-S1.

MobileCLIP-S1 is 4.8x faster than OpenAI's ViT-B/16 with similar accuracy.
Model weights (~85MB) are downloaded automatically on first use.
"""

import torch
from PIL import Image

_clip_model = None
_clip_preprocess = None
_clip_tokenizer = None
_device = None


def load_clip_model():
    """Load MobileCLIP-S1 via OpenCLIP. Returns (model, preprocess, tokenizer)."""
    global _clip_model, _clip_preprocess, _clip_tokenizer, _device

    if _clip_model is not None:
        return _clip_model, _clip_preprocess, _clip_tokenizer

    import open_clip

    _device = "mps" if torch.backends.mps.is_available() else "cpu"

    print(f"Loading MobileCLIP-S1 on {_device}...")
    _clip_model, _, _clip_preprocess = open_clip.create_model_and_transforms(
        "MobileCLIP-S1", pretrained="datacompdr"
    )
    _clip_tokenizer = open_clip.get_tokenizer("MobileCLIP-S1")
    _clip_model = _clip_model.to(_device)
    _clip_model.eval()
    print("MobileCLIP-S1 loaded.")

    return _clip_model, _clip_preprocess, _clip_tokenizer


def embed_image(image_path: str) -> list[float]:
    """Return normalized CLIP embedding for an image."""
    model, preprocess, _ = load_clip_model()
    image = preprocess(Image.open(image_path)).unsqueeze(0).to(_device)
    with torch.no_grad():
        features = model.encode_image(image)
        features = features / features.norm(dim=-1, keepdim=True)
    return features[0].cpu().tolist()


def embed_text(text: str) -> list[float]:
    """Return normalized CLIP embedding for a text string."""
    model, _, tokenizer = load_clip_model()
    tokens = tokenizer([text]).to(_device)
    with torch.no_grad():
        features = model.encode_text(tokens)
        features = features / features.norm(dim=-1, keepdim=True)
    return features[0].cpu().tolist()


def classify_image(image_path: str, labels: list[str]) -> list[dict]:
    """Zero-shot classify an image against a list of text labels.

    Returns a sorted list of {"label": str, "score": float} dicts,
    highest score first. Scores are softmax probabilities (sum to 1).
    """
    model, preprocess, tokenizer = load_clip_model()

    image = preprocess(Image.open(image_path)).unsqueeze(0).to(_device)
    tokens = tokenizer(labels).to(_device)

    with torch.no_grad():
        image_features = model.encode_image(image)
        text_features = model.encode_text(tokens)
        image_features = image_features / image_features.norm(dim=-1, keepdim=True)
        text_features = text_features / text_features.norm(dim=-1, keepdim=True)

        # Cosine similarity scaled by CLIP's learned temperature
        logits = (100.0 * image_features @ text_features.T).softmax(dim=-1)

    scores = logits[0].cpu().tolist()
    results = [{"label": label, "score": round(score, 4)} for label, score in zip(labels, scores)]
    results.sort(key=lambda x: x["score"], reverse=True)
    return results
