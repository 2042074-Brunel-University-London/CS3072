import asyncpg
import os
from dotenv import load_dotenv

dotenv_path = os.path.join(os.path.dirname(__file__), '../../../../.env')
load_dotenv(dotenv_path)

DATABASE_URL = os.getenv("POSTGRES_URL")

class Postgres:
    def __init__(self, database_url: str):
        self.database_url = database_url

    async def connect(self):
        self.pool = await asyncpg.create_pool(self.database_url)

    async def disconnect(self):
        self.pool.close()

database = Postgres(DATABASE_URL)