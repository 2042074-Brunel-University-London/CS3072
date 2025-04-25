from pydantic import BaseModel
from transformers import pipeline
from PIL import Image
import requests
import io

img_nsfw_pipe = pipeline(
    "image-classification",
    model="Falconsai/nsfw_image_detection",
    device=-1,  # CPU; device=0 for GPU
)


class ImageClassificationResult(BaseModel):
    is_image_nsfw: bool
    image_nsfw_score: float


def classify_image(url: str, threshold: float = 0.6) -> ImageClassificationResult:
    resp = requests.get(url, timeout=5)
    resp.raise_for_status()

    img = Image.open(io.BytesIO(resp.content)).convert("RGB")
    out = img_nsfw_pipe(img)[0]

    label = out["label"].lower()  # 'nsfw' or 'normal'
    score = float(out["score"])

    return ImageClassificationResult(
        is_image_nsfw=label == "nsfw" and score >= threshold,
        image_nsfw_score=score,
    )
