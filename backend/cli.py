import argparse
import json
from typing import Optional

from app.config import get_newsapi_key
from app.newsapi_client import fetch_news


def positive_int(value: str) -> int:
    ivalue = int(value)
    if ivalue < 0:
        raise argparse.ArgumentTypeError("Value must be non-negative")
    return ivalue


def main():
    parser = argparse.ArgumentParser(description="Fetch news via NewsAPI")
    parser.add_argument("--q", type=str, default=None, help="Query keywords")
    parser.add_argument("--from-days", type=positive_int, default=7, help="Days back from today")
    parser.add_argument("--language", type=str, default="en")
    parser.add_argument(
        "--search-in", type=str, default="title,description,content",
        help="Comma-separated fields: title,description,content"
    )
    parser.add_argument("--sort-by", type=str, default="publishedAt")
    parser.add_argument("--page-size", type=int, default=50)
    parser.add_argument("--page", type=int, default=1)
    parser.add_argument("--sources", type=str, default=None)
    parser.add_argument("--domains", type=str, default=None)
    parser.add_argument("--exclude-domains", type=str, default=None)
    parser.add_argument("--pretty", action="store_true", help="Pretty-print JSON output")

    args = parser.parse_args()

    api_key = get_newsapi_key()
    data = fetch_news(
        api_key,
        q=args.q,
        from_days=args.from_days,
        language=args.language,
        search_in=args.search_in,
        sort_by=args.sort_by,
        page_size=args.page_size,
        page=args.page,
        sources=args.sources,
        domains=args.domains,
        exclude_domains=args.exclude_domains,
    )

    if args.pretty:
        print(json.dumps(data, indent=2))
    else:
        print(json.dumps(data))


if __name__ == "__main__":
    main()


