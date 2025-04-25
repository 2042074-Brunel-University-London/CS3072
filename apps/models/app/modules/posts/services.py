from datetime import datetime
from .model import (
    get_post_by_id,
    update_post,
    update_post_media,
    update_post_topics,
)
from ...models.post_analyzer.eval import post_analyzer

async def analyze_post(post_id: str):
    analysis = await post_analyzer(post_id)

    # Get existing post
    # TODO: Should reuse the post data since one is already made in post_analyzer
    post = await get_post_by_id(post_id)
    if not post:
        raise ValueError(f"Post {post_id} not found")

    # Update post with analysis results
    post.is_nsfw = analysis.is_nsfw
    post.text_nsfw_score = analysis.text_nsfw_score
    post.sentiment_label = analysis.sentiment
    post.sentiment_score = analysis.sentiment_score
    post.last_analyzed_at = datetime.now()

    # Save updated post
    await update_post(post_id, post)

    # Update topics
    await update_post_topics(post_id, analysis.topics)

    # Update post media
    if analysis.has_media:
        for media_analysis in analysis.media_analysis:
            await update_post_media(
                media_analysis.id,
                media_analysis,
            )

    return analysis
