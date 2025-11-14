from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from pydantic import BaseModel
from typing import Optional, List

from .config import get_newsapi_key, get_gemini_api_key
from .newsapi_client import fetch_news
from .agents import POLLY, FLYNN, PIXEL, CATO


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


# Agent-related models
class ChatRequest(BaseModel):
    agent: str
    message: str
    api_key: Optional[str] = None


class ChatResponse(BaseModel):
    agent: str
    response: str
    error: Optional[str] = None
    routing_message: Optional[str] = None
    routed_from: Optional[str] = None


# Agent mapping
AGENTS = {
    "polly": POLLY,
    "flynn": FLYNN,
    "pixel": PIXEL,
    "cato": CATO,
}


@app.post("/agents/chat", response_model=ChatResponse)
async def chat_with_agent(request: ChatRequest):
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
        # Format message as contents list for Gemini
        contents = [{"role": "user", "parts": [request.message]}]
        result = agent.respond(contents=contents, api_key=api_key)
        
        return ChatResponse(
            agent=agent.name,
            response=result.get("text", ""),
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

User message: "{request.message}"

Respond ONLY with a JSON object in this exact format:
{{
    "suggested_agent": "agent_id (polly/flynn/pixel/cato)",
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
            
            suggested_agent = AGENTS[suggested_agent_id]
            
            return RouteResponse(
                suggested_agent=suggested_agent_id,
                agent_name=suggested_agent.name,
                confidence=routing_data.get("confidence"),
                reasoning=routing_data.get("reasoning"),
                alternative_agents=routing_data.get("alternative_agents", [])
            )
        else:
            # Fallback: simple keyword-based routing
            message_lower = request.message.lower()
            if any(word in message_lower for word in ["sport", "game", "team", "player", "score", "football", "basketball", "soccer"]):
                suggested_agent_id = "flynn"
            elif any(word in message_lower for word in ["tech", "technology", "ai", "software", "app", "digital", "computer", "code"]):
                suggested_agent_id = "pixel"
            elif any(word in message_lower for word in ["politic", "election", "government", "policy", "vote", "civic", "senate", "congress"]):
                suggested_agent_id = "cato"
            else:
                suggested_agent_id = "polly"
            
            return RouteResponse(
                suggested_agent=suggested_agent_id,
                agent_name=AGENTS[suggested_agent_id].name,
                confidence="medium",
                reasoning="Keyword-based routing fallback"
            )
            
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Error routing message: {str(exc)}")


@app.post("/agents/route-only")
async def route_only(request: ChatRequest):
    """Quick routing endpoint that returns Polly's routing message immediately."""
    api_key = request.api_key or get_gemini_api_key()
    
    if not api_key:
        raise HTTPException(
            status_code=400,
            detail="GEMINI_API_KEY not set. Provide it in the request or set it in .env file."
        )
    
    original_agent = request.agent.lower()
    if original_agent != "polly" and original_agent in AGENTS:
        # Not routing, just return empty routing message
        return {
            "needs_routing": False,
            "routing_message": None,
            "target_agent": original_agent
        }
    
    # Quick routing logic with simple keyword matching for speed
    message_lower = request.message.lower()
    suggested_agent_id = "polly"
    
    if any(word in message_lower for word in ["sport", "game", "team", "player", "score", "football", "basketball", "soccer", "nba", "nfl", "soccer", "baseball"]):
        suggested_agent_id = "flynn"
    elif any(word in message_lower for word in ["tech", "technology", "ai", "software", "app", "digital", "computer", "code", "programming", "gadget", "device"]):
        suggested_agent_id = "pixel"
    elif any(word in message_lower for word in ["politic", "election", "government", "policy", "vote", "civic", "senate", "congress", "president", "democrat", "republican"]):
        suggested_agent_id = "cato"
    
    if suggested_agent_id == "polly":
        # Stay with Polly, no routing needed
        return {
            "needs_routing": False,
            "routing_message": None,
            "target_agent": "polly"
        }
    
    # Generate quick routing message from Polly
    suggested_agent = AGENTS[suggested_agent_id]
    agent_names = {
        "flynn": "Flynn the Falcon",
        "pixel": "Pixel the Pigeon",
        "cato": "Cato the Crane"
    }
    
    # Quick, friendly routing messages without API call for speed
    routing_messages = {
        "flynn": f"This sounds like something {agent_names['flynn']} can help you with! 🦅 He's our sports specialist—let me get him for you.",
        "pixel": f"This is right up {agent_names['pixel']}'s alley! 🐦 They're our tech expert—connecting you now.",
        "cato": f"{agent_names['cato']} would be perfect for this! 🦩 They specialize in politics and civics—routing you there now."
    }
    
    routing_message = routing_messages.get(suggested_agent_id, f"Let me connect you with {suggested_agent.name}!")
    
    return {
        "needs_routing": True,
        "routing_message": routing_message,
        "target_agent": suggested_agent_id,
        "target_agent_name": suggested_agent.name
    }


@app.post("/agents/chat-and-route", response_model=ChatResponse)
async def chat_with_routing(request: ChatRequest):
    """Chat with automatic routing - returns routing message immediately, then specialist response."""
    api_key = request.api_key or get_gemini_api_key()
    
    if not api_key:
        raise HTTPException(
            status_code=400,
            detail="GEMINI_API_KEY not set. Provide it in the request or set it in .env file."
        )
    
    # If agent is polly or message suggests routing, check if we should route
    original_agent = request.agent.lower()
    should_route = (original_agent == "polly") or (original_agent not in AGENTS)
    
    routing_message = None
    routed_from = None
    target_agent_id = original_agent
    
    if should_route:
        # Quick routing check
        route_info = await route_only(request)
        if route_info["needs_routing"]:
            routing_message = route_info["routing_message"]
            routed_from = "polly"
            target_agent_id = route_info["target_agent"]
        else:
            target_agent_id = route_info["target_agent"]
    
    # Chat with the determined agent
    if target_agent_id not in AGENTS:
        raise HTTPException(
            status_code=404,
            detail=f"Agent '{target_agent_id}' not found. Available agents: {', '.join(AGENTS.keys())}"
        )
    
    agent = AGENTS[target_agent_id]
    
    try:
        contents = [{"role": "user", "parts": [request.message]}]
        result = agent.respond(contents=contents, api_key=api_key)
        
        return ChatResponse(
            agent=agent.name,
            response=result.get("text", ""),
            routing_message=routing_message,
            routed_from=routed_from
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
                    <div>Welcome to News Nest! I'm Polly, your friendly news anchor. Ask me anything about today's news, and I'll automatically route your question to the best specialist agent. Or click on a specific agent card to chat directly with them!</div>
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

