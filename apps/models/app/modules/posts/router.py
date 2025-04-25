from typing import Optional, List
from fastapi import APIRouter
from . import services as post_services
from .schema import AnalyzePostPayload

posts_router = APIRouter(prefix="/posts")


@posts_router.post("/analyze")
async def analyze_post(payload: AnalyzePostPayload):
    """
    Analyze a post for trustworthiness and security.
    Returns the analysis results.
    """
    results = await post_services.analyze_post(payload.id)
    return results
