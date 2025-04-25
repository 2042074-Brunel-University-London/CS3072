from uuid import UUID
from pydantic import BaseModel
from ...modules.posts.model import get_post_by_id, get_post_media_list, get_post_tags
from .services.classify_image import classify_image
from .services.classify_text import classify_text
from typing import Dict, List

from ...modules.posts.schema import PostMedia


class PostMediaAnalysis(BaseModel):
    id: UUID
    is_nsfw: bool
    nsfw_score: float


class PostAnalyzerResult(BaseModel):
    is_nsfw: bool
    is_text_nsfw: bool
    text_nsfw_score: float
    sentiment: str
    sentiment_score: float
    topics: Dict[str, float]
    media_analysis: List[PostMediaAnalysis]
    has_media: bool


async def post_analyzer(post_id: str):
    print("=== Fetching post by id", post_id)
    post = await get_post_by_id(post_id)
    media_list = await get_post_media_list(post_id)
    tags = await get_post_tags(post_id)

    if not post:
        raise ValueError("Post not found")

    print("=== Classifying text")
    text_result = classify_text(post.content, tags)
    print("=== Text result", text_result)

    print("=== Classifying images")
    media_analysis = []
    is_any_image_nsfw = False
    for media in media_list:
        print(f"=== Analyzing image {media.id}")
        image_result = classify_image(media.url)
        print(f"=== Image result for {media.id}", image_result)

        media_analysis.append(
            PostMediaAnalysis(
                id=media.id,
                is_nsfw=image_result.is_image_nsfw,
                nsfw_score=image_result.image_nsfw_score,
            )
        )

        if image_result.is_image_nsfw:
            is_any_image_nsfw = True

    is_nsfw = text_result.is_text_nsfw or is_any_image_nsfw

    return PostAnalyzerResult(
        is_nsfw=is_nsfw,
        # Text results
        is_text_nsfw=text_result.is_text_nsfw,
        text_nsfw_score=text_result.text_nsfw_score,
        sentiment=text_result.sentiment,
        sentiment_score=text_result.sentiment_score,
        topics=text_result.topics,
        # Media results
        media_analysis=media_analysis,
        has_media=len(media_list) > 0,
    )
