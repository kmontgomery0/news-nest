import os
from dotenv import load_dotenv


def get_newsapi_key() -> str:
    """Fetch NewsAPI key from environment/.env supporting common var names."""
    load_dotenv()
    for key_name in ("NEWSAPI_KEY", "NEWS_API_KEY", "NEWSAPI_API_KEY"):
        value = os.getenv(key_name)
        if value:
            return value
    return ""


