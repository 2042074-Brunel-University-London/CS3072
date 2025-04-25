from typing import Dict
from .schema import Post, PostMedia
from ...common.db import database


async def get_post_by_id(id: str) -> Post:
    query = "SELECT * FROM post WHERE id = $1"
    async with database.pool.acquire() as connection:
        async with connection.transaction():
            row = await connection.fetchrow(query, id)
            if row is not None:
                return Post(**row)
            else:
                return None


async def update_post(id: str, post: Post) -> Post:
    """Update post with provided fields"""
    async with database.pool.acquire() as connection:
        async with connection.transaction():
            # Convert post to dict and filter out None values
            post_data = {k: v for k, v in post.model_dump().items() if v is not None}

            set_clauses = []
            values = []
            for i, (key, value) in enumerate(post_data.items(), start=1):
                set_clauses.append(f"{key} = ${i}")
                values.append(value)

            values.append(id)
            query = f"""
                UPDATE post 
                SET {", ".join(set_clauses)}
                WHERE id = ${len(values)}
            """

            await connection.execute(query, *values)
            return await get_post_by_id(id)


async def get_post_media_list(post_id: str) -> list[PostMedia]:
    """Get all media items for a post"""
    query = "SELECT * FROM post_media WHERE post_id = $1"
    async with database.pool.acquire() as connection:
        async with connection.transaction():
            rows = await connection.fetch(query, post_id)
            return [PostMedia(**row) for row in rows] if rows else []


async def update_post_media(id: str, post_media: PostMedia) -> PostMedia:
    """Update post media with provided fields"""
    async with database.pool.acquire() as connection:
        async with connection.transaction():
            # Convert post media to dict and filter out None values
            post_media_data = {
                k: v for k, v in post_media.model_dump().items() if v is not None
            }

            set_clauses = []
            values = []
            for i, (key, value) in enumerate(post_media_data.items(), start=1):
                set_clauses.append(f"{key} = ${i}")
                values.append(value)

            values.append(id)
            query = f"""
                UPDATE post_media
                SET {", ".join(set_clauses)}
                WHERE id = ${len(values)}
                RETURNING *
            """

            row = await connection.fetchrow(query, *values)
            return PostMedia(**row) if row else None


async def get_post_tags(post_id: str) -> list[str]:
    query = """
    SELECT t.name 
    FROM tag t 
    JOIN post_to_tag pt ON t.id = pt.tag_id 
    WHERE pt.post_id = $1
    """
    async with database.pool.acquire() as connection:
        async with connection.transaction():
            rows = await connection.fetch(query, post_id)
            return [row["name"] for row in rows]


async def update_post_topics(
    post_id: str, topics: Dict[str, float]
) -> Dict[str, float]:
    """Update topics for a post. Deletes existing topics and creates new ones with scores."""
    async with database.pool.acquire() as connection:
        async with connection.transaction():
            # Delete existing topics for this post
            await connection.execute(
                "DELETE FROM post_to_topic WHERE post_id = $1",
                post_id,
            )

            if not topics:
                return {}

            for topic_name, score in topics.items():
                # Insert topic if it doesn't exist
                topic = await connection.fetchrow(
                    """
                    INSERT INTO topic (name)
                    VALUES ($1)
                    ON CONFLICT (name) DO UPDATE
                    SET name = EXCLUDED.name
                    RETURNING id
                    """,
                    topic_name,
                )

                # Create post-to-topic relationship
                await connection.execute(
                    """
                    INSERT INTO post_to_topic (post_id, topic_id, score)
                    VALUES ($1, $2, $3)
                    """,
                    post_id,
                    topic["id"],
                    score,
                )

            return topics
