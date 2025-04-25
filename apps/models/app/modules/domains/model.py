from .schema import Domain, AnalyzeDomainPayload
from ...common.db import database


async def get_domain_by_url(url: str) -> Domain:
    query = "SELECT * FROM domain WHERE url = $1"
    async with database.pool.acquire() as connection:
        async with connection.transaction():
            row = await connection.fetchrow(query, url)
            if row is not None:
                print("Domain", row)
                return Domain(**row)
            else:
                return None


async def update_domain(url: str, domain: Domain) -> Domain:
    """Update domain with provided fields"""
    async with database.pool.acquire() as connection:
        async with connection.transaction():
            # Convert domain to dict and filter out None values
            domain_data = {
                k: v for k, v in domain.model_dump().items() if v is not None
            }

            set_clauses = []
            values = []
            for i, (key, value) in enumerate(domain_data.items(), start=1):
                set_clauses.append(f"{key} = ${i}")
                values.append(value)

            values.append(url)  # Add URL for WHERE clause
            query = f"""
                UPDATE domain 
                SET {", ".join(set_clauses)}
                WHERE url = ${len(values)}
            """

            await connection.execute(query, *values)
            return await get_domain_by_url(url)


async def create_domain(domain: Domain) -> Domain:
    """Create a new domain record"""
    async with database.pool.acquire() as connection:
        async with connection.transaction():
            # Convert domain to dict and filter out None values
            domain_data = {
                k: v for k, v in domain.model_dump().items() if v is not None
            }

            columns = list(domain_data.keys())
            placeholders = [f"${i + 1}" for i in range(len(columns))]

            query = f"""
                INSERT INTO domain ({", ".join(columns)})
                VALUES ({", ".join(placeholders)})
            """

            await connection.execute(query, *domain_data.values())
            return await get_domain_by_url(domain.url)
