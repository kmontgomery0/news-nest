from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import re
import json
import os
from datetime import datetime, timezone

from .config import get_newsapi_key, get_gemini_api_key, get_env_debug
from .newsapi_client import fetch_news
from .agents import POLLY, FLYNN, PIXEL, CATO, PIZZAZZ, EDWIN, CREDO, GAIA, HAPPY, OMNI, CLASSIFIER
from .news_helper import get_news_context
from .chart_helper import detect_chart_or_timeline_intent, generate_chart_data, generate_timeline_data
from .auth import router as auth_router
from .mongo import get_users_collection, get_mongo_client, get_db, get_chat_sessions_collection
from .sportsdb_client import fetch_events_day, fetch_past_league_events
from bson import ObjectId


def _clean_visualization_text(text: str) -> str:
    """
    Clean up LLM text when a chart or timeline visualization is attached.
    
    - Remove placeholder lines like "[GRAPH ... WILL BE GENERATED HERE]".
    - Remove JSON code blocks and raw JSON data.
    - Remove markdown list formatting (bullets, numbered lists, nested lists).
    - Remove markdown formatting (bold, italic).
    - Remove any trailing code, JSON, or extra formatting.
    - Trim down to the first couple of paragraphs to avoid ascii-style chart dumps.
    """
    if not text:
        return text

    # Remove markdown code blocks (```json, ```, etc.) and their content
    # This handles cases where LLM includes JSON code blocks in the response
    text = re.sub(r'```[a-z]*\s*\{.*?\}\s*```', '', text, flags=re.DOTALL | re.IGNORECASE)
    
    # If the whole thing is wrapped in a markdown code block, drop it entirely.
    stripped = text.strip()
    if stripped.startswith("```"):
        # Keep any text before the first fence, drop fenced content.
        parts = stripped.split("```", 1)
        pre = parts[0].strip()
        if pre:
            return pre
        # If nothing before, try to find text after the code block
        if len(parts) > 1:
            after = parts[1].split("```", 1)
            if len(after) > 1:
                return after[1].strip()
        return ""

    # Drop any placeholder "[GRAPH ...]" lines and obvious JSON chart blobs,
    # and remove outdated capability disclaimers about not being able to
    # display charts (the frontend will handle rendering).
    lines = []
    for line in text.splitlines():
        lower = line.lower().strip()
        
        # Skip empty lines after we've started cleaning
        if not lower and len(lines) == 0:
            continue
            
        # Remove graph/chart placeholders
        if "[graph" in lower or "[chart" in lower or "[visualization" in lower:
            continue
            
        # Remove common "I can't show charts" style sentences
        if (
            "as an ai" in lower
            and ("cannot display" in lower or "not able to" in lower or "can't" in lower)
        ) or "not able to generate visual" in lower or "can't actually display" in lower:
            continue
            
        # Drop standalone JSON-looking chart configs (lines that are just JSON)
        if lower.startswith("{") and lower.endswith("}"):
            # Check if it looks like chart/timeline JSON
            if "data_points" in lower or "events" in lower or "title" in lower:
                continue
                
        # Skip lines that are just JSON keys/values
        if re.match(r'^\s*["\']?(title|description|data_points|events|x_axis|y_axis)["\']?\s*[:=]', lower):
            continue
        
        # Remove markdown list items (bullets, numbered lists, nested lists)
        # This catches lines like "*   **18th Century:**" or "    *   Philosophers like..."
        # Handle both unindented and indented list items
        if re.match(r'^\s*([*\-]|\d+[.)])\s+', line):
            continue
        
        # Remove lines that are just markdown formatting (bold/italic headers)
        # This catches lines like "**18th Century: Early stirrings**"
        if re.match(r'^\s*\*\*.*\*\*\s*$', line):
            continue
        
        # Remove lines that start with indentation and contain list-like content
        # This catches nested list items like "    *   Philosophers like..."
        if re.match(r'^\s{2,}([*\-]|\d+[.)])\s+', line):
            continue
            
        lines.append(line)
    
    cleaned = "\n".join(lines).strip()
    if not cleaned:
        return ""

    # Remove markdown formatting (bold **text**, italic *text* or _text_)
    # But preserve the text content
    cleaned = re.sub(r'\*\*([^*]+)\*\*', r'\1', cleaned)  # Remove bold **text**
    cleaned = re.sub(r'\*([^*]+)\*', r'\1', cleaned)  # Remove italic *text* (but not if it's part of **)
    cleaned = re.sub(r'_([^_]+)_', r'\1', cleaned)  # Remove italic _text_

    # Remove any trailing fenced JSON/code block if present
    if "```" in cleaned:
        # Split on first code fence and take only what's before it
        cleaned = cleaned.split("```", 1)[0].strip()
        if not cleaned:
            return ""
    
    # Remove any trailing JSON objects that might have been missed
    # Look for JSON-like structures at the end
    cleaned = re.sub(r'\s*\{[^{}]*"title"[^{}]*\{[^{}]*\}[^{}]*\}\s*$', '', cleaned, flags=re.DOTALL)
    cleaned = cleaned.strip()
    
    # Remove trailing markdown formatting
    cleaned = re.sub(r'\s*```.*$', '', cleaned, flags=re.DOTALL)
    cleaned = cleaned.strip()

    # Keep at most the first 2–3 paragraphs so we don't show raw value dumps
    paragraphs = [p.strip() for p in cleaned.split("\n\n") if p.strip()]
    if not paragraphs:
        return cleaned
    
    # Filter out paragraphs that look like JSON or code
    filtered_paragraphs = []
    for para in paragraphs:
        para_lower = para.lower().strip()
        # Skip paragraphs that are mostly JSON
        if para_lower.startswith("{") or para_lower.startswith("["):
            continue
        # Skip paragraphs that are just code blocks
        if para_lower.startswith("```"):
            continue
        # Skip very short paragraphs that are just formatting
        if len(para.strip()) < 10 and any(c in para for c in ["{", "}", "[", "]", "```"]):
            continue
        filtered_paragraphs.append(para)
        # Stop after 2-3 good paragraphs
        if len(filtered_paragraphs) >= 3:
            break
    
    if not filtered_paragraphs:
        return cleaned
    
    kept = "\n\n".join(filtered_paragraphs)
    return kept.strip()


app = FastAPI(title="News Nest API", version="0.1.0")

# Enable CORS for local/mobile development; tighten in production as needed.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # replace with specific origins for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router, prefix="/auth", tags=["auth"])

@app.get("/test-news")
def test_news_fetch(q: str = "sports"):
    """Test endpoint to verify news fetching works."""
    from .news_helper import fetch_relevant_news, summarize_news_for_agent
    
    api_key = get_newsapi_key()
    if not api_key:
        return {"error": "No NewsAPI key found. Set NEWSAPI_KEY in .env file"}
    
    print(f"[test-news] Testing news fetch for query: '{q}'")
    news_data = fetch_relevant_news(q, days_back=3, max_articles=5)
    
    if not news_data:
        return {"error": "Failed to fetch news", "api_key_set": bool(api_key)}
    
    articles_count = len(news_data.get("articles", []))
    
    if articles_count == 0:
        return {
            "success": False,
            "message": "No articles found",
            "api_key_set": bool(api_key),
            "news_data_keys": list(news_data.keys()) if news_data else []
        }
    
    # Try to summarize
    gemini_key = get_gemini_api_key()
    summary = summarize_news_for_agent(news_data, "Polly the Parrot", q, gemini_key)
    
    return {
        "success": True,
        "articles_count": articles_count,
        "query": q,
        "summary": summary,
        "first_article": news_data.get("articles", [])[0] if news_data.get("articles") else None,
        "api_keys": {
            "newsapi": bool(api_key),
            "gemini": bool(gemini_key)
        }
    }


@app.get("/debug/env")
def debug_env():
    """Safe environment diagnostics (no secrets)."""
    return get_env_debug()

@app.get("/debug/db")
def debug_db():
    """Minimal DB connectivity check and users count."""
    try:
        client = get_mongo_client()
        db = get_db()
        # A very light ping and count
        client.admin.command("ping")
        users = get_users_collection()
        count = users.count_documents({})
        return {
            "connected": True,
            "db_name": db.name,
            "users_count": count,
            "indexes": users.index_information(),
        }
    except Exception as exc:
        return {"connected": False, "error": str(exc)}


class SportsTeam(BaseModel):
    id: Optional[str] = None
    name: str
    shortName: Optional[str] = None
    badgeUrl: Optional[str] = None


class SportsGame(BaseModel):
    id: Optional[str] = None
    sport: Optional[str] = None
    leagueId: Optional[str] = None
    leagueName: Optional[str] = None
    date: Optional[str] = None  # ISO date
    timeLocal: Optional[str] = None
    status: str  # 'past' | 'live' | 'upcoming'
    venueName: Optional[str] = None
    homeTeam: Dict[str, Any]
    awayTeam: Dict[str, Any]
    homeScore: Optional[int] = None
    awayScore: Optional[int] = None


class SportsScoreboardResponse(BaseModel):
    date: str
    games: List[SportsGame]


@app.get("/sports/scoreboard", response_model=SportsScoreboardResponse)
def get_sports_scoreboard(
    league: str = Query(..., description="League name or ID as used by TheSportsDB (e.g., 'NBA' or '4328')"),
    date: Optional[str] = Query(None, description="Date in YYYY-MM-DD format; defaults to today's date (UTC)."),
    sport: Optional[str] = Query(None, description="Optional sport filter (e.g., 'Basketball')"),
):
    """
    Fetch a simple scoreboard (list of games) for a given league and date from TheSportsDB.

    This is a thin wrapper around the `eventsday.php` endpoint and normalizes the
    response into `SportsGame` items for the frontend to render.
    """
    try:
        if not date:
            # Use today's date in UTC by default
            now = datetime.now(timezone.utc)
            date = now.date().isoformat()
        games_raw = fetch_events_day(date_iso=date, sport=sport, league=league)
        # Pydantic will validate/shape each dict into a SportsGame
        return SportsScoreboardResponse(date=date, games=games_raw)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Error fetching scoreboard: {str(exc)}")


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


# Agent-related models
class ChatRequest(BaseModel):
    agent: str
    message: str
    conversation_history: Optional[List[Dict[str, Any]]] = None
    api_key: Optional[str] = None
    user_name: Optional[str] = None
    parrot_name: Optional[str] = None


class ChartDataPoint(BaseModel):
    """A single data point for a chart."""
    label: str
    value: float
    timestamp: Optional[str] = None  # For time-series data (ISO format)


class TimelineEvent(BaseModel):
    """A single event in a timeline."""
    date: str  # ISO format date string
    title: str
    description: Optional[str] = None
    category: Optional[str] = None


class ChartData(BaseModel):
    """Structured chart data."""
    type: str  # "line", "bar", "pie", "area", etc.
    title: str
    x_axis_label: Optional[str] = None
    y_axis_label: Optional[str] = None
    data_points: List[ChartDataPoint]
    description: Optional[str] = None  # Context about what the chart shows


class TimelineData(BaseModel):
    """Structured timeline data."""
    title: str
    events: List[TimelineEvent]
    description: Optional[str] = None  # Context about the timeline


class SportsTeam(BaseModel):
    id: Optional[str] = None
    name: str
    shortName: Optional[str] = None
    badgeUrl: Optional[str] = None


class SportsGame(BaseModel):
    id: Optional[str] = None
    sport: Optional[str] = None
    leagueId: Optional[str] = None
    leagueName: Optional[str] = None
    date: Optional[str] = None  # ISO date
    timeLocal: Optional[str] = None
    status: str  # 'past' | 'live' | 'upcoming'
    venueName: Optional[str] = None
    homeTeam: Dict[str, Any]
    awayTeam: Dict[str, Any]
    homeScore: Optional[int] = None
    awayScore: Optional[int] = None


class SportsScoreboardResponse(BaseModel):
    date: str
    games: List[SportsGame]


class ChatResponse(BaseModel):
    agent: str
    response: str
    error: Optional[str] = None
    routing_message: Optional[str] = None
    routed_from: Optional[str] = None
    has_article_reference: Optional[bool] = False
    # Optional: structured articles for UI cards
    articles: Optional[list] = None
    # Optional: chart data for visualization
    chart: Optional[ChartData] = None
    # Optional: timeline data for visualization
    timeline: Optional[TimelineData] = None
    # Optional: sports scoreboard data (e.g., latest NFL/NBA scores)
    scoreboard: Optional[SportsScoreboardResponse] = None


# Agent mapping
AGENTS = {
    "polly": POLLY,
    "flynn": FLYNN,
    "pixel": PIXEL,
    "cato": CATO,
    "pizzazz": PIZZAZZ,
    "edwin": EDWIN,
    "credo": CREDO,
    "gaia": GAIA,
    "happy": HAPPY,
    "omni": OMNI,
}

# Map human-readable agent names to ids
AGENT_NAME_TO_ID = {
    "polly": "polly",
    "polly the parrot": "polly",
    "flynn": "flynn",
    "flynn the falcon": "flynn",
    "pixel": "pixel",
    "pixel the pigeon": "pixel",
    "cato": "cato",
    "cato the crane": "cato",
    "pizzazz": "pizzazz",
    "pizzazz the peacock": "pizzazz",
    "edwin": "edwin",
    "edwin the eagle": "edwin",
    "credo": "credo",
    "credo the crow": "credo",
    "gaia": "gaia",
    "gaia the goose": "gaia",
    "happy": "happy",
    "happy the hummingbird": "happy",
    "omni": "omni",
    "omni the owl": "omni",
}

@app.get("/agents/polly/welcome", response_model=ChatResponse)
async def polly_welcome(api_key: Optional[str] = None):
    """Return Polly's first welcome message with today's top headlines (no user message required)."""
    agent = POLLY
    key = api_key or get_gemini_api_key()
    if not key:
        raise HTTPException(
            status_code=400,
            detail="GEMINI_API_KEY not set. Provide it as a query param or set it in .env."
        )
    # Minimal starter content; PollyAgent will inject headlines on first message
    contents: List[Dict[str, Any]] = [{"role": "user", "parts": ["Start"]}]
    try:
        result = agent.respond(contents=contents, api_key=key, is_first_message=True)
        return ChatResponse(agent=agent.name, response=result.get("text", ""))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@app.post("/agents/chat", response_model=ChatResponse)
async def chat_with_agent(request: ChatRequest):
    # Content moderation: check if user message is appropriate
    from .content_moderation import moderate_content
    import logging
    logger = logging.getLogger(__name__)
    
    is_appropriate, moderation_reason = moderate_content(request.message, api_key=request.api_key)
    if not is_appropriate:
        logger.warning(f"[content_moderation] Blocked inappropriate message from agent '{request.agent}': {request.message[:100]}")
        raise HTTPException(
            status_code=400,
            detail=moderation_reason or "Your message contains inappropriate content. Please rephrase your question in a respectful way."
        )
    """Chat with a specific agent."""
    agent_name = request.agent.lower()
    
    if agent_name not in AGENTS:
        raise HTTPException(
            status_code=404,
            detail=f"Agent '{request.agent}' not found. Available agents: {', '.join(AGENTS.keys())}"
        )
    
    agent = AGENTS[agent_name]
    api_key = request.api_key or get_gemini_api_key()
    
    if not api_key:
        raise HTTPException(
            status_code=400,
            detail="GEMINI_API_KEY not set. Provide it in the request or set it in .env file."
        )
    
    try:
        # Build conversation history - include previous messages and current message
        contents = []
        
        # Add conversation history if provided
        if request.conversation_history:
            print(f"[chat_with_agent] Received conversation history with {len(request.conversation_history)} items")
            # Validate and add history messages
            for item in request.conversation_history:
                if isinstance(item, dict) and "role" in item and "parts" in item:
                    # Ensure role is 'user' or 'model'
                    role = item["role"]
                    if role not in ["user", "model"]:
                        # Try to map agent/user to model/user
                        if role == "agent":
                            role = "model"
                        else:
                            role = "user"
                    
                    # Ensure parts is a list
                    parts = item["parts"]
                    if not isinstance(parts, list):
                        parts = [str(parts)]
                    
                    # Strip agent metadata from parts before sending to Gemini
                    # Format: "text [Agent: Name]" -> "text"
                    cleaned_parts = []
                    for part in parts:
                        part_str = str(part)
                        # Remove [Agent: Name] metadata pattern
                        cleaned = re.sub(r'\s*\[Agent:\s*[^\]]+\]\s*$', '', part_str, flags=re.IGNORECASE)
                        cleaned_parts.append(cleaned.strip())
                    
                    contents.append({
                        "role": role,
                        "parts": cleaned_parts
                    })
        else:
            print(f"[chat_with_agent] No conversation history provided")
        
        # Check if we should fetch current news for this message
        print(f"[chat_with_agent] Checking news context for message: '{request.message}', agent: {agent.name}")
        news_context = get_news_context(request.message, agent.name)
        
        # Add current message (with news context if available)
        user_message = request.message
        if news_context:
            user_message = user_message + news_context
            print(f"[chat_with_agent] Added news context to message (length: {len(news_context)} chars)")
        else:
            print(f"[chat_with_agent] No news context added")
        
        contents.append({"role": "user", "parts": [user_message]})
        print(f"[chat_with_agent] Total conversation context: {len(contents)} messages")
        
        # Check if this is the first message (no conversation history)
        is_first_message = not request.conversation_history or len(request.conversation_history) == 0
        
        result = agent.respond(
            contents=contents, 
            api_key=api_key, 
            is_first_message=is_first_message,
            user_name=request.user_name,
            parrot_name=request.parrot_name
        )
        
        has_ref = result.get("has_article_reference", False)
        print(f"[chat_with_agent] Result has_article_reference={has_ref}, result keys: {list(result.keys())}")
        
        # Check if user wants a chart or timeline visualization
        chart_data = None
        timeline_data = None
        visualization_note = ""
        
        # Only check for visualizations for agents that support them (Omni, Gaia, Edwin, etc.)
        visualization_agents = ["omni", "gaia", "edwin", "pixel", "cato"]
        if agent_name.lower() in visualization_agents:
            viz_intent = detect_chart_or_timeline_intent(request.message, agent.name, api_key)
            if viz_intent.get("needs_visualization"):
                viz_type = viz_intent.get("visualization_type")
                topic = viz_intent.get("topic", "")
                
                if viz_type == "chart":
                    chart_type = viz_intent.get("chart_type", "line")
                    chart_data_dict = generate_chart_data(topic, chart_type, news_context, api_key)
                    if chart_data_dict:
                        chart_data = ChartData(**chart_data_dict)
                        print(f"[chat_with_agent] Generated {chart_type} chart: {chart_data.title}")
                    else:
                        # Help build data literacy when a chart isn't actually suitable
                        visualization_note = (
                            "Note: A chart might seem helpful here, but we don't have clear, reliable "
                            "numeric data to plot without making up values. When you see graphs in the news, "
                            "it's important to check what data they are based on and whether the numbers are "
                            "actually available."
                        )
                
                elif viz_type == "timeline":
                    timeline_data_dict = generate_timeline_data(topic, news_context, api_key)
                    if timeline_data_dict:
                        timeline_data = TimelineData(**timeline_data_dict)
                        print(f"[chat_with_agent] Generated timeline: {timeline_data.title}")
                    else:
                        visualization_note = (
                            "Note: For this question, a timeline of specific dated events isn't a great fit. "
                            "Many explanations in the news are about ongoing situations rather than clear, "
                            "timestamped milestones, so it's worth asking whether a timeline might oversimplify things."
                        )
        
        # Use custom parrot name if provided and agent is Polly
        agent_display_name = agent.name
        if agent_name == "polly" and request.parrot_name:
            agent_display_name = f"{request.parrot_name} the Parrot"

        # Clean text if a visualization is attached to avoid graph placeholders
        response_text = result.get("text", "")
        if chart_data or timeline_data:
            response_text = _clean_visualization_text(response_text)
        # If we tried but couldn't generate a suitable visualization, add a short
        # literacy note explaining why a chart/timeline may not be appropriate.
        if visualization_note and not (chart_data or timeline_data):
            if response_text:
                response_text = response_text.rstrip() + "\n\n" + visualization_note
            else:
                response_text = visualization_note

        return ChatResponse(
            agent=agent_display_name,
            response=response_text,
            has_article_reference=has_ref,
            chart=chart_data,
            timeline=timeline_data,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@app.get("/agents/list")
async def list_agents():
    """List all available agents."""
    return {
        "agents": [
            {
                "id": agent_id,
                "name": agent.name,
                "description": agent.get_system_prompt()[:100] + "..."
            }
            for agent_id, agent in AGENTS.items()
        ]
    }


class RouteRequest(BaseModel):
    message: str
    api_key: Optional[str] = None


class RouteResponse(BaseModel):
    suggested_agent: str
    agent_name: str
    confidence: Optional[str] = None
    reasoning: Optional[str] = None
    alternative_agents: Optional[List[str]] = None


@app.post("/agents/route", response_model=RouteResponse)
async def route_message(request: RouteRequest):
    """Automatically route a message to the most appropriate agent based on topic detection."""
    api_key = request.api_key or get_gemini_api_key()
    
    if not api_key:
        raise HTTPException(
            status_code=400,
            detail="GEMINI_API_KEY not set. Provide it in the request or set it in .env file."
        )
    
    # Use Polly to analyze and suggest routing
    routing_prompt = f"""Analyze this user message and determine which specialist agent should handle it.

Available agents:
- polly (Polly the Parrot): General news, headlines, greetings, general questions
- flynn (Flynn the Falcon): Sports, games, athletics, scores, sports analysis
- pixel (Pixel the Pigeon): Technology, gadgets, AI, software, tech innovations
- cato (Cato the Crane): Politics, elections, government, policies, civic affairs
- pizzazz (Pizzazz the Peacock): Entertainment, pop culture, celebrities, lifestyle, movies, music, TV shows
- edwin (Edwin the Eagle): Business, economy, markets, companies, financial news, economic trends
- credo (Credo the Crow): Crime, legal matters, justice, law, legal news, court cases
- gaia (Gaia the Goose): Science, environment, climate, discoveries, research, nature, sustainability
- happy (Happy the Hummingbird): Feel-good stories, uplifting news, positive stories, human interest, inspirational
- omni (Omni the Owl): History, historical trends, cultural analysis, connecting past to present

User message: "{request.message}"

Respond ONLY with a JSON object in this exact format:
{{
    "suggested_agent": "agent_id (polly/flynn/pixel/cato/pizzazz/edwin/credo/gaia/happy/omni)",
    "confidence": "high/medium/low",
    "reasoning": "brief explanation why this agent is best",
    "alternative_agents": ["other_agent_id_if_relevant"]
}}"""

    try:
        from .gemini import gemini_generate
        contents = [{"role": "user", "parts": [routing_prompt]}]
        result = gemini_generate(contents=contents, api_key=api_key)
        response_text = result.get("text", "")
        
        # Try to extract JSON from response
        import json
        import re
        
        # Find JSON in the response (handle cases where there's extra text)
        json_match = re.search(r'\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}', response_text, re.DOTALL)
        if json_match:
            routing_data = json.loads(json_match.group())
            suggested_agent_id = routing_data.get("suggested_agent", "polly").lower()
            
            # Validate the suggested agent exists
            if suggested_agent_id not in AGENTS:
                suggested_agent_id = "polly"
            
            # Fallback: simple keyword-based routing
            message_lower = request.message.lower()
            if any(word in message_lower for word in ["sport", "game", "team", "player", "score", "football", "basketball", "soccer"]):
                suggested_agent_id = "flynn"
            elif any(word in message_lower for word in ["tech", "technology", "ai", "software", "app", "digital", "computer", "code"]):
                suggested_agent_id = "pixel"
            elif any(word in message_lower for word in ["politic", "election", "government", "policy", "vote", "civic", "senate", "congress"]):
                suggested_agent_id = "cato"
            elif any(word in message_lower for word in ["entertainment", "celebrity", "movie", "music", "tv", "show", "pop culture", "celebrity", "actor", "singer"]):
                suggested_agent_id = "pizzazz"
            elif any(word in message_lower for word in ["business", "economy", "market", "stock", "company", "financial", "economic", "trade"]):
                suggested_agent_id = "edwin"
            elif any(word in message_lower for word in ["crime", "legal", "court", "law", "justice", "trial", "lawsuit", "arrest"]):
                suggested_agent_id = "credo"
            elif any(word in message_lower for word in ["science", "environment", "climate", "research", "discovery", "nature", "sustainability", "planet"]):
                suggested_agent_id = "gaia"
            elif any(word in message_lower for word in ["feel-good", "uplifting", "positive", "heartwarming", "inspirational", "good news", "kindness"]):
                suggested_agent_id = "happy"
            elif any(word in message_lower for word in ["history", "historical", "past", "trend", "cultural", "tradition", "ancient"]):
                suggested_agent_id = "omni"
            
            return RouteResponse(
                suggested_agent=suggested_agent_id,
                agent_name=AGENTS[suggested_agent_id].name,
                confidence="medium",
                reasoning="Keyword-based routing fallback"
            )
            
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Error routing message: {str(exc)}")


def detect_current_agent_from_history(conversation_history: Optional[List[Dict[str, Any]]] = None) -> Optional[str]:
    """Detect which agent the user was last talking to based on conversation history."""
    if not conversation_history or len(conversation_history) == 0:
        return None
    
    # Look for agent names in the conversation history
    # Agent names may appear in model responses (e.g., "Polly the Parrot: ..." or just in content)
    agent_name_to_id = {
        "polly": "polly",
        "polly the parrot": "polly",
        "flynn": "flynn",
        "flynn the falcon": "flynn",
        "pixel": "pixel",
        "pixel the pigeon": "pixel",
        "cato": "cato",
        "cato the crane": "cato",
    }
    
    # Check last few messages for agent mentions
    # Look at the last model response to see which agent was talking
    for item in reversed(conversation_history[-10:]):  # Check last 10 messages
        if isinstance(item, dict) and item.get("role") == "model":
            parts = item.get("parts", [])
            if parts:
                text = " ".join(parts) if isinstance(parts, list) else str(parts)
                text_lower = text.lower()
                
                # Check if agent name appears in metadata format (e.g., "[Agent: Polly the Parrot]")
                # This is how we encode agent names in conversation history
                agent_metadata_pattern = r'\[agent:\s*([^\]]+)\]'
                match = re.search(agent_metadata_pattern, text_lower)
                if match:
                    agent_name_found = match.group(1).strip()
                    for agent_name, agent_id in agent_name_to_id.items():
                        if agent_name in agent_name_found.lower():
                            return agent_id
                
                # Check if agent name appears at start (e.g., "Polly the Parrot: ...")
                for agent_name, agent_id in agent_name_to_id.items():
                    if text_lower.startswith(agent_name.lower() + ":") or text_lower.startswith(agent_name.lower() + " "):
                        return agent_id
                
                # Also check if agent name appears anywhere in the response
                for agent_name, agent_id in agent_name_to_id.items():
                    if agent_name in text_lower:
                        return agent_id
    
    # Fallback: use keyword detection on last few messages
    # Look at recent user messages to infer which agent they're talking to
    recent_user_messages = [item for item in conversation_history[-6:] if isinstance(item, dict) and item.get("role") == "user"]
    
    if recent_user_messages:
        # Check the most recent user message
        last_user_msg = recent_user_messages[-1]
        parts = last_user_msg.get("parts", [])
        if parts:
            text = " ".join(parts) if isinstance(parts, list) else str(parts)
            text_lower = text.lower()
            
            # Quick keyword-based detection
            if any(word in text_lower for word in ["sport", "game", "team", "player", "score", "football", "basketball", "soccer"]):
                return "flynn"
            elif any(word in text_lower for word in ["tech", "technology", "ai", "software", "app", "digital", "computer", "code"]):
                return "pixel"
            elif any(word in text_lower for word in ["politic", "election", "government", "policy", "vote", "civic"]):
                return "cato"
    
    return None


class SaveChatRequest(BaseModel):
    email: str
    history: List[Dict[str, Any]]
    parrot_name: Optional[str] = None
    session_id: Optional[str] = None  # If provided, update existing session instead of creating new one


def extract_birds_from_history(history: List[Dict[str, Any]]) -> List[str]:
    """Extract agent IDs involved in the conversation from history parts metadata."""
    birds: set[str] = set()
    # Scan all model messages and look for agent tags or names
    for item in history:
        if not isinstance(item, dict):
            continue
        role = item.get("role")
        parts = item.get("parts") or []
        if role != "model":
            continue
        text = " ".join([str(p) for p in parts]).lower()
        # Metadata pattern "[Agent: Name]"
        meta_match = re.search(r'\[agent:\s*([^\]]+)\]', text)
        if meta_match:
            name = meta_match.group(1).strip().lower()
            for human, agent_id in AGENT_NAME_TO_ID.items():
                if human in name:
                    birds.add(agent_id)
        # Also check plain names
        for human, agent_id in AGENT_NAME_TO_ID.items():
            if human in text:
                birds.add(agent_id)
    # Always include polly if nothing detected (host)
    if not birds:
        birds.add("polly")
    return sorted(list(birds))


def generate_chat_title(history: List[Dict[str, Any]], parrot_name: Optional[str] = None) -> str:
    """
    Use Gemini to generate a concise, descriptive title for the chat.
    Falls back to a heuristic if no API key or on error.
    """
    api_key = get_gemini_api_key()
    # Build a compact transcript snippet (last ~12 entries) for titling
    recent = history[-12:] if len(history) > 12 else history
    lines: List[str] = []
    for item in recent:
        if not isinstance(item, dict) or "role" not in item or "parts" not in item:
            continue
        role = "User" if item["role"] == "user" else "Assistant"
        text = " ".join([str(p) for p in (item["parts"] or [])])
        # Strip metadata
        text = re.sub(r'\s*\[Agent:\s*[^\]]+\]\s*$', '', text, flags=re.IGNORECASE)
        # Truncate long lines
        if len(text) > 200:
            text = text[:200] + "..."
        lines.append(f"{role}: {text}")
    transcript = "\n".join(lines)[:2000]  # hard cap

    if not api_key:
        # Heuristic fallback: first user line or generic
        first_user = next((re.sub(r'^User:\s*', '', l) for l in lines if l.startswith("User:")), "")
        simple = first_user.strip()[:60] if first_user else "News Nest Conversation"
        return simple if simple else "News Nest Conversation"

    try:
        from .gemini import gemini_generate
        system_prompt = (
            "You create short, descriptive chat titles for a conversation between a user "
            f"and a news assistant{' named ' + parrot_name if parrot_name else ''}. "
            "Requirements:\n"
            "- 5 to 9 words, concise and specific\n"
            "- No quotes, punctuation minimal, Title Case\n"
            "- Reflect the main topic(s) discussed\n"
            "- Avoid generic words like 'Chat', 'Conversation'\n"
        )
        user_prompt = f"Create a title for this conversation:\n\n{transcript}\n\nTitle:"
        result = gemini_generate(contents=[{"role": "user", "parts": [user_prompt]}], system_prompt=system_prompt, api_key=api_key)
        title = (result.get("text") or "").strip().splitlines()[0]
        # Clean title
        title = title.strip().strip('"').strip("'")
        # Guardrails
        if not title or len(title) < 3:
            raise ValueError("Empty title")
        if len(title) > 80:
            title = title[:80]
        return title
    except Exception:
        # Fallback on error: simple heuristic
        first_user = next((re.sub(r'^User:\s*', '', l) for l in lines if l.startswith("User:")), "")
        simple = first_user.strip()[:60] if first_user else "News Nest Conversation"
        return simple if simple else "News Nest Conversation"


@app.post("/chats/save")
def save_chat(payload: SaveChatRequest):
    """
    Persist a chat session with a descriptive title and involved birds.
    'history' should be a list of items like { role: 'user'|'model', parts: [text] }.
    If session_id is provided, updates the existing session; otherwise creates a new one.
    """
    email = (payload.email or "").strip().lower()
    if not email:
        raise HTTPException(status_code=400, detail="Email is required.")
    history = payload.history or []
    if not isinstance(history, list) or len(history) == 0:
        raise HTTPException(status_code=400, detail="History must be a non-empty list.")
    
    coll = get_chat_sessions_collection()
    now = datetime.now(timezone.utc)
    
    # Generate title and birds
    birds = extract_birds_from_history(history)
    title = generate_chat_title(history, parrot_name=payload.parrot_name)
    
    # If session_id is provided, update existing session
    if payload.session_id:
        try:
            from bson import ObjectId
            session_oid = ObjectId(payload.session_id)
            # Verify the session belongs to this user
            existing = coll.find_one({"_id": session_oid, "email": email})
            if not existing:
                raise HTTPException(status_code=404, detail="Chat session not found or access denied.")
            
            # Update the existing session
            update_doc = {
                "$set": {
                    "title": title,
                    "birds": birds,
                    "messages": history,
                    "updated_at": now,
                }
            }
            coll.update_one({"_id": session_oid, "email": email}, update_doc)
            
            return {
                "success": True,
                "id": payload.session_id,
                "title": title,
                "birds": birds,
            }
        except Exception as e:
            # If ObjectId is invalid or update fails, fall through to create new session
            if isinstance(e, HTTPException):
                raise
            # Invalid session_id format - create new session instead
            pass
    
    # Create new session
    doc = {
        "email": email,
        "title": title,
        "birds": birds,
        "messages": history,
        "created_at": now,
        "updated_at": now,
    }
    result = coll.insert_one(doc)
    return {
        "success": True,
        "id": str(result.inserted_id),
        "title": title,
        "birds": birds,
    }


@app.get("/chats/history")
def get_chat_history(email: str):
    """Return saved chat sessions for a user, newest first."""
    normalized = (email or "").strip().lower()
    if not normalized:
        raise HTTPException(status_code=400, detail="Email is required.")
    coll = get_chat_sessions_collection()
    cursor = coll.find({"email": normalized}, {"messages": 0}).sort("updated_at", -1)
    sessions = []
    for doc in cursor:
        sessions.append({
            "id": str(doc.get("_id")),
            "title": doc.get("title") or "Conversation",
            "birds": doc.get("birds") or [],
            "updated_at": doc.get("updated_at").isoformat() if doc.get("updated_at") else None,
            "created_at": doc.get("created_at").isoformat() if doc.get("created_at") else None,
        })
    return {"sessions": sessions}


@app.get("/chats/session")
def get_chat_session(id: str, email: str):
    """Fetch a single chat session by id for a given user, including messages."""
    normalized = (email or "").strip().lower()
    if not normalized:
        raise HTTPException(status_code=400, detail="Email is required.")
    try:
        oid = ObjectId(id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid chat id.")
    coll = get_chat_sessions_collection()
    doc = coll.find_one({"_id": oid, "email": normalized})
    if not doc:
        raise HTTPException(status_code=404, detail="Chat not found.")
    # Return messages as saved, plus basic metadata
    messages = doc.get("messages") or []
    return {
        "id": str(doc.get("_id")),
        "title": doc.get("title") or "Conversation",
        "birds": doc.get("birds") or [],
        "messages": messages,
        "updated_at": doc.get("updated_at").isoformat() if doc.get("updated_at") else None,
        "created_at": doc.get("created_at").isoformat() if doc.get("created_at") else None,
    }
@app.post("/agents/route-only")
async def route_only(request: ChatRequest):
    """Smart routing endpoint using Gemini API to detect topic changes and route appropriately."""
    api_key = request.api_key or get_gemini_api_key()
    
    if not api_key:
        raise HTTPException(
            status_code=400,
            detail="GEMINI_API_KEY not set. Provide it in the request or set it in .env file."
        )
    
    # Detect current agent from conversation history
    current_agent_id = detect_current_agent_from_history(request.conversation_history)
    
    # If not detectable from history, fall back to the requested agent id
    if not current_agent_id:
        try:
            candidate = (request.agent or "").lower()
            if candidate in AGENTS:
                current_agent_id = candidate
        except Exception:
            current_agent_id = None
    
    # Build context for routing decision
    conversation_context = ""
    if request.conversation_history and len(request.conversation_history) > 0:
        # Get last few messages for context (last 3-4 exchanges)
        recent_messages = request.conversation_history[-6:]  # Last 6 items (3 exchanges)
        context_parts = []
        for item in recent_messages:
            if isinstance(item, dict) and "role" in item and "parts" in item:
                parts = item["parts"]
                if not isinstance(parts, list):
                    parts = [str(parts)]
                # Strip agent metadata
                text = " ".join(str(p) for p in parts)
                text = re.sub(r'\s*\[Agent:\s*[^\]]+\]\s*$', '', text, flags=re.IGNORECASE)
                role = "User" if item["role"] == "user" else "Assistant"
                context_parts.append(f"{role}: {text.strip()}")
        if context_parts:
            conversation_context = "\n".join(context_parts)
    
    # Use Gemini API for intelligent routing based on topic detection
    routing_prompt = f"""You are an intelligent router for a news conversation system. Analyze the user's message and the conversation context to determine which specialist agent should handle it.

Available agents:
- polly (Polly the Parrot): General news, headlines, greetings, general questions, non-specialized topics
- flynn (Flynn the Falcon): Sports, games, athletics, scores, sports analysis, sports news, teams, players
- pixel (Pixel the Pigeon): Technology, gadgets, AI, software, tech innovations, coding, digital products, tech news
- cato (Cato the Crane): Politics, elections, government, policies, civic affairs, political news, governance
- pizzazz (Pizzazz the Peacock): Entertainment, pop culture, celebrities, lifestyle, movies, music, TV shows, entertainment news
- edwin (Edwin the Eagle): Business, economy, markets, companies, financial news, economic trends, stocks, trade
- credo (Credo the Crow): Crime, legal matters, justice, law, legal news, court cases, trials, lawsuits
- gaia (Gaia the Goose): Science, environment, climate, discoveries, research, nature, sustainability, environmental news
- happy (Happy the Hummingbird): Feel-good stories, uplifting news, positive stories, human interest, inspirational news
- omni (Omni the Owl): History, historical trends, cultural analysis, connecting past to present, historical context

Current conversation context:
{conversation_context if conversation_context else "This is the start of the conversation."}

Current message: "{request.message}"

IMPORTANT ROUTING RULES:
1. Detect ANY topic shift to a specialized domain - even subtle ones
2. If the user asks about sports (even indirectly), route to flynn
3. If the user asks about technology/tech (even indirectly), route to pixel
4. If the user asks about politics/government (even indirectly), route to cato
5. If the user asks about entertainment/pop culture (even indirectly), route to pizzazz
6. If the user asks about business/economy (even indirectly), route to edwin
7. If the user asks about crime/legal matters (even indirectly), route to credo
8. If the user asks about science/environment (even indirectly), route to gaia
9. If the user asks for feel-good/uplifting news (even indirectly), route to happy
10. If the user asks about history/historical context (even indirectly), route to omni
11. If continuing the same topic with the current specialist, stay with that specialist
12. If the topic is general news or unclear, route to polly

Respond ONLY with a JSON object in this exact format:
{{
    "suggested_agent": "agent_id (must be one of: polly/flynn/pixel/cato/pizzazz/edwin/credo/gaia/happy/omni)",
    "confidence": "high/medium/low",
    "reasoning": "brief one-sentence explanation",
    "needs_routing": true/false,
    "topic_change": true/false
}}"""
    
    try:
        from .gemini import gemini_generate
        contents = [{"role": "user", "parts": [routing_prompt]}]
        result = gemini_generate(contents=contents, api_key=api_key)
        response_text = result.get("text", "")
        
        # Try to extract JSON from response
        import json
        
        # Find JSON in the response (handle cases where there's extra text)
        json_match = re.search(r'\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}', response_text, re.DOTALL)
        if json_match:
            routing_data = json.loads(json_match.group())
            suggested_agent_id = routing_data.get("suggested_agent", "polly").lower()
            
            # Validate the suggested agent exists
            if suggested_agent_id not in AGENTS:
                suggested_agent_id = "polly"
            
            # Deterministic override: If already talking to a specialist and the user asked generic headlines,
            # stick with the current specialist (sports/tech/politics) instead of routing to polly.
            def _is_generic_headlines(msg: str) -> bool:
                ml = (msg or "").lower().strip()
                headline_words = ["headline", "headlines", "top news", "top stories", "news today", "today's news"]
                has_headline = any(h in ml for h in headline_words)
                domain_words = [
                    "sport", "game", "team", "player", "score", "football", "basketball", "soccer", "nba", "nfl", "baseball",
                    "tech", "technology", "ai", "software", "app", "digital", "computer", "code", "programming", "gadget", "device",
                    "politic", "election", "government", "policy", "vote", "civic", "senate", "congress", "president", "democrat", "republican"
                ]
                has_domain = any(w in ml for w in domain_words)
                return has_headline and not has_domain
            if current_agent_id in ["flynn", "pixel", "cato"] and _is_generic_headlines(request.message):
                suggested_agent_id = current_agent_id
            
            # Check if we're already talking to this agent - if so, no routing needed
            if current_agent_id == suggested_agent_id:
                # Same agent, just continue the conversation
                return {
                    "needs_routing": False,
                    "routing_message": None,
                    "target_agent": suggested_agent_id
                }
            
            # Check if routing is actually needed
            needs_routing_flag = routing_data.get("needs_routing", True)
            topic_change = routing_data.get("topic_change", False)
            
            # If no routing needed or staying with polly, return
            if not needs_routing_flag or suggested_agent_id == "polly":
                return {
                    "needs_routing": False,
                    "routing_message": None,
                    "target_agent": suggested_agent_id
                }
            
            # Different agent detected - prepare routing (but don't always announce)
            suggested_agent = AGENTS[suggested_agent_id]
            agent_names = {
                "flynn": "Flynn the Falcon",
                "pixel": "Pixel the Pigeon",
                "cato": "Cato the Crane"
            }
            
            # Only show routing message if there's a clear topic change
            # For subtle shifts, route silently
            routing_message = None
            if topic_change and suggested_agent_id != "polly":
                routing_messages = {
                    "flynn": f"This sounds like something {agent_names['flynn']} can help you with! 🦅 He's our sports specialist—let me get him for you.",
                    "pixel": f"This is right up {agent_names['pixel']}'s alley! 🐦 They're our tech expert—connecting you now.",
                    "cato": f"{agent_names['cato']} would be perfect for this! 🦩 They specialize in politics and civics—routing you there now."
                }
                routing_message = routing_messages.get(suggested_agent_id, f"Let me connect you with {suggested_agent.name}!")
            
            return {
                "needs_routing": True,
                "routing_message": routing_message,  # May be None for silent routing
                "target_agent": suggested_agent_id,
                "target_agent_name": suggested_agent.name
            }
        else:
            # Fallback: simple keyword-based routing if JSON parsing fails
            message_lower = request.message.lower()
            suggested_agent_id = "polly"
            
            # Stick with current specialist on generic "headlines"
            generic_headlines = any(w in message_lower for w in ["headline", "headlines", "top news", "top stories", "news today", "today's news"])
            domain_present = any(word in message_lower for word in [
                "sport", "game", "team", "player", "score", "football", "basketball", "soccer", "nba", "nfl", "baseball",
                "tech", "technology", "ai", "software", "app", "digital", "computer", "code", "programming", "gadget", "device",
                "politic", "election", "government", "policy", "vote", "civic", "senate", "congress", "president", "democrat", "republican"
            ])
            if current_agent_id in ["flynn", "pixel", "cato"] and generic_headlines and not domain_present:
                suggested_agent_id = current_agent_id
            elif any(word in message_lower for word in ["sport", "game", "team", "player", "score", "football", "basketball", "soccer", "nba", "nfl", "baseball"]):
                suggested_agent_id = "flynn"
            elif any(word in message_lower for word in ["tech", "technology", "ai", "software", "app", "digital", "computer", "code", "programming", "gadget", "device"]):
                suggested_agent_id = "pixel"
            elif any(word in message_lower for word in ["politic", "election", "government", "policy", "vote", "civic", "senate", "congress", "president", "democrat", "republican"]):
                suggested_agent_id = "cato"
            
            # Check if we're already talking to this agent
            if current_agent_id == suggested_agent_id:
                return {
                    "needs_routing": False,
                    "routing_message": None,
                    "target_agent": suggested_agent_id
                }
            
            if suggested_agent_id == "polly":
                return {
                    "needs_routing": False,
                    "routing_message": None,
                    "target_agent": "polly"
                }
            
            # Different agent - silent routing
            return {
                "needs_routing": True,
                "routing_message": None,  # Silent routing for better UX
                "target_agent": suggested_agent_id,
                "target_agent_name": AGENTS[suggested_agent_id].name
            }
            
    except Exception as e:
        # Fallback on error - use keyword matching
        print(f"Error in intelligent routing, falling back to keywords: {str(e)}")
        message_lower = request.message.lower()
        suggested_agent_id = "polly"
        
        # Stick with current specialist on generic "headlines"
        generic_headlines = any(w in message_lower for w in ["headline", "headlines", "top news", "top stories", "news today", "today's news"])
        domain_present = any(word in message_lower for word in [
            "sport", "game", "team", "player", "score", "football", "basketball", "soccer", "nba", "nfl", "baseball",
            "tech", "technology", "ai", "software", "app", "digital", "computer", "code", "programming", "gadget", "device",
            "politic", "election", "government", "policy", "vote", "civic", "senate", "congress", "president", "democrat", "republican"
        ])
        if current_agent_id in ["flynn", "pixel", "cato"] and generic_headlines and not domain_present:
            suggested_agent_id = current_agent_id
        elif any(word in message_lower for word in ["sport", "game", "team", "player", "score", "football", "basketball", "soccer", "nba", "nfl", "baseball"]):
            suggested_agent_id = "flynn"
        elif any(word in message_lower for word in ["tech", "technology", "ai", "software", "app", "digital", "computer", "code", "programming", "gadget", "device"]):
            suggested_agent_id = "pixel"
        elif any(word in message_lower for word in ["politic", "election", "government", "policy", "vote", "civic", "senate", "congress", "president", "democrat", "republican"]):
            suggested_agent_id = "cato"
        
        if current_agent_id == suggested_agent_id:
            return {
                "needs_routing": False,
                "routing_message": None,
                "target_agent": suggested_agent_id
            }
        
        return {
            "needs_routing": suggested_agent_id != "polly" and suggested_agent_id != current_agent_id,
            "routing_message": None,  # Silent routing
            "target_agent": suggested_agent_id,
            "target_agent_name": AGENTS[suggested_agent_id].name if suggested_agent_id in AGENTS else "Polly the Parrot"
        }


@app.post("/agents/chat-and-route", response_model=ChatResponse)
async def chat_with_routing(request: ChatRequest):
    # Content moderation: check if user message is appropriate
    from .content_moderation import moderate_content
    import logging
    logger = logging.getLogger(__name__)
    
    is_appropriate, moderation_reason = moderate_content(request.message, api_key=request.api_key)
    if not is_appropriate:
        logger.warning(f"[content_moderation] Blocked inappropriate message in chat-and-route: {request.message[:100]}")
        raise HTTPException(
            status_code=400,
            detail=moderation_reason or "Your message contains inappropriate content. Please rephrase your question in a respectful way."
        )
    """Chat with automatic routing - returns routing message immediately, then specialist response."""
    api_key = request.api_key or get_gemini_api_key()
    
    if not api_key:
        raise HTTPException(
            status_code=400,
            detail="GEMINI_API_KEY not set. Provide it in the request or set it in .env file."
        )
    
    # Detect current agent from conversation history
    current_agent_id = detect_current_agent_from_history(request.conversation_history)
    
    # If agent is polly or message suggests routing, check if we should route
    original_agent = request.agent.lower()
    
    # Always check routing - any message can potentially route to a different specialist
    # This allows any agent to detect when the user wants to switch topics
    route_info = await route_only(request)
    
    routing_message = None
    routed_from = None
    target_agent_id = route_info["target_agent"]
    
    # Only show routing message if one is provided (for topic changes)
    # Silent routing happens when routing_message is None
    if route_info["needs_routing"]:
        # Check if we're actually switching agents
        if current_agent_id and current_agent_id != target_agent_id:
            # Different agent - only show routing message if provided (not silent routing)
            routing_message = route_info.get("routing_message")  # May be None for silent routing
            routed_from = current_agent_id
        else:
            # Same agent or first message - no routing message needed
            routing_message = None
    else:
        # No routing needed
        routing_message = None
    
    # Chat with the determined agent
    if target_agent_id not in AGENTS:
        raise HTTPException(
            status_code=404,
            detail=f"Agent '{target_agent_id}' not found. Available agents: {', '.join(AGENTS.keys())}"
        )
    
    agent = AGENTS[target_agent_id]
    
    def _detect_scores_request(msg: str) -> Optional[Dict[str, str]]:
        """Heuristic detection for 'scores' style sports queries (NFL/NBA etc.)."""
        ml = (msg or "").lower()
        if not any(k in ml for k in ["score", "scores", "final score", "game result", "game results"]):
            return None
        league = None
        sport = None
        mode = "today"
        if any(k in ml for k in ["latest", "most recent", "recent", "last weekend", "last week"]):
            mode = "latest"
        if "nfl" in ml or "football" in ml:
            league = "NFL"
            sport = "American Football"
        elif "nba" in ml or "basketball" in ml:
            league = "NBA"
            sport = "Basketball"
        elif any(k in ml for k in ["formula 1", "f1", "grand prix", "abu dhabi grand prix"]):
            # Formula 1 is a Motorsport league (TheSportsDB id 4370)
            league = "4370"
            sport = "Motorsport"
        # Extend here for other leagues as needed
        if not league:
            return None
        return {"league": league, "sport": sport, "mode": mode}
    
    try:
        # Build conversation history - include previous messages and current message
        contents = []
        
        # Add conversation history if provided
        if request.conversation_history:
            print(f"[chat_and_route] Received conversation history with {len(request.conversation_history)} items")
            # Validate and add history messages
            for item in request.conversation_history:
                if isinstance(item, dict) and "role" in item and "parts" in item:
                    # Ensure role is 'user' or 'model'
                    role = item["role"]
                    if role not in ["user", "model"]:
                        # Try to map agent/user to model/user
                        if role == "agent":
                            role = "model"
                        else:
                            role = "user"
                    
                    # Ensure parts is a list
                    parts = item["parts"]
                    if not isinstance(parts, list):
                        parts = [str(parts)]
                    
                    # Strip agent metadata from parts before sending to Gemini
                    # Format: "text [Agent: Name]" -> "text"
                    cleaned_parts = []
                    for part in parts:
                        part_str = str(part)
                        # Remove [Agent: Name] metadata pattern
                        cleaned = re.sub(r'\s*\[Agent:\s*[^\]]+\]\s*$', '', part_str, flags=re.IGNORECASE)
                        cleaned_parts.append(cleaned.strip())
                    
                    contents.append({
                        "role": role,
                        "parts": cleaned_parts
                    })
        else:
            print(f"[chat_and_route] No conversation history provided")
        
        # Check if we should fetch current news for this message
        print(f"[chat_and_route] Checking news context for message: '{request.message}', agent: {agent.name}")
        news_context = get_news_context(request.message, agent.name)
        
        # Add current message (with news context if available)
        user_message = request.message
        if news_context:
            user_message = user_message + news_context
            print(f"[chat_and_route] Added news context to message (length: {len(news_context)} chars)")
        else:
            print(f"[chat_and_route] No news context added")
        
        contents.append({"role": "user", "parts": [user_message]})
        print(f"[chat_and_route] Total conversation context: {len(contents)} messages")
        
        # Optional: fetch live/recent sports scores for sports queries (NFL/NBA etc.)
        scoreboard: Optional[SportsScoreboardResponse] = None
        # Only do this for the sports agent to avoid noise
        if target_agent_id == "flynn":
            scores_req = _detect_scores_request(request.message)
            if scores_req:
                try:
                    today = datetime.now(timezone.utc).date().isoformat()
                    mode = scores_req.get("mode", "today")
                    if mode == "latest":
                        print(
                            f"[chat_and_route] Fetching latest sports scores from TheSportsDB "
                            f"(eventspastleague) league={scores_req['league']} sport={scores_req['sport']}"
                        )
                        games = fetch_past_league_events(scores_req["league"])
                    else:
                        print(
                            f"[chat_and_route] Fetching sports scoreboard from TheSportsDB "
                            f"(eventsday) league={scores_req['league']} sport={scores_req['sport']} date={today}"
                        )
                        games = fetch_events_day(
                            date_iso=today,
                            sport=scores_req["sport"],
                            league=scores_req["league"],
                        )
                    print(f"[chat_and_route] Sports scoreboard returned {len(games)} games (mode={mode})")
                    if games:
                        # If using latest mode, take the date from the events themselves
                        sb_date = today
                        if mode == "latest":
                            first = games[0]
                            if isinstance(first, dict) and first.get("date"):
                                sb_date = str(first["date"])
                        scoreboard = SportsScoreboardResponse(
                            date=sb_date,
                            games=[SportsGame(**g) for g in games],
                        )
                except Exception as exc:
                    print(f"[chat_and_route] Error fetching sports scoreboard: {exc}")
        
        # Determine if this is the first message (no conversation history)
        is_first_message = not request.conversation_history or len(request.conversation_history) == 0
        
        result = agent.respond(
            contents=contents, 
            api_key=api_key, 
            is_first_message=is_first_message,
            user_name=request.user_name,
            parrot_name=request.parrot_name
        )
        
        has_ref = result.get("has_article_reference", False)
        print(f"[chat_and_route] Result has_article_reference={has_ref}, result keys: {list(result.keys())}")
        
        # Use custom parrot name if provided and agent is Polly
        agent_display_name = agent.name
        if target_agent_id == "polly" and request.parrot_name:
            agent_display_name = f"{request.parrot_name} the Parrot"
        
        # Optional: detect top-headlines requests and attach structured articles with tags
        def _is_headlines_request(msg: str) -> bool:
            ml = (msg or "").lower()
            keywords = ["headline", "headlines", "top news", "top stories", "today's news", "today news", "news today"]
            return any(k in ml for k in keywords)

        structured_articles = None
        if _is_headlines_request(request.message):
            try:
                from .news_helper import fetch_top_headlines_structured
                # Tailor headlines by agent
                kwargs: Dict[str, Any] = {"country": "us", "page_size": 6, "min_items": 5, "max_pages": 3}
                if target_agent_id == "flynn":
                    kwargs["category"] = "sports"
                elif target_agent_id == "pixel":
                    kwargs["category"] = "technology"
                elif target_agent_id == "cato":
                    kwargs["q"] = "politics OR election OR policy OR government"
                items = fetch_top_headlines_structured(**kwargs)
                if items:
                    structured_articles = []
                    # ALWAYS classify tags using the classifier agent – this is
                    # an essential part of the experience for bias/lean literacy.
                    for it in items:
                        tags: list[str] = []
                        clean_headline: Optional[str] = None
                        try:
                            # Build a concise classification prompt
                            classify_text = f"""Classify this news item and return JSON only.
Source: {it.get('source_name') or 'Unknown'}
Title: {it.get('headline') or ''}
URL: {it.get('url') or ''}"""
                            cls = CLASSIFIER.respond(
                                contents=[{"role": "user", "parts": [classify_text]}],
                                api_key=api_key
                            )
                            resp = cls.get("text") or ""
                            m = re.search(r'\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}', resp, re.DOTALL)
                            data = json.loads(m.group()) if m else {}
                            # Derive simple tags from fields
                            clean_headline = (data.get("clean_headline") or "").strip()
                            t_domain = (data.get("topic_domain") or "").strip().lower()
                            t_type = (data.get("type") or "").strip().lower()
                            lean = (data.get("political_lean") or "").strip().lower()
                            is_opinion = data.get("is_opinion")
                            if t_domain:
                                if t_domain == "sports":
                                    tags.append("sports news")
                                elif t_domain != "other":
                                    tags.append(t_domain)
                            if t_type and t_type not in ("other",):
                                tags.append(t_type)
                            if is_opinion is True:
                                tags.append("opinion-piece")
                            if lean and lean not in ("uncertain", "not-applicable"):
                                tags.append(lean)
                            # De-dup and keep order
                            seen: set[str] = set()
                            tags = [x for x in tags if not (x in seen or seen.add(x))]
                        except Exception:
                            tags = []
                        structured_articles.append({
                            "headline": clean_headline or it.get("headline"),
                            "url": it.get("url"),
                            "source_name": it.get("source_name"),
                            "tags": tags or None,
                        })
            except Exception:
                structured_articles = None

        # For headlines requests, suppress numbered list text and only show cards (keep a short header)
        final_text = result.get("text", "")
        if _is_headlines_request(request.message):
            if target_agent_id == "flynn":
                final_text = "Here are today's top sports headlines:"
            elif target_agent_id == "pixel":
                final_text = "Here are today's top technology headlines:"
            elif target_agent_id == "cato":
                final_text = "Here are today's top politics headlines:"
            else:
                final_text = "Here are today's top headlines:"

        # Check if user wants a chart or timeline visualization
        chart_data = None
        timeline_data = None
        visualization_note = ""
        
        # Only check for visualizations for agents that support them (Omni, Gaia, Edwin, etc.)
        visualization_agents = ["omni", "gaia", "edwin", "pixel", "cato"]
        if target_agent_id.lower() in visualization_agents:
            viz_intent = detect_chart_or_timeline_intent(request.message, agent.name, api_key)
            if viz_intent.get("needs_visualization"):
                viz_type = viz_intent.get("visualization_type")
                topic = viz_intent.get("topic", "")
                
                if viz_type == "chart":
                    chart_type = viz_intent.get("chart_type", "line")
                    chart_data_dict = generate_chart_data(topic, chart_type, news_context, api_key)
                    if chart_data_dict:
                        chart_data = ChartData(**chart_data_dict)
                        print(f"[chat_and_route] Generated {chart_type} chart: {chart_data.title}")
                    else:
                        visualization_note = (
                            "Note: A chart might seem helpful here, but we don't have clear, reliable "
                            "numeric data to plot without making up values. When you see graphs in the news, "
                            "it's important to check what data they are based on and whether the numbers are "
                            "actually available."
                        )
                
                elif viz_type == "timeline":
                    timeline_data_dict = generate_timeline_data(topic, news_context, api_key)
                    if timeline_data_dict:
                        timeline_data = TimelineData(**timeline_data_dict)
                        print(f"[chat_and_route] Generated timeline: {timeline_data.title}")
                    else:
                        visualization_note = (
                            "Note: For this question, a timeline of specific dated events isn't a great fit. "
                            "Many explanations in the news are about ongoing situations rather than clear, "
                            "timestamped milestones, so it's worth asking whether a timeline might oversimplify things."
                        )

        # Clean text if a visualization is attached to avoid graph placeholders / raw dumps
        if chart_data or timeline_data:
            final_text = _clean_visualization_text(final_text)
        # If we tried but couldn't generate a suitable visualization, append a brief
        # data-literacy note explaining why a chart/timeline may not be appropriate.
        if visualization_note and not (chart_data or timeline_data):
            if final_text:
                final_text = final_text.rstrip() + "\n\n" + visualization_note
            else:
                final_text = visualization_note

        return ChatResponse(
            agent=agent_display_name,
            response=final_text,
            routing_message=routing_message,
            routed_from=routed_from,
            has_article_reference=has_ref,
            articles=structured_articles,
            chart=chart_data,
            timeline=timeline_data,
            scoreboard=scoreboard,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@app.get("/", response_class=HTMLResponse)
async def test_page():
    """Simple HTML test page for agents."""
    return """
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>News Nest Agents - Test Interface</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
        }
        
        .container {
            max-width: 900px;
            margin: 0 auto;
            background: white;
            border-radius: 20px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            overflow: hidden;
        }
        
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            text-align: center;
        }
        
        .header h1 {
            font-size: 2.5em;
            margin-bottom: 10px;
        }
        
        .header p {
            opacity: 0.9;
            font-size: 1.1em;
        }
        
        .content {
            padding: 30px;
        }
        
        .agent-selector {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
            margin-bottom: 30px;
        }
        
        .agent-card {
            border: 3px solid #e0e0e0;
            border-radius: 12px;
            padding: 20px;
            cursor: pointer;
            transition: all 0.3s;
            text-align: center;
            background: #f8f9fa;
        }
        
        .agent-card:hover {
            transform: translateY(-5px);
            box-shadow: 0 5px 15px rgba(0,0,0,0.2);
        }
        
        .agent-card.active {
            border-color: #667eea;
            background: #e8edff;
        }
        
        .agent-card h3 {
            margin-bottom: 8px;
            color: #333;
        }
        
        .agent-card p {
            font-size: 0.9em;
            color: #666;
        }
        
        .chat-container {
            border: 2px solid #e0e0e0;
            border-radius: 12px;
            height: 400px;
            overflow-y: auto;
            padding: 20px;
            margin-bottom: 20px;
            background: #f8f9fa;
        }
        
        .message {
            margin-bottom: 15px;
            padding: 12px 16px;
            border-radius: 12px;
            max-width: 80%;
            animation: fadeIn 0.3s;
        }
        
        .message p {
            margin: 0;
            margin-bottom: 12px;
            line-height: 1.6;
        }
        
        .message p:last-child {
            margin-bottom: 0;
        }
        
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
        }
        
        .message.user {
            background: #667eea;
            color: white;
            margin-left: auto;
            text-align: right;
        }
        
        .message.agent {
            background: white;
            border: 2px solid #e0e0e0;
            color: #333;
        }
        
        .message-header {
            font-weight: bold;
            font-size: 0.9em;
            margin-bottom: 5px;
            opacity: 0.8;
        }
        
        .input-container {
            display: flex;
            gap: 10px;
        }
        
        input[type="text"] {
            flex: 1;
            padding: 15px;
            border: 2px solid #e0e0e0;
            border-radius: 12px;
            font-size: 1em;
            outline: none;
            transition: border-color 0.3s;
        }
        
        input[type="text"]:focus {
            border-color: #667eea;
        }
        
        button {
            padding: 15px 30px;
            background: #667eea;
            color: white;
            border: none;
            border-radius: 12px;
            font-size: 1em;
            cursor: pointer;
            transition: background 0.3s;
            font-weight: bold;
        }
        
        button:hover {
            background: #5568d3;
        }
        
        button:disabled {
            background: #ccc;
            cursor: not-allowed;
        }
        
        .api-key-section {
            margin-bottom: 20px;
            padding: 15px;
            background: #fff3cd;
            border-radius: 12px;
            border-left: 4px solid #ffc107;
        }
        
        .api-key-section input {
            width: 100%;
            padding: 10px;
            margin-top: 8px;
            border: 1px solid #ddd;
            border-radius: 8px;
            font-family: monospace;
        }
        
        .loading {
            text-align: center;
            color: #666;
            padding: 20px;
        }
        
        .error {
            background: #f8d7da;
            color: #721c24;
            padding: 12px 16px;
            border-radius: 12px;
            margin-bottom: 15px;
        }
        
        .routing-badge {
            display: inline-block;
            background: #e3f2fd;
            color: #1976d2;
            padding: 4px 8px;
            border-radius: 6px;
            font-size: 0.85em;
            margin-left: 10px;
            font-weight: normal;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🦜 News Nest Agents</h1>
            <p>Test your AI agents in the browser</p>
        </div>
        
        <div class="content">
            <div class="api-key-section">
                <strong>Gemini API Key (optional):</strong>
                <p style="font-size: 0.9em; margin-top: 5px; color: #666;">
                    If not set in .env file, enter it here. Otherwise leave blank to use environment variable.
                </p>
                <input type="password" id="apiKey" placeholder="GEMINI_API_KEY (or leave blank if set in .env)">
            </div>
            
            <div class="agent-selector">
                <div class="agent-card active" data-agent="polly" onclick="selectAgent('polly')">
                    <h3>🦜 Polly</h3>
                    <p>Main Host / Router<br><small style="opacity:0.7;">Auto-routes topics</small></p>
                </div>
                <div class="agent-card" data-agent="flynn" onclick="selectAgent('flynn')">
                    <h3>🦅 Flynn</h3>
                    <p>Sports Commentator</p>
                </div>
                <div class="agent-card" data-agent="pixel" onclick="selectAgent('pixel')">
                    <h3>🐦 Pixel</h3>
                    <p>Tech Explainer</p>
                </div>
                <div class="agent-card" data-agent="cato" onclick="selectAgent('cato')">
                    <h3>🦩 Cato</h3>
                    <p>Civic Commentator</p>
                </div>
            </div>
            
            <div class="routing-info" id="routingInfo" style="display:none; padding: 10px; margin-bottom: 15px; background: #e3f2fd; border-left: 4px solid #2196f3; border-radius: 8px; font-size: 0.9em;">
                <strong>🔄 Auto-routed to:</strong> <span id="routingText"></span>
            </div>
            
            <div class="chat-container" id="chatContainer">
                <div class="message agent">
                    <div class="message-header">🦜 Polly the Parrot</div>
                    <div>Welcome to News Nest! I'm Polly, your friendly news anchor. Ask me anything about today's news — or just say <em>\"headlines\"</em> and I'll share today's top 6 stories. You can also click on a specific agent card to chat directly with them.</div>
                </div>
            </div>
            
            <div class="input-container">
                <input type="text" id="messageInput" placeholder="Type your message here..." onkeypress="handleKeyPress(event)">
                <button onclick="sendMessage()" id="sendButton">Send</button>
            </div>
        </div>
    </div>
    
    <script>
        let currentAgent = 'polly';
        
        function selectAgent(agentId) {
            currentAgent = agentId;
            document.querySelectorAll('.agent-card').forEach(card => {
                card.classList.remove('active');
            });
            document.querySelector(`[data-agent="${agentId}"]`).classList.add('active');
        }
        
        function handleKeyPress(event) {
            if (event.key === 'Enter') {
                sendMessage();
            }
        }
        
        async function sendMessage() {
            const input = document.getElementById('messageInput');
            const message = input.value.trim();
            
            if (!message) return;
            
            const chatContainer = document.getElementById('chatContainer');
            const sendButton = document.getElementById('sendButton');
            const apiKey = document.getElementById('apiKey').value.trim();
            const routingInfo = document.getElementById('routingInfo');
            const routingText = document.getElementById('routingText');
            
            // Add user message
            const userMessage = document.createElement('div');
            userMessage.className = 'message user';
            userMessage.innerHTML = `<div>${escapeHtml(message)}</div>`;
            chatContainer.appendChild(userMessage);
            
            input.value = '';
            sendButton.disabled = true;
            sendButton.textContent = 'Sending...';
            
            // Hide routing info
            routingInfo.style.display = 'none';
            
            // Show loading
            const loading = document.createElement('div');
            loading.className = 'loading';
            loading.id = 'loading';
            loading.textContent = currentAgent === 'polly' ? 'Analyzing and routing...' : 'Thinking...';
            chatContainer.appendChild(loading);
            chatContainer.scrollTop = chatContainer.scrollHeight;
            
            try {
                const agentNames = {
                    'polly': '🦜 Polly the Parrot',
                    'flynn': '🦅 Flynn the Falcon',
                    'pixel': '🐦 Pixel the Pigeon',
                    'cato': '🦩 Cato the Crane'
                };
                
                // For Polly, get routing message first (quick), then specialist response
                if (currentAgent === 'polly') {
                    // Step 1: Get routing message immediately
                    const routeResponse = await fetch('/agents/route-only', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            agent: currentAgent,
                            message: message,
                            api_key: apiKey || null
                        })
                    });
                    
                    const routeData = await routeResponse.json();
                    
                    if (!routeResponse.ok) {
                        throw new Error(routeData.detail || 'Failed to get routing info');
                    }
                    
                    // Show Polly's routing message immediately if routing is needed
                    if (routeData.needs_routing && routeData.routing_message) {
                        // Remove loading for now
                        document.getElementById('loading').remove();
                        
                        // Use the same splitting function for routing message
                        addAgentResponse(chatContainer, routeData.routing_message, `${agentNames['polly']} 🔄 Routing`, '');
                        
                        // Show routing info banner
                        routingText.textContent = `${agentNames[routeData.target_agent] || routeData.target_agent_name}`;
                        routingInfo.style.display = 'block';
                        
                        // Show loading for specialist response
                        const loading2 = document.createElement('div');
                        loading2.className = 'loading';
                        loading2.id = 'loading2';
                        loading2.textContent = `Getting response from ${agentNames[routeData.target_agent] || routeData.target_agent_name}...`;
                        chatContainer.appendChild(loading2);
                        chatContainer.scrollTop = chatContainer.scrollHeight;
                    }
                    
                    // Step 2: Get the actual agent response
                    const targetAgent = routeData.target_agent || currentAgent;
                    const chatEndpoint = '/agents/chat';
                    const chatResponse = await fetch(chatEndpoint, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            agent: targetAgent,
                            message: message,
                            api_key: apiKey || null
                        })
                    });
                    
                    const chatData = await chatResponse.json();
                    
                    // Remove any loading indicators
                    document.getElementById('loading')?.remove();
                    document.getElementById('loading2')?.remove();
                    
                    if (!chatResponse.ok) {
                        throw new Error(chatData.detail || 'Failed to get response');
                    }
                    
                    // Show the specialist's response (split into multiple messages)
                    const actualAgent = targetAgent;
                    const headerText = agentNames[actualAgent] || chatData.agent;
                    const routingBadge = (routeData.needs_routing) 
                        ? '<span class="routing-badge">🔄 Auto-routed</span>' 
                        : '';
                    
                    // Split response into paragraphs and create separate messages
                    addAgentResponse(chatContainer, chatData.response, headerText, routingBadge);
                    
                } else {
                    // For other agents, just chat normally
                    const endpoint = '/agents/chat';
                    const response = await fetch(endpoint, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            agent: currentAgent,
                            message: message,
                            api_key: apiKey || null
                        })
                    });
                    
                    const data = await response.json();
                    
                    // Remove loading
                    document.getElementById('loading').remove();
                    
                    if (!response.ok) {
                        throw new Error(data.detail || 'Failed to get response');
                    }
                    
                    // Add agent response (split into multiple messages)
                    const headerText = agentNames[currentAgent] || data.agent;
                    addAgentResponse(chatContainer, data.response, headerText, '');
                }
                
            } catch (error) {
                document.getElementById('loading')?.remove();
                const errorMessage = document.createElement('div');
                errorMessage.className = 'error';
                errorMessage.textContent = `Error: ${error.message}`;
                chatContainer.appendChild(errorMessage);
            } finally {
                sendButton.disabled = false;
                sendButton.textContent = 'Send';
                chatContainer.scrollTop = chatContainer.scrollHeight;
            }
        }
        
        function escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }
        
        function addAgentResponse(container, responseText, headerText, badge) {
            // Split response by double newlines or periods followed by space/newline
            // This creates natural paragraph breaks
            const paragraphs = responseText
                .split(/\n\n+/)
                .map(p => p.trim())
                .filter(p => p.length > 0);
            
            // If no double newlines, try splitting by single newlines
            if (paragraphs.length === 1) {
                const singleLineBreaks = responseText
                    .split(/\n/)
                    .map(p => p.trim())
                    .filter(p => p.length > 0);
                
                // If we have multiple single-line paragraphs, use those
                if (singleLineBreaks.length > 1) {
                    paragraphs.length = 0;
                    paragraphs.push(...singleLineBreaks);
                }
            }
            
            // If still only one paragraph, try splitting by long sentences (period + space)
            // but only if the text is quite long
            if (paragraphs.length === 1 && responseText.length > 200) {
                const sentences = responseText.match(/[^.!?]+[.!?]+/g);
                if (sentences && sentences.length > 2) {
                    // Group sentences into chunks of 2-3 sentences
                    const chunks = [];
                    for (let i = 0; i < sentences.length; i += 2) {
                        const chunk = sentences.slice(i, i + 2).join(' ').trim();
                        if (chunk) chunks.push(chunk);
                    }
                    if (chunks.length > 1) {
                        paragraphs.length = 0;
                        paragraphs.push(...chunks);
                    }
                }
            }
            
            // Create a message for each paragraph (or combine short ones)
            const messageGroups = [];
            let currentGroup = [];
            
            paragraphs.forEach((para, index) => {
                currentGroup.push(para);
                // If paragraph is long enough or we have 2-3 short ones, create a message
                if (para.length > 150 || currentGroup.length >= 2 || index === paragraphs.length - 1) {
                    messageGroups.push([...currentGroup]);
                    currentGroup = [];
                }
            });
            
            // If we still have ungrouped items, add them
            if (currentGroup.length > 0) {
                messageGroups.push(currentGroup);
            }
            
            // Create message elements
            messageGroups.forEach((group, groupIndex) => {
                const agentMessage = document.createElement('div');
                agentMessage.className = 'message agent';
                
                // Only show header on first message
                const headerHtml = groupIndex === 0 
                    ? `<div class="message-header">${headerText}${badge}</div>`
                    : '';
                
                // Format paragraphs with spacing
                const contentHtml = group
                    .map(para => `<p>${escapeHtml(para)}</p>`)
                    .join('');
                
                agentMessage.innerHTML = headerHtml + '<div>' + contentHtml + '</div>';
                container.appendChild(agentMessage);
                
                // Add slight delay between messages for smooth appearance
                if (groupIndex > 0) {
                    agentMessage.style.animationDelay = `${groupIndex * 0.1}s`;
                }
                
                container.scrollTop = container.scrollHeight;
            });
        }
    </script>
</body>
</html>
    """

