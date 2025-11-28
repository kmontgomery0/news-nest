"""Helper functions for fetching and summarizing news for agents."""

from typing import Optional, Dict, Any, List
from urllib.parse import urlparse
from .newsapi_client import fetch_news, fetch_top_headlines
from .config import get_newsapi_key, get_gemini_api_key
from .gemini import gemini_generate


def fetch_relevant_news(query: str, days_back: int = 3, max_articles: int = 5) -> Optional[Dict[str, Any]]:
    """
    Fetch relevant news articles based on a query.
    
    Args:
        query: Search query (topic, keywords)
        days_back: How many days back to search (default: 3)
        max_articles: Maximum number of articles to return (default: 5)
    
    Returns:
        Dictionary with news data or None if fetch fails
    """
    api_key = get_newsapi_key()
    if not api_key:
        print(f"[fetch_relevant_news] No NewsAPI key found. Set NEWSAPI_KEY in .env file")
        return None
    
    # Clean query - remove extra spaces
    query = query.strip()
    
    # If query is too short or empty, use a default
    if not query or len(query) < 2:
        query = "news"
    
    print(f"[fetch_relevant_news] Attempting to fetch news for query: '{query}' (last {days_back} days)")
    
    try:
        data = fetch_news(
            api_key=api_key,
            q=query,
            from_days=days_back,
            page_size=max_articles,
            sort_by="publishedAt",
            language="en"
        )
        
        if data and data.get("status") == "ok":
            articles = data.get("articles", [])
            print(f"[fetch_relevant_news] Successfully fetched {len(articles)} articles")
            return data
        else:
            print(f"[fetch_relevant_news] NewsAPI returned error: {data}")
            return None
            
    except Exception as e:
        print(f"[fetch_relevant_news] Error fetching news: {e}")
        import traceback
        traceback.print_exc()
        return None


def fetch_headlines_prompt(
    *,
    country: Optional[str] = "us",
    category: Optional[str] = None,
    q: Optional[str] = None,
    page_size: int = 6,
    header_text: str,
    formatting_instructions: str,
    api_key: Optional[str] = None,
    min_items: Optional[int] = None,
    max_pages: int = 3
) -> Optional[Dict[str, Any]]:
    """
    Fetch top headlines and return a pre-formatted prompt block and count.
    
    Args:
        country: Country code for headlines (default: "us")
        category: Optional category (e.g., "sports")
        page_size: How many articles to fetch per page (default: 6)
        header_text: The header line above the list (e.g., "Today's top headlines:")
        formatting_instructions: Trailing instructions appended after the list
        api_key: Optional NewsAPI key override
        min_items: If provided, ensure at least this many items by fetching additional pages
        max_pages: Max number of pages to fetch when attempting to reach min_items
        q: Optional query to filter top headlines (e.g., "politics OR election")
    
    Returns:
        dict with {"prompt": str, "count": int} or None if unavailable
    """
    key = api_key or get_newsapi_key()
    if not key:
        return None
    try:
        collected: List[Dict[str, Any]] = []
        seen_keys = set()
        page = 1
        total_needed = min_items if min_items is not None else page_size

        while page <= max_pages and (len(collected) < total_needed if min_items is not None else page == 1):
            headlines_data = fetch_top_headlines(
                key,
                country=country,
                category=category,
                q=q,
                page_size=page_size,
                page=page,
            )
            articles = headlines_data.get("articles", []) or []
            if not articles:
                break
            for a in articles:
                title = (a.get("title") or "").strip()
                source = ((a.get("source") or {}).get("name") or "").strip()
                dedup_key = f"{title}::{source}"
                if title and dedup_key not in seen_keys:
                    collected.append(a)
                    seen_keys.add(dedup_key)
            # If not enforcing min_items, only first page needed (original behavior)
            if min_items is None:
                break
            page += 1

        if not collected:
            return None

        # Determine how many to include in the prompt
        if min_items is not None:
            selected = collected[:min_items]
        else:
            selected = collected[:page_size]

        lines: List[str] = []
        for idx, a in enumerate(selected, start=1):
            title = (a.get("title") or "").strip()
            source = ((a.get("source") or {}).get("name") or "").strip()
            if title:
                if source:
                    lines.append(f"{idx}. {title} — {source}")
                else:
                    lines.append(f"{idx}. {title}")
        if not lines:
            return None
        block = f"{header_text}\n" + "\n".join(lines)
        prompt = f"{block}\n\n{formatting_instructions}"
        return {"prompt": prompt, "count": len(lines)}
    except Exception:
        return None


def fetch_top_headlines_structured(
    *,
    country: Optional[str] = "us",
    category: Optional[str] = None,
    q: Optional[str] = None,
    page_size: int = 5,
    api_key: Optional[str] = None,
    min_items: Optional[int] = None,
    max_pages: int = 3,
) -> Optional[List[Dict[str, Any]]]:
    """
    Fetch top headlines and return a minimal structured list for UI cards.
    
    Returns a list of items with keys: headline, url, source_name.
    """
    key = api_key or get_newsapi_key()
    if not key:
        return None
    try:
        items: List[Dict[str, Any]] = []
        seen = set()
        needed = min_items if min_items is not None else page_size
        page = 1
        def _strip_trailing_source_from_title(raw_title: str, source_name: str) -> str:
            try:
                title = (raw_title or "").strip()
                src = (source_name or "").strip()
                if not title or not src:
                    return title
                # Exact suffix patterns: " - Source", " — Source", " | Source"
                separators = [" - ", " — ", " | "]
                for sep in separators:
                    suffix = sep + src
                    if title.endswith(suffix):
                        return title[: -len(suffix)].rstrip()
                # Generic: if last segment equals source (case-insensitive), strip it
                for sep in separators:
                    if sep in title:
                        parts = title.rsplit(sep, 1)
                        if len(parts) == 2 and parts[1].strip().lower() == src.lower():
                            return parts[0].rstrip()
                return title
            except Exception:
                return raw_title or ""
        def _normalize(text: str) -> str:
            t = (text or "").lower().strip()
            # remove common punctuation and dots in domains
            for ch in [".", ",", "-", "_", " "]:
                t = t.replace(ch, "")
            # strip common tld tokens
            for token in ["com", "org", "net", "news", "www"]:
                t = t.replace(token, "")
            return t
        def _strip_leading_source_prefix(title: str, source_name: str, url: str) -> str:
            try:
                t = (title or "").strip()
                if not t:
                    return t
                src_norm = _normalize(source_name or "")
                host = ""
                try:
                    host = urlparse(url or "").netloc or ""
                except Exception:
                    host = ""
                host_norm = _normalize(host.replace("www.", ""))
                # Candidate prefixes separated by ': ' or ' - ' or ' | '
                separators = [": ", " - ", " | ", " — "]
                for sep in separators:
                    if sep in t:
                        prefix, rest = t.split(sep, 1)
                        prefix_norm = _normalize(prefix)
                        # If prefix matches source or host, drop it
                        if prefix_norm and (src_norm and (src_norm in prefix_norm or prefix_norm in src_norm) or (host_norm and host_norm in prefix_norm)):
                            return rest.strip()
                return t
            except Exception:
                return title
        def _derive_display_source(source_name: str, url: str) -> str:
            """Derive a human-readable source name, preferring brand over raw domain."""
            try:
                raw = (source_name or "").strip()
                host = ""
                try:
                    host = (urlparse(url or "").netloc or "").lower()
                except Exception:
                    host = ""
                host = host.replace("www.", "")
                # If raw doesn't look like a domain, prefer it
                looks_like_domain = "." in raw or raw.lower().endswith((".com", ".org", ".net", ".co", ".io"))
                base = raw if raw else host
                if not base:
                    return raw
                if looks_like_domain or (raw and raw.lower().replace("www.", "") == host):
                    # Strip common TLDs and separators
                    base_no_tld = base
                    for tld in [".com", ".org", ".net", ".co", ".io"]:
                        if base_no_tld.lower().endswith(tld):
                            base_no_tld = base_no_tld[: -len(tld)]
                            break
                    base_no_tld = base_no_tld.replace(".", " ").replace("-", " ").replace("_", " ").strip()
                    # Mappings for frequent brands
                    mapping = {
                        "nbcsports": "NBC Sports",
                        "foxnews": "Fox News",
                        "cnn": "CNN",
                        "bbc": "BBC",
                        "bbcnews": "BBC News",
                        "nytimes": "The New York Times",
                        "washingtonpost": "The Washington Post",
                        "wsj": "The Wall Street Journal",
                        "apnews": "AP News",
                        "associatedpress": "AP News",
                        "reuters": "Reuters",
                        "espn": "ESPN",
                        "cbsnews": "CBS News",
                        "abcnews": "ABC News",
                    }
                    key = base_no_tld.lower().replace(" ", "")
                    if key in mapping:
                        return mapping[key]
                    # Insert spaces for CamelCase
                    import re as _re
                    s = base_no_tld
                    s = _re.sub(r'(?<=[a-z])(?=[A-Z])', ' ', s)
                    s = _re.sub(r'(?<=[A-Z])(?=[A-Z][a-z])', ' ', s)
                    words = []
                    for w in s.split():
                        if w.isupper() and len(w) <= 4:
                            words.append(w)
                        else:
                            words.append(w.capitalize())
                    pretty = " ".join(words).strip()
                    return pretty if pretty else raw
                return raw
            except Exception:
                return source_name
        while page <= max_pages and len(items) < needed:
            data = fetch_top_headlines(
                key,
                country=country,
                category=category,
                q=q,
                page_size=page_size,
                page=page,
            )
            articles = data.get("articles", []) or []
            if not articles:
                break
            for a in articles:
                raw_title = (a.get("title") or "").strip()
                url = (a.get("url") or "").strip()
                source_name = ((a.get("source") or {}).get("name") or "").strip()
                if not raw_title:
                    continue
                # Remove trailing source suffix from title if present
                title = _strip_trailing_source_from_title(raw_title, source_name)
                # Remove leading source/domain prefix like "CNN:" or "NBCSports.com: "
                title = _strip_leading_source_prefix(title, source_name, url)
                dedup = f"{title}::{source_name}"
                if dedup in seen:
                    continue
                seen.add(dedup)
                display_source = _derive_display_source(source_name, url)
                items.append({
                    "headline": title,
                    "url": url or None,
                    "source_name": display_source or (source_name or None),
                })
                if len(items) >= needed:
                    break
            page += 1
        # Trim to exactly needed if we over-collected
        if len(items) > needed:
            items = items[:needed]
        return items or None
    except Exception:
        return None

def summarize_news_for_agent(
    news_data: Dict[str, Any],
    agent_name: str,
    query: str,
    api_key: Optional[str] = None
) -> str:
    """
    Use Gemini to summarize news articles in the style of the agent.
    
    Args:
        news_data: News data from NewsAPI
        agent_name: Name of the agent (for context)
        query: Original user query
        api_key: Gemini API key (optional)
    
    Returns:
        Summarized news text
    """
    if not news_data or not news_data.get("articles"):
        return ""
    
    articles = news_data["articles"][:5]  # Limit to 5 articles
    
    # Format articles for summarization
    articles_text = []
    for i, article in enumerate(articles, 1):
        title = article.get("title", "No title")
        description = article.get("description", "")
        source = article.get("source", {}).get("name", "Unknown")
        published = article.get("publishedAt", "")[:10]  # Just date
        
        article_text = f"\n{i}. {title}"
        if description:
            article_text += f"\n   {description}"
        article_text += f"\n   Source: {source} ({published})"
        
        articles_text.append(article_text)
    
    articles_summary = "\n".join(articles_text)
    
    # Create summarization prompt
    summary_prompt = f"""The user asked about: "{query}"

Here are recent news articles on this topic:
{articles_summary}

Please provide a brief, age-appropriate summary (2-3 sentences) of the most important recent news on this topic. 
Keep it factual, calm, and suitable for kids/teens. Focus on what happened and why it matters.
Don't include article numbers or sources in the summary - just the key information."""
    
    try:
        if api_key is None:
            api_key = get_gemini_api_key()
        
        if not api_key:
            # Fallback: return first article's description
            if articles and articles[0].get("description"):
                return articles[0]["description"]
            return ""
        
        contents = [{"role": "user", "parts": [summary_prompt]}]
        result = gemini_generate(contents=contents, api_key=api_key)
        
        summary = result.get("text", "").strip()
        return summary
    except Exception as e:
        print(f"Error summarizing news: {e}")
        # Fallback: return first article's description
        if articles and articles[0].get("description"):
            return articles[0]["description"]
        return ""


def get_news_context(message: str, agent_name: str) -> Optional[str]:
    """
    Determine if message needs news and fetch/summarize it.
    
    Args:
        message: User's message
        agent_name: Name of the agent handling the message
    
    Returns:
        News summary string if relevant news found, None otherwise
    """
    message_lower = message.lower().strip()
    
    # Keywords that suggest user wants current news
    news_keywords = [
        "today", "recent", "latest", "news", "happened", "happening",
        "current", "update", "now", "this week", "headlines", "what's",
        "what is", "tell me about", "what happened", "any news"
    ]
    
    # Check if message seems to ask for current news
    wants_news = any(keyword in message_lower for keyword in news_keywords)
    
    # Extract search query from message
    # Remove common question words and news keywords for better search
    search_query = message
    question_words = ["what", "tell", "give", "show", "about", "the", "a", "an"]
    
    # Clean up the query for search
    words = message.split()
    cleaned_words = [w for w in words if w.lower() not in question_words and len(w) > 2]
    
    if cleaned_words:
        search_query = " ".join(cleaned_words)
    else:
        search_query = message
    
    # For Polly (general news agent), always try to fetch news if query is substantial
    agent_lower = agent_name.lower()
    should_fetch = False
    
    if "polly" in agent_lower:
        # Polly should fetch news for most queries
        should_fetch = len(message.strip()) > 3
    elif wants_news:
        # Any agent should fetch if explicitly asking for news
        should_fetch = True
    elif any(word in message_lower for word in ["sports", "game", "match", "team", "player"]) and "flynn" in agent_lower:
        should_fetch = True
    elif any(word in message_lower for word in ["tech", "technology", "ai", "software"]) and "pixel" in agent_lower:
        should_fetch = True
    elif any(word in message_lower for word in ["politics", "election", "government", "policy"]) and "cato" in agent_lower:
        should_fetch = True
    
    print(f"[get_news_context] Message: '{message}', Agent: {agent_name}, Should fetch: {should_fetch}, Search query: '{search_query}'")
    
    if should_fetch:
        print(f"[get_news_context] Fetching news for query: '{search_query}'")
        news_data = fetch_relevant_news(search_query, days_back=3, max_articles=5)
        
        if news_data:
            articles_count = len(news_data.get("articles", []))
            print(f"[get_news_context] Fetched {articles_count} articles")
            
            if articles_count > 0:
                api_key = get_gemini_api_key()
                print(f"[get_news_context] Summarizing news with Gemini...")
                summary = summarize_news_for_agent(news_data, agent_name, message, api_key)
                
                if summary:
                    print(f"[get_news_context] Successfully created news summary ({len(summary)} chars)")
                    return f"\n\n[CURRENT NEWS CONTEXT]\n{summary}"
                else:
                    print(f"[get_news_context] Failed to create summary")
            else:
                print(f"[get_news_context] No articles found")
        else:
            print(f"[get_news_context] Failed to fetch news data (check NewsAPI key)")
    else:
        print(f"[get_news_context] Not fetching news - doesn't match criteria")
    
    return None

