from typing import Optional, List
from fastapi import APIRouter
from . import services as domain_services
from .schema import Domain, AnalyzeDomainPayload

domains_router = APIRouter(prefix="/domains")


@domains_router.post("/analyze")
async def analyze_domain(payload: AnalyzeDomainPayload):
    """
    Analyze a domain for trustworthiness and security.
    Returns the analysis results.
    """
    results = await domain_services.analyze_and_save_domain(payload.url)
    return results
