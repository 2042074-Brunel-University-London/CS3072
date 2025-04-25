import ssl
import socket
import whois
import dns.resolver
from datetime import datetime, UTC
import requests
import re
import validators
from decimal import Decimal

from . import model as domain_model
from .schema import Domain
from ...models.gda.eval import eval_gda


async def analyze_domain(domain: str) -> Domain:
    """
    Analyze a domain for trustworthiness and security.
    Returns a dictionary with analysis results.
    """

    # Initialize results
    results = Domain(
        url=domain,
        trust_score=0,
        is_ssl_valid=False,
        is_malicious=False,
        content_quality=0,
        has_valid_whois=False,
        has_valid_dns=False,
        category=None,
        popularity=0,
        created_at=None,
        last_checked_at=datetime.now(UTC),
    )

    if not validators.domain(domain):
        print("=== Invalid domain", domain)
        return results

    # Check SSL/TLS
    try:
        context = ssl.create_default_context()
        with socket.create_connection((domain, 443)) as sock:
            with context.wrap_socket(sock, server_hostname=domain) as ssock:
                cert = ssock.getpeercert()
                results.is_ssl_valid = True
                results.trust_score += 20
    except:
        results.is_ssl_valid = False

    # Check WHOIS
    try:
        w = whois.whois(domain)
        print("=== WHOIS data", w)
        if w.domain_name:
            results.has_valid_whois = True
            results.trust_score += 15

            # Calculate domain age
            if w.creation_date:
                if isinstance(w.creation_date, list):
                    creation_date = w.creation_date[0]
                else:
                    creation_date = w.creation_date
                results.created_at = creation_date
                results.trust_score += await get_score_for_domain_age(creation_date)
    except:
        results.has_valid_whois = False

    # Check DNS records
    try:
        a_records = dns.resolver.resolve(domain, "A")
        mx_records = dns.resolver.resolve(domain, "MX")

        print("=== DNS records", a_records, mx_records)

        results.has_valid_dns = True
        results.trust_score += 15
    except Exception as e:
        print("=== DNS records error", e)
        results.has_valid_dns = False

    try:
        dga_score = eval_gda(domain)
        results.dga_score = Decimal(dga_score)

        if dga_score >= 0.3:
            results.trust_score -= 15
        elif dga_score < 0.2:
            results.trust_score += 10

    except:
        dga_score = None
        results.dga_score = None
        print("=== Failed to get GDA score")

    # Check for malicious indicators
    try:
        response = requests.get(f"https://{domain}", timeout=5)
        content = response.text.lower()

        # Basic content analysis
        suspicious_patterns = [
            r"password.*reset",
            r"account.*verification",
            r"urgent.*action.*required",
            r"click.*here",
            r"limited.*time.*offer",
        ]

        suspicious_count = sum(
            1 for pattern in suspicious_patterns if re.search(pattern, content)
        )

        print("=== Suspicious count", suspicious_count)

        if suspicious_count > 2:
            results.is_malicious = get_is_malicious(dga_score, suspicious_count)
            results.trust_score -= 10
        else:
            results.trust_score += 10
    except Exception as e:
        print("=== Suspicious content error", e)
        results.is_malicious = get_is_malicious(dga_score, None)
        results.trust_score -= 20

    # Normalize trust score to 0-100 range
    results.trust_score = max(0, min(100, results.trust_score))

    return results


async def analyze_and_save_domain(url: str) -> Domain:
    """
    Analyze a domain and save the results to the database.
    Returns the analysis results.
    """
    # Get existing domain if it exists
    existing_domain = await domain_model.get_domain_by_url(url)

    # Perform analysis
    analysis_results = await analyze_domain(url)

    # Update or create domain record
    if existing_domain:
        await domain_model.update_domain(url, analysis_results)
    else:
        await domain_model.create_domain(analysis_results)

    return analysis_results


async def get_score_for_domain_age(creation_date: datetime) -> int:
    domain_age = (datetime.now() - creation_date).days
    if domain_age > 10 * 365:
        return 20
    elif domain_age > 5 * 365:
        return 15
    elif domain_age > 1 * 365:
        return 10
    else:
        return 5


def get_is_malicious(dga_score: float | None, suspicious_patterns_count: int | None):
    if dga_score is None and suspicious_patterns_count is None:
        return False

    if dga_score is None:
        return suspicious_patterns_count >= 2

    if suspicious_patterns_count is None:
        return dga_score >= 0.3

    return dga_score >= 0.3 or suspicious_patterns_count >= 3
