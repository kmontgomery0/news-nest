"""Helper functions for fetching and summarizing news for agents."""

from typing import Optional, Dict, Any, List
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

