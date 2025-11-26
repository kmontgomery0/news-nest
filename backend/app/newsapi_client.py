from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional
import time
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

    max_attempts = 3
    last_error_msg: Optional[str] = None
    for attempt in range(1, max_attempts + 1):
        try:
            response = requests.get(endpoint, params=params, timeout=20)
            response.raise_for_status()
            data = response.json()
            if data.get("status") != "ok":
                # Surface NewsAPI application-level errors
                message = data.get("message") or str(data)
                # Retry only if rate limited is indicated
                if attempt < max_attempts and ("rate" in message.lower() or "too many" in message.lower()):
                    delay_seconds = 0.5 * (2 ** (attempt - 1))
                    time.sleep(delay_seconds)
                    continue
                raise RuntimeError(f"NewsAPI error: {message}")
            return data
        except requests.exceptions.HTTPError as http_err:
            status = getattr(http_err.response, "status_code", None)
            last_error_msg = f"HTTP {status}: {str(http_err)}"
            # Do not retry on auth or client errors except rate limit
            if status in (401, 403):
                raise RuntimeError("Invalid NewsAPI key or unauthorized. Please verify NEWSAPI_KEY.") from http_err
            if status == 429:
                if attempt < max_attempts:
                    delay_seconds = 0.5 * (2 ** (attempt - 1))
                    time.sleep(delay_seconds)
                    continue
                raise RuntimeError("NewsAPI rate limit reached. Please wait a moment and try again.") from http_err
            # Retry on transient server errors
            if status in (500, 502, 503, 504) and attempt < max_attempts:
                delay_seconds = 0.5 * (2 ** (attempt - 1))
                time.sleep(delay_seconds)
                continue
            # Other HTTP errors: surface without retry
            raise RuntimeError(f"Failed to fetch news (HTTP {status}). Please try again later.") from http_err
        except (requests.exceptions.Timeout, requests.exceptions.ConnectionError) as net_err:
            last_error_msg = str(net_err)
            if attempt < max_attempts:
                delay_seconds = 0.5 * (2 ** (attempt - 1))
                time.sleep(delay_seconds)
                continue
            raise RuntimeError("Network issue when contacting NewsAPI. Please try again shortly.") from net_err
        except Exception as exc:
            last_error_msg = str(exc)
            if attempt < max_attempts:
                delay_seconds = 0.5 * (2 ** (attempt - 1))
                time.sleep(delay_seconds)
                continue
            raise RuntimeError(f"Unexpected error fetching news: {str(exc)[:200]}") from exc
    # Fallback (should not reach here)
    raise RuntimeError(f"Unable to fetch news after retries. Last error: {last_error_msg}")


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

    max_attempts = 3
    last_error_msg: Optional[str] = None
    for attempt in range(1, max_attempts + 1):
        try:
            response = requests.get(endpoint, params=params, timeout=20)
            response.raise_for_status()
            data = response.json()
            if data.get("status") != "ok":
                message = data.get("message") or str(data)
                if attempt < max_attempts and ("rate" in message.lower() or "too many" in message.lower()):
                    delay_seconds = 0.5 * (2 ** (attempt - 1))
                    time.sleep(delay_seconds)
                    continue
                raise RuntimeError(f"NewsAPI error: {message}")
            return data
        except requests.exceptions.HTTPError as http_err:
            status = getattr(http_err.response, "status_code", None)
            last_error_msg = f"HTTP {status}: {str(http_err)}"
            if status in (401, 403):
                raise RuntimeError("Invalid NewsAPI key or unauthorized. Please verify NEWSAPI_KEY.") from http_err
            if status == 429:
                if attempt < max_attempts:
                    delay_seconds = 0.5 * (2 ** (attempt - 1))
                    time.sleep(delay_seconds)
                    continue
                raise RuntimeError("NewsAPI rate limit reached. Please wait a moment and try again.") from http_err
            if status in (500, 502, 503, 504) and attempt < max_attempts:
                delay_seconds = 0.5 * (2 ** (attempt - 1))
                time.sleep(delay_seconds)
                continue
            raise RuntimeError(f"Failed to fetch headlines (HTTP {status}). Please try again later.") from http_err
        except (requests.exceptions.Timeout, requests.exceptions.ConnectionError) as net_err:
            last_error_msg = str(net_err)
            if attempt < max_attempts:
                delay_seconds = 0.5 * (2 ** (attempt - 1))
                time.sleep(delay_seconds)
                continue
            raise RuntimeError("Network issue when contacting NewsAPI. Please try again shortly.") from net_err
        except Exception as exc:
            last_error_msg = str(exc)
            if attempt < max_attempts:
                delay_seconds = 0.5 * (2 ** (attempt - 1))
                time.sleep(delay_seconds)
                continue
            raise RuntimeError(f"Unexpected error fetching headlines: {str(exc)[:200]}") from exc
    raise RuntimeError(f"Unable to fetch headlines after retries. Last error: {last_error_msg}")

