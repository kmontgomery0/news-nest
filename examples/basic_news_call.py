import os
import argparse
from datetime import datetime, timedelta, timezone
import requests
try:
    from dotenv import load_dotenv  # type: ignore
except Exception:
    def load_dotenv() -> None: 
        ### guys i'm not sure why python dotenv sometimes isn't working, but fallback here for that case. ###
        # Minimal fallback: load key=value pairs from ./.env into os.environ
        env_path = os.path.join(os.getcwd(), ".env")
        if not os.path.exists(env_path):
            return
        try:
            with open(env_path, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if not line or line.startswith("#"):
                        continue
                    key, sep, value = line.partition("=")
                    if sep:
                        os.environ.setdefault(key.strip(), value.strip())
        except Exception:
            # Silently ignore fallback failures; user can export env vars instead
            pass


def get_api_key() -> str:
    load_dotenv()
    for key in ("NEWSAPI_KEY", "NEWS_API_KEY", "NEWSAPI_API_KEY"):
        v = os.getenv(key)
        if v:
            return v
    return ""


def iso_date_days_ago(days: int) -> str:
    return (datetime.now(timezone.utc) - timedelta(days=days)).date().isoformat()


def main():
    parser = argparse.ArgumentParser(description="Basic NewsAPI example: print recent articles")
    parser.add_argument("--q", default="technology", help="Query string (keywords)")
    parser.add_argument("--from-days", type=int, default=7, help="Days back from today (0-30)")
    parser.add_argument("--page-size", type=int, default=10, help="Max results to print (1-100)")
    args = parser.parse_args()

    api_key = get_api_key()
    if not api_key:
        raise RuntimeError("Missing NewsAPI key. Set NEWSAPI_KEY in your environment or .env file.")

    endpoint = "https://newsapi.org/v2/everything"
    params = {
        "q": args.q,
        "from": iso_date_days_ago(args.from_days),
        "sortBy": "publishedAt",
        "language": "en",
        "searchIn": "title,description,content",
        "pageSize": args.page_size,
        "page": 1,
        "apiKey": api_key,
    }

    resp = requests.get(endpoint, params=params, timeout=20)
    resp.raise_for_status()
    data = resp.json()

    if data.get("status") != "ok":
        raise RuntimeError(f"NewsAPI returned error: {data}")

    articles = data.get("articles", [])
    print(f"Top {len(articles)} results for '{args.q}' (past {args.from_days} days):\n")
    for i, a in enumerate(articles, start=1):
        title = a.get("title") or "(no title)"
        source = (a.get("source") or {}).get("name") or "(no source)"
        url = a.get("url") or "(no url)"
        print(f"{i}. {title} [{source}]\n   {url}\n")


if __name__ == "__main__":
    main()


