from datetime import datetime
from uuid import UUID
from pydantic import BaseModel


class Post(BaseModel):
    id: str

    uri: str

    content: str

    likes_count: int
    reply_count: int
    repost_count: int
    quote_count: int

    website_url: str | None

    is_nsfw: bool
    text_nsfw_score: float | None

    sentiment_label: str | None
    sentiment_score: float | None

    author_did: str

    created_at: datetime
    indexed_at: datetime

    last_analyzed_at: datetime | None

    updated_at: datetime


class PostMedia(BaseModel):
    id: UUID
    post_id: str

    url: str
    mime_type: str
    size: int
    width: int
    height: int

    is_nsfw: bool
    nsfw_score: float | None

    created_at: datetime



class AnalyzePostPayload(BaseModel):
    id: str
