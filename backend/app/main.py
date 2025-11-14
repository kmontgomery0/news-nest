from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from pydantic import BaseModel
from typing import Optional

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
                    <p>Main Host / Router</p>
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
            
            <div class="chat-container" id="chatContainer">
                <div class="message agent">
                    <div class="message-header">🦜 Polly the Parrot</div>
                    <div>Welcome to News Nest! 👋 I'm Polly, your friendly news anchor. Which agent would you like to chat with, or ask me anything about today's news!</div>
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
            
            // Add user message
            const userMessage = document.createElement('div');
            userMessage.className = 'message user';
            userMessage.innerHTML = `<div>${escapeHtml(message)}</div>`;
            chatContainer.appendChild(userMessage);
            
            input.value = '';
            sendButton.disabled = true;
            sendButton.textContent = 'Sending...';
            
            // Show loading
            const loading = document.createElement('div');
            loading.className = 'loading';
            loading.id = 'loading';
            loading.textContent = 'Thinking...';
            chatContainer.appendChild(loading);
            chatContainer.scrollTop = chatContainer.scrollHeight;
            
            try {
                const agentNames = {
                    'polly': '🦜 Polly the Parrot',
                    'flynn': '🦅 Flynn the Falcon',
                    'pixel': '🐦 Pixel the Pigeon',
                    'cato': '🦩 Cato the Crane'
                };
                
                const response = await fetch('/agents/chat', {
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
                
                // Add agent response
                const agentMessage = document.createElement('div');
                agentMessage.className = 'message agent';
                agentMessage.innerHTML = `
                    <div class="message-header">${agentNames[currentAgent] || data.agent}</div>
                    <div>${escapeHtml(data.response)}</div>
                `;
                chatContainer.appendChild(agentMessage);
                
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
    </script>
</body>
</html>
    """

