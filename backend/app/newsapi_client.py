from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional
import requests


def _iso_date_days_ago(days: int) -> str:
    return (datetime.now(timezone.utc) - timedelta(days=days)).date().isoformat()


def fetch_news(
    api_key: str,
    *,
    q: Optional[str] = None,
    from_days: Optional[int] = 7,
    language: Optional[str] = "en",
    search_in: Optional[str] = "title,description,content",
    sort_by: Optional[str] = "publishedAt",
    page_size: Optional[int] = 50,
    page: Optional[int] = 1,
    sources: Optional[str] = None,
    domains: Optional[str] = None,
    exclude_domains: Optional[str] = None,
) -> Dict[str, Any]:
    """Call NewsAPI Everything with flexible parameters and return parsed JSON."""
    if not api_key:
        raise RuntimeError("Missing NewsAPI key.")

    endpoint = "https://newsapi.org/v2/everything"
    params: Dict[str, Any] = {
        "apiKey": api_key,
        "sortBy": sort_by,
        "language": language,
        "pageSize": page_size,
        "page": page,
    }

    if q is not None:
        params["q"] = q
    if from_days is not None:
        params["from"] = _iso_date_days_ago(from_days)
    if search_in is not None:
        params["searchIn"] = search_in
    if sources:
        params["sources"] = sources
    if domains:
        params["domains"] = domains
    if exclude_domains:
        params["excludeDomains"] = exclude_domains

    response = requests.get(endpoint, params=params, timeout=20)
    response.raise_for_status()
    data = response.json()

    if data.get("status") != "ok":
        raise RuntimeError(f"NewsAPI returned error: {data}")

    return data


def fetch_top_headlines(
    api_key: str,
    *,
    country: Optional[str] = "us",
    category: Optional[str] = None,
    q: Optional[str] = None,
    page_size: Optional[int] = 10,
    page: Optional[int] = 1,
) -> Dict[str, Any]:
    """Call NewsAPI Top Headlines and return parsed JSON."""
    if not api_key:
        raise RuntimeError("Missing NewsAPI key.")

    endpoint = "https://newsapi.org/v2/top-headlines"
    params: Dict[str, Any] = {
        "apiKey": api_key,
        "pageSize": page_size,
        "page": page,
    }
    if country:
        params["country"] = country
    if category:
        params["category"] = category
    if q:
        params["q"] = q

    response = requests.get(endpoint, params=params, timeout=20)
    response.raise_for_status()
    data = response.json()

    if data.get("status") != "ok":
        raise RuntimeError(f"NewsAPI returned error: {data}")

    return data

