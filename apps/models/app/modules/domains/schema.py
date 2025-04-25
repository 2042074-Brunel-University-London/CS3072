from datetime import datetime
from pydantic import BaseModel
from decimal import Decimal

class Domain(BaseModel):
    url: str

    trust_score: int
    is_ssl_valid: bool
    is_malicious: bool
    dga_score: Decimal | None = None
    content_quality: int
    created_at: datetime | None = None
    has_valid_whois: bool
    has_valid_dns: bool

    category: str | None
    popularity: int

    last_checked_at: datetime | None = None

class AnalyzeDomainPayload(BaseModel):
    url: str

    # trust_score: int
    # is_ssl_valid: bool
    # is_malicious: bool
    # content_quality: int
    # domain_age: int
    # has_valid_whois: bool
    # has_valid_dns: bool

    # popularity: int