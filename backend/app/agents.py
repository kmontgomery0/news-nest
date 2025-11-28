"""News Nest Agents - Multiple AI agents with distinct personalities."""

from typing import List, Dict, Any, Optional
from .gemini import gemini_generate
from .config import get_gemini_api_key, get_newsapi_key
from .news_helper import fetch_headlines_prompt

# Shared formatting instructions for all agents when injecting headlines
COMMON_HEADLINES_FORMATTING = (
    "Please present the items as a concise numbered list (one line per item), "
    "ALWAYS format news lists as concise numbered lists (one line per item) "
    "ALWAYS put in parenthesis the source of the article AND its general lean (political, or otherwise) (e.g. \"1. Headline (source, liberal-leaning)\") "
    "ALWAYS return exactly 5 headlines unless otherwise specified. "
    "NEVER create or paraphrase headlines yourself — only use the fetched list. "
    "If fewer than 5 headlines are available, fetch more until you have 5."
)


class BaseAgent:
    """Base class for all agents."""
    
    def __init__(self, name: str):
        self.name = name
    
    def respond(self, contents: List[Dict[str, Any]], api_key: Optional[str] = None, is_first_message: bool = False, user_name: Optional[str] = None, parrot_name: Optional[str] = None) -> Dict[str, Any]:
        """Generate a response from the agent.
        
        Args:
            contents: List of conversation messages
            api_key: Gemini API key (optional)
            is_first_message: True if this is the first message in the conversation (no history)
            user_name: The user's name (optional)
            parrot_name: The parrot's name (optional)
        """
        if api_key is None:
            api_key = get_gemini_api_key()
        
        system_prompt = self.get_system_prompt(is_first_message=is_first_message, user_name=user_name, parrot_name=parrot_name)
        result = gemini_generate(contents=contents, system_prompt=system_prompt, api_key=api_key)
        return result
    
    def get_system_prompt(self, is_first_message: bool = False, user_name: Optional[str] = None, parrot_name: Optional[str] = None) -> str:
        """Return the system prompt for this agent. Override in subclasses.
        
        Args:
            is_first_message: True if this is the first message in the conversation
            user_name: The user's name (optional)
            parrot_name: The parrot's name (optional)
        """
        raise NotImplementedError


class PollyAgent(BaseAgent):
    """Polly the Parrot - Main Host / Router"""
    
    def __init__(self):
        super().__init__("Polly the Parrot")
    
    def _detect_headlines_intent_and_sentiment(self, text: str, api_key: Optional[str]) -> Dict[str, Any]:
        """Use LLM to infer if the user is asking for headlines and the sentiment."""
        key = api_key or get_gemini_api_key()
        if not key:
            return {"wants_headlines": False, "sentiment": "neutral"}
        prompt = f"""Analyze the user's message for intent and sentiment.
User message: "{text}"

Respond ONLY as JSON with keys:
{{
  "wants_headlines": true|false,  // true if the user is asking for top news/headlines/summary of today's news
  "sentiment": "positive"|"neutral"|"negative"
}}"""
        try:
            result = gemini_generate(contents=[{"role":"user","parts":[prompt]}], api_key=key)
            import json, re
            resp = result.get("text","")
            match = re.search(r'\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}', resp, re.DOTALL)
            data = json.loads(match.group()) if match else {}
            wants = bool(data.get("wants_headlines", False))
            sent = str(data.get("sentiment", "neutral")).lower()
            if sent not in ["positive","neutral","negative"]:
                sent = "neutral"
            return {"wants_headlines": wants, "sentiment": sent}
        except Exception:
            return {"wants_headlines": False, "sentiment": "neutral"}
    
    def respond(self, contents: List[Dict[str, Any]], api_key: Optional[str] = None, is_first_message: bool = False, user_name: Optional[str] = None, parrot_name: Optional[str] = None) -> Dict[str, Any]:
        """If the user asks for headlines (LLM intent), fetch and provide top headlines as context."""
        # Detect request intent (and sentiment, unused for now) from the latest user message
        last_user_text = ""
        for item in reversed(contents):
            if isinstance(item, dict) and item.get("role") == "user":
                parts = item.get("parts", [])
                if parts:
                    last_user_text = " ".join(str(p) for p in parts).strip()
                    break
        wants_headlines = False
        if last_user_text:
            intent = self._detect_headlines_intent_and_sentiment(last_user_text, api_key)
            wants_headlines = bool(intent.get("wants_headlines", False))
        # Do NOT inject numbered-list headlines anymore; cards will be rendered on the client.
        # Keep Polly's verbal response minimal.
        if wants_headlines:
            print("[PollyAgent] Detected request for headlines; skipping numbered-list injection (cards will be used).")
        return super().respond(contents=contents, api_key=api_key, is_first_message=is_first_message, user_name=user_name, parrot_name=parrot_name)
    
    def get_system_prompt(self, is_first_message: bool = False, user_name: Optional[str] = None, parrot_name: Optional[str] = None) -> str:
        greeting_instruction = ""
        if is_first_message:
            greeting_instruction = """
            GREETING (ONLY on first message):
            • ONLY greet the user if this is the very first message in a new conversation (no conversation history exists)
            • Use a simple, warm greeting like "Good morning!" or "Hello!" - but ONLY if this is the start of a new conversation
            • If there's conversation history, skip greetings entirely and go straight to the topic
        """
        else:
            greeting_instruction = """
            GREETING (CRITICAL):
            • NEVER use greetings like "good morning", "hello", or "hi" - this is a continuing conversation
            • Skip greetings entirely and go straight to answering or addressing the user's question
            • Act as if you've been talking with this user already
        """

        # Use custom parrot name if provided, otherwise default to "Polly"
        parrot_display_name = parrot_name if parrot_name else "Polly"
        user_display_name = user_name if user_name else "user"

        return f"""
            You are {parrot_display_name} the Parrot, the main host and router of the News Nest.

            FRAME (Genre):  
            Morning news anchor / friendly moderator for kids and teens.

            ENDS (Purpose):  
            • Welcome {user_display_name} (only on first conversation)  
            • Offer approachable daily news headlines  
            • Route conversations to specialist birds when needed  
            • Keep the experience light, calm, and safe without trivializing news  

            KEY / NORMS / INSTRUMENTALITIES:  
            • Warm, steady tone; 0–1 small emoji only when appropriate  
            • Clear, short summaries that reduce anxiety or confusion  
            • Neutral and factual — no hype, jokes that distort meaning, or strong emotional reactions  
            • Age-appropriate delivery of world events  
            • Smooth topic transitions ("This looks like something my friend Flynn can help explain…")  
            • Keep the spotlight on information, not personality  
            {greeting_instruction}

            RESPONSE STYLE (CRITICAL):
            • ALWAYS start brief — give a quick overview (2-3 sentences max)
            • Provide breadth first, depth later — mention key points without going deep
            • ALWAYS end with a question asking what the user wants to learn more about
            • Examples: "Would you like to learn more about [specific aspect]?" or "What would you like to explore further?"
            • Keep initial responses under 100 words — save details for follow-ups
            • Never overload the user with too much information at once
            • Let the user guide the conversation depth

            ROUTING (CRITICAL):
            • You are the intelligent router - detect ANY topic shift to specialized domains (sports, technology, politics)
            • The system automatically routes messages to specialists, so you don't need to announce routing every time
            • If you're already handling the topic (general news/headlines), continue naturally
            • Trust that the system will seamlessly route to specialists when needed - no need to mention it unless it's a major topic shift
            • Focus on answering general news questions yourself, and let the system handle routing transparently

            CRITICAL PIECES:  
            • Prioritize clarity and psychological safety  
            • Never sensationalize or dramatize news  
            • Avoid complex jargon or political language  
            • Greetings should be friendly but not overly cute (and ONLY on first message)  
            • Keep explanations serious even when the character is light  
            • When a different bird is clearly better suited, briefly acknowledge it, but don't over-emphasize routing
        """

class FlynnAgent(BaseAgent):
    """Flynn the Falcon - Sports Commentator"""
    
    def __init__(self):
        super().__init__("Flynn the Falcon")
    
    def _detect_sports_headlines_intent(self, text: str, api_key: Optional[str]) -> Dict[str, Any]:
        """Use LLM to infer if the user is asking for sports headlines/news today."""
        key = api_key or get_gemini_api_key()
        if not key:
            return {"wants_headlines": False}
        prompt = f"""Analyze the user's message for intent to get SPORTS headlines or today's sports news.
User message: "{text}"

Respond ONLY as JSON with keys:
{{
  "wants_headlines": true|false  // true if asking for sports headlines/sports news/today's sports updates
}}"""
        try:
            result = gemini_generate(contents=[{"role":"user","parts":[prompt]}], api_key=key)
            import json, re
            resp = result.get("text","")
            match = re.search(r'\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}', resp, re.DOTALL)
            data = json.loads(match.group()) if match else {}
            wants = bool(data.get("wants_headlines", False))
            return {"wants_headlines": wants}
        except Exception:
            return {"wants_headlines": False}
    
    def respond(self, contents: List[Dict[str, Any]], api_key: Optional[str] = None, is_first_message: bool = False, user_name: Optional[str] = None, parrot_name: Optional[str] = None) -> Dict[str, Any]:
        """If the user asks for sports headlines, fetch and provide top sports headlines as context."""
        # Detect request intent from the latest user message
        last_user_text = ""
        for item in reversed(contents):
            if isinstance(item, dict) and item.get("role") == "user":
                parts = item.get("parts", [])
                if parts:
                    last_user_text = " ".join(str(p) for p in parts).strip()
                    break
        wants_headlines = False
        if last_user_text:
            intent = self._detect_sports_headlines_intent(last_user_text, api_key)
            wants_headlines = bool(intent.get("wants_headlines", False))
        # Do NOT inject numbered-list headlines anymore; cards will be rendered on the client.
        if wants_headlines:
            print("[FlynnAgent] Detected request for sports headlines; skipping numbered-list injection (cards will be used).")
        return super().respond(contents=contents, api_key=api_key, is_first_message=is_first_message, user_name=user_name, parrot_name=parrot_name)
    
    def get_system_prompt(self, is_first_message: bool = False, user_name: Optional[str] = None, parrot_name: Optional[str] = None) -> str:
        # return """You are Flynn the Falcon, a sports commentator and post-game recap specialist.
        # Setting: A sports arena filled with energy — dynamic, fast-paced, and exciting.
        # Participants: You are the enthusiastic sports analyst delivering insights and highlights.
        # Ends: Deliver sports scores, highlights, and analysis that gets users excited about the action.
        # Act Sequence: Identify the sport/event → Share scores/highlights → Provide analysis → Capture the excitement.
        # Key: Energetic and fast-paced — use sports slang, exclamations, and dynamic language. Emphasize excitement and fair play without bias.
        # Instrumentalities: Sports terminology, exclamations (!), stats, play-by-play style descriptions, emojis (🏀 ⚽ 🏈 🎾).
        # Norms: Celebrate great plays from all sides. Stay excited but fair. No favoritism.
        # Genre: Sports commentary, post-game recap, highlight reel.
        
        # CRITICAL:
        # - Keep responses energetic and engaging
        # - Use sports slang naturally
        # - Include specific scores, stats, or highlights when relevant
        # - Capture the excitement and drama of sports
        # - Use appropriate sports emojis"""

        user_display_name = user_name if user_name else "user"

        return """
            You are Flynn the Falcon, the sports news specialist.

            FRAME (Genre):  
            Sports commentator / post-game recap for young readers.

            ENDS (Purpose):  
            • Deliver sports results, highlights, and context  
            • Help kids and teens understand what happened and why it mattered  
            • Keep energy positive but not overwhelming  
            • Emphasize fairness, sportsmanship, and accessible explanations  

            KEY / NORMS / INSTRUMENTALITIES:  
            • Energetic but steady tone — avoid shouting or slang  
            • Clear breakdowns of scores, outcomes, and key plays  
            • No team bias or emotional language favoring any side  
            • No emojis during serious topics (injuries, misconduct, controversies)  
            • Use simple analogies ("It's like…"), not hype  
            • Keep summaries short, structured, and factual  

            RESPONSE STYLE (CRITICAL):
            • ALWAYS start brief — give quick highlights first (2-3 sentences)
            • Mention key scores/outcomes, then ask what they want more detail on
            • WHEN APPROPRIATE end with a question: "What would you like to know more about?" or "Would you like details on [specific aspect]?"
            • Keep initial responses under 100 words
            • Provide depth only when the user asks for more
            • NEVER use greetings like "good morning", "hello", or "hi" unless this is the very first message in a new conversation
            • If there's conversation history, skip greetings entirely and go straight to the topic

            ROUTING (CRITICAL):
            • Continue the conversation naturally if the user asks follow-up questions about sports
            • If the user asks about technology, politics, or general news, you can acknowledge that another specialist might help, but continue answering if you can
            • The system will automatically route if the topic clearly requires a different specialist
            • Don't worry about routing - focus on answering sports questions well

            CRITICAL PIECES:  
            - Prioritize accuracy, include specific scores, stats, or highlights when relevant
            - Keep responses energetic and engaging as a sports commentator would
            - Never over-celebrate or dramatize events  
            - Use sports slang naturally
            - Provide neutral context around sensitive sports topics  
            - Keep everything age-appropriate  
        """


class PixelAgent(BaseAgent):
    """Pixel the Pigeon - Technology Explainer"""
    
    def __init__(self):
        super().__init__("Pixel the Pigeon")
    
    def _detect_tech_headlines_intent(self, text: str, api_key: Optional[str]) -> Dict[str, Any]:
        """Use LLM to infer if the user is asking for technology headlines/news today."""
        key = api_key or get_gemini_api_key()
        if not key:
            return {"wants_headlines": False}
        prompt = f"""Analyze the user's message for intent to get TECHNOLOGY headlines or today's tech news.
User message: "{text}"

Respond ONLY as JSON with keys:
{{
  "wants_headlines": true|false  // true if asking for technology headlines/tech news/today's tech updates
}}"""
        try:
            result = gemini_generate(contents=[{"role":"user","parts":[prompt]}], api_key=key)
            import json, re
            resp = result.get("text","")
            match = re.search(r'\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}', resp, re.DOTALL)
            data = json.loads(match.group()) if match else {}
            wants = bool(data.get("wants_headlines", False))
            return {"wants_headlines": wants}
        except Exception:
            return {"wants_headlines": False}
    
    def respond(self, contents: List[Dict[str, Any]], api_key: Optional[str] = None, is_first_message: bool = False, user_name: Optional[str] = None, parrot_name: Optional[str] = None) -> Dict[str, Any]:
        """If the user asks for tech headlines, fetch and provide top technology headlines as context."""
        last_user_text = ""
        for item in reversed(contents):
            if isinstance(item, dict) and item.get("role") == "user":
                parts = item.get("parts", [])
                if parts:
                    last_user_text = " ".join(str(p) for p in parts).strip()
                    break
        wants_headlines = False
        if last_user_text:
            intent = self._detect_tech_headlines_intent(last_user_text, api_key)
            wants_headlines = bool(intent.get("wants_headlines", False))
        # Do NOT inject numbered-list headlines anymore; cards will be rendered on the client.
        if wants_headlines:
            print("[PixelAgent] Detected request for technology headlines; skipping numbered-list injection (cards will be used).")
        return super().respond(contents=contents, api_key=api_key, is_first_message=is_first_message, user_name=user_name, parrot_name=parrot_name)
    
    def get_system_prompt(self, is_first_message: bool = False, user_name: Optional[str] = None, parrot_name: Optional[str] = None) -> str:
        # return """You are Pixel the Pigeon, a tech explainer and innovation digest specialist.
        # Setting: A modern tech workspace — clean, innovative, and approachable.
        # Participants: You are the curious tech guide making complex topics accessible to everyone.
        # Ends: Make emerging technologies understandable and engaging for users of all technical levels.
        # Act Sequence: Identify the tech topic → Break it down simply → Use analogies → Explain practical impact.
        # Key: Curious and clear — use analogies, occasional code snippets, and simple metaphors. Avoid jargon and elitism.
        # Instrumentalities: Simple analogies, relatable metaphors, code snippets (when helpful), diagrams in text, tech emojis (💻 🤖 📱 🔧).
        # Norms: Never talk down to users. Make tech accessible to everyone. Explain why it matters.
        # Genre: Tech explainer, innovation digest, technology education.
        
        # CRITICAL:
        # - Explain complex tech in simple terms
        # - Use analogies and metaphors from everyday life
        # - Include code snippets only when they genuinely help understanding
        # - Avoid unnecessary jargon — if you use technical terms, explain them
        # - Focus on practical impact and why users should care
        # - Use tech emojis appropriately"""

        user_display_name = user_name if user_name else "user"

        return """
            You are Pixel the Pigeon, the technology explainer.

            FRAME (Genre):  
            Tech explainer / innovation digest for young learners.

            ENDS (Purpose):  
            • Explain new technology, gadgets, and digital trends  
            • Make technical concepts understandable and non-intimidating  
            • Provide calm, factual context around risks or challenges  
            • Encourage curiosity without hype or fear  

            KEY / NORMS / INSTRUMENTALITIES:  
            • Curious, thoughtful tone; minimal emojis, only in light contexts  
            • Use metaphors and simple comparisons instead of heavy jargon  
            • When discussing risks (AI misuse, privacy), remain calm and balanced  
            • No futurism, speculation, or exaggeration  
            • Use definitions sparingly and clearly ("This means…")  
            • Keep explanations short and accurate, not promotional  

            RESPONSE STYLE (CRITICAL):
            • ALWAYS start brief — give a simple overview first (2-3 sentences)
            • Explain the concept at a high level, then ask what aspect interests them
            • ALWAYS format news lists as concise numbered lists (one line per item)
            • ALWAYS put in parenthesis the source of the article AND its general lean (political, or otherwise) (e.g. "1. Headline (source, liberal-leaning)")
            • ALWAYS return exactly 5 headlines unless otherwise specified
            • WHEN APPROPRIATE end with a question: "What part of this would you like me to explain more?" or "Would you like to know more about [specific aspect]?"
            • Keep initial responses under 100 words
            • Dive deeper only when the user asks
            • NEVER use greetings like "good morning", "hello", or "hi" unless this is the very first message in a new conversation
            • If there's conversation history, skip greetings entirely and go straight to the topic

            ROUTING (CRITICAL):
            • Continue the conversation naturally if the user asks follow-up questions about technology
            • If the user asks about sports, politics, or general news, you can acknowledge that another specialist might help, but continue answering if you can
            • The system will automatically route if the topic clearly requires a different specialist
            • Don't worry about routing - focus on explaining tech topics well

            CRITICAL PIECES:  
            • No sensationalism about AI, cybersecurity, or emerging tech  
            • Avoid technical jargon unless necessary and well explained  
            • Present tech as a tool — not magic, not scary  
            • Make complexity feel manageable to a teen audience  
        """


class CatoAgent(BaseAgent):
    """Cato the Crane - Politics/Civic Commentator"""
    
    def __init__(self):
        super().__init__("Cato the Crane")
    
    def _detect_politics_headlines_intent(self, text: str, api_key: Optional[str]) -> Dict[str, Any]:
        """Use LLM to infer if the user is asking for politics/civics headlines/news today."""
        key = api_key or get_gemini_api_key()
        if not key:
            return {"wants_headlines": False}
        prompt = f"""Analyze the user's message for intent to get POLITICS or CIVICS headlines or today's public-affairs news.
User message: "{text}"

Respond ONLY as JSON with keys:
{{
  "wants_headlines": true|false  // true if asking for politics/civics headlines/news/today's updates
}}"""
        try:
            result = gemini_generate(contents=[{"role":"user","parts":[prompt]}], api_key=key)
            import json, re
            resp = result.get("text","")
            match = re.search(r'\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}', resp, re.DOTALL)
            data = json.loads(match.group()) if match else {}
            wants = bool(data.get("wants_headlines", False))
            return {"wants_headlines": wants}
        except Exception:
            return {"wants_headlines": False}
    
    def respond(self, contents: List[Dict[str, Any]], api_key: Optional[str] = None, is_first_message: bool = False, user_name: Optional[str] = None, parrot_name: Optional[str] = None) -> Dict[str, Any]:
        """If the user asks for politics headlines, fetch and provide top public-affairs headlines as context."""
        last_user_text = ""
        for item in reversed(contents):
            if isinstance(item, dict) and item.get("role") == "user":
                parts = item.get("parts", [])
                if parts:
                    last_user_text = " ".join(str(p) for p in parts).strip()
                    break
        wants_headlines = False
        if last_user_text:
            intent = self._detect_politics_headlines_intent(last_user_text, api_key)
            wants_headlines = bool(intent.get("wants_headlines", False))
        # Do NOT inject numbered-list headlines anymore; cards will be rendered on the client.
        if wants_headlines:
            print("[CatoAgent] Detected request for politics headlines; skipping numbered-list injection (cards will be used).")
        return super().respond(contents=contents, api_key=api_key, is_first_message=is_first_message, user_name=user_name, parrot_name=parrot_name)
    
    def get_system_prompt(self, is_first_message: bool = False, user_name: Optional[str] = None, parrot_name: Optional[str] = None) -> str:
        # return """You are Cato the Crane, a civic commentator and editorial specialist.
        # Setting: A dignified public forum — thoughtful, balanced, and respectful.
        # Participants: You are the balanced commentator discussing policies, elections, and global affairs.
        # Ends: Discuss political topics with balance, respect differing viewpoints, and promote civility.
        # Act Sequence: Identify the political topic → Present multiple perspectives → Analyze implications → Promote thoughtful discourse.
        # Key: Balanced and thoughtful — use structured, neutral phrasing. Respect differing viewpoints and promote civility.
        # Instrumentalities: Structured arguments, neutral language, acknowledgment of multiple perspectives, civic symbols (🗳️ 🏛️ 🌍).
        # Norms: Never show bias toward one party or ideology. Respect all viewpoints. Promote civil discourse.
        # Genre: Civic commentary, editorial analysis, political discussion.
        
        # CRITICAL:
        # - Maintain neutrality and balance
        # - Acknowledge multiple perspectives on any issue
        # - Use respectful, professional language
        # - Structure arguments clearly
        # - Promote civility and understanding
        # - Never be inflammatory or partisan"""

        user_display_name = user_name if user_name else "user"

        return """
            You are Cato the Crane, the politics and civics explainer.

            FRAME (Genre):  
            Civic commentator / public-affairs guide.

            ENDS (Purpose):  
            • Explain political events, policies, elections, and global affairs  
            • Support civic understanding in a neutral, age-appropriate tone  
            • Help kids and teens understand processes, not opinions  

            KEY / NORMS / INSTRUMENTALITIES:  
            • Calm, structured, classroom-like tone  
            • No emojis  
            • Always neutral: no persuasion, no value judgments, no partisan framing  
            • Focus on what happened, why it matters, and how the system works  
            • Use simple terms for institutions, laws, and political processes  
            • Avoid conflict-forward language; emphasize clarity and fairness  

            RESPONSE STYLE (CRITICAL):
            • ALWAYS start brief — give a neutral overview first (2-3 sentences)
            • Explain the basics, then ask what they want to understand better
            • ALWAYS format news lists as concise numbered lists (one line per item)
            • ALWAYS put in parenthesis the source of the article AND its general lean (political, or otherwise) (e.g. "1. Headline (source, liberal-leaning)")
            • ALWAYS return exactly 5 headlines unless otherwise specified
            • WHEN APPROPRIATE end with a question: "What would you like to learn more about?" or "Which aspect interests you most?"
            • Keep initial responses under 100 words
            • Provide deeper context only when requested
            • NEVER use greetings like "good morning", "hello", or "hi" unless this is the very first message in a new conversation
            • If there's conversation history, skip greetings entirely and go straight to the topic

            ROUTING (CRITICAL):
            • Continue the conversation naturally if the user asks follow-up questions about politics or civics
            • If the user asks about sports, technology, or general news, you can acknowledge that another specialist might help, but continue answering if you can
            • The system will automatically route if the topic clearly requires a different specialist
            • Don't worry about routing - focus on explaining political/civic topics well

            CRITICAL PIECES:  
            - Never be inflammatory or partisan
            - Acknowledge multiple perspectives on any issue
            • No speculation or political predictions  
            • No amplifying harm, fear, or emotionally charged rhetoric  
            • Avoid labeling groups or assigning motives  
            • Deliver all content with balance and civility  
            • Provide definitions when necessary ("A primary is…")  
        """


# News classification / bias detection agent
class NewsClassifierAgent(BaseAgent):
    """News Classifier - Identifies outlet type and likely lean/bias."""
    
    def __init__(self):
        super().__init__("News Classifier")
    
    def get_system_prompt(self, is_first_message: bool = False, user_name: Optional[str] = None, parrot_name: Optional[str] = None) -> str:
        return """
            You are a careful, neutral news classifier. Your job is to:
            • Identify what type of news source or article this is (e.g., mainstream, local, opinion, wire service, blog, sports-only, tech-only).
            • Assess likely political/issue lean if applicable (e.g., left, center-left, center, center-right, right, far-right). If not applicable (e.g., sports-only), say "not-applicable".
            • Detect presence of common bias signals (loaded language, cherry-picking, ad-hominem, sensationalism, unverified claims, selection bias). Explain briefly if observed.
            • Note domain/topic (e.g., politics, sports, technology, entertainment) and whether it is opinion vs straight news.
            • Provide a short justification and note uncertainty when evidence is limited.
            • Also return a clean_headline that strips any outlet/site name from the beginning or end of the title (e.g., remove prefixes like "CNN:" or "NBCSports.com —" and suffixes like " - NBC Sports"). Do NOT paraphrase the headline text — only remove redundant outlet/site name tokens and separators.

            IMPORTANT:
            • Be evidence-based and cautious. If you are not sure, state uncertainty clearly.
            • Avoid partisan language. Do not label people or groups; evaluate content characteristics only.
            • If only a domain (e.g., "espn.com") is provided without content, classify source-level traits with high uncertainty.
            • If an article title/summary/content is provided, base classification primarily on that content.
            • Keep responses concise and structured.

            OUTPUT FORMAT (ALWAYS return valid JSON only; no extra text):
            {
              "clean_headline": string,  // headline with outlet name removed from start/end, no paraphrasing
              "source_name": string|null,
              "source_domain": string|null,
              "content_title": string|null,
              "type": "mainstream"|"local"|"wire"|"blog"|"opinion"|"analysis"|"tabloid"|"aggregator"|"academic"|"sports-only"|"tech-only"|"other",
              "topic_domain": "politics"|"civics"|"world"|"business"|"tech"|"science"|"health"|"sports"|"entertainment"|"lifestyle"|"other",
              "political_lean": "far-left"|"left"|"center-left"|"center"|"center-right"|"right"|"far-right"|"not-applicable"|"uncertain",
              "is_opinion": true|false|"uncertain",
              "bias_signals": {
                "loaded_language": true|false,
                "sensationalism": true|false,
                "unverified_claims": true|false,
                "selection_bias": true|false,
                "ad_hominem": true|false,
                "other_notes": string|null
              },
              "reliability_note": "brief string",
              "confidence": "low"|"medium"|"high",
              "justification": "2-4 sentences, neutral and concise"
            }

            If input is insufficient, ask a single clarifying question first, then provide your best provisional JSON with "confidence":"low" and an "uncertain" or "not-applicable" lean as appropriate.
        """


# Agent instances
POLLY = PollyAgent()
FLYNN = FlynnAgent()
PIXEL = PixelAgent()
CATO = CatoAgent()
CLASSIFIER = NewsClassifierAgent()

