from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional

from .config import get_newsapi_key
from .newsapi_client import fetch_news


app = FastAPI(title="News Nest API", version="0.1.0")

# Enable CORS for local/mobile development; tighten in production as needed.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # replace with specific origins for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/news")
def get_news(
    q: Optional[str] = Query(None, description="Query string (keywords)"),
    fromDays: Optional[int] = Query(7, ge=0, le=30, description="Days back from today"),
    language: Optional[str] = Query("en"),
    searchIn: Optional[str] = Query("title,description,content"),
    sortBy: Optional[str] = Query("publishedAt"),
    pageSize: Optional[int] = Query(50, ge=1, le=100),
    page: Optional[int] = Query(1, ge=1),
    sources: Optional[str] = Query(None),
    domains: Optional[str] = Query(None),
    excludeDomains: Optional[str] = Query(None),
):
    api_key = get_newsapi_key()
    try:
        data = fetch_news(
            api_key,
            q=q,
            from_days=fromDays,
            language=language,
            search_in=searchIn,
            sort_by=sortBy,
            page_size=pageSize,
            page=page,
            sources=sources,
            domains=domains,
            exclude_domains=excludeDomains,
        )
        return data
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


