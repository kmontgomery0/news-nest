"""Content moderation for user messages to filter inappropriate content."""

from typing import Optional, Dict, Any, Tuple
import re
import logging
from .gemini import gemini_generate
from .config import get_gemini_api_key

logger = logging.getLogger(__name__)


# Only block the most obvious, unambiguous profanity patterns
# Keep this very minimal - let LLM handle context-aware detection
_PROFANITY_PATTERNS = [
    # Only catch obvious, intentional profanity with asterisks or common misspellings
    r'\bf\*+ck\w*\b',
    r'\bf\*+k\w*\b',
    r'\bs\*+it\w*\b',
    r'\bs\*+t\w*\b',
    # Very explicit slurs or hate speech patterns (be very conservative here)
    # Note: We're NOT blocking words that might appear in legitimate news
]


def moderate_content(
    user_message: str,
    api_key: Optional[str] = None,
    use_llm: bool = True
) -> Tuple[bool, Optional[str]]:
    """
    Moderate user content to detect inappropriate language or queries.
    
    Args:
        user_message: The user's message to check
        api_key: Optional Gemini API key (will fetch if not provided)
        use_llm: Whether to use LLM-based moderation (more accurate but slower)
    
    Returns:
        Tuple of (is_appropriate: bool, reason: Optional[str])
        - If is_appropriate is True, content is safe
        - If False, reason explains why it was flagged
    """
    if not user_message or not user_message.strip():
        return True, None
    
    # Very minimal pattern check - only block obvious, intentional profanity
    # Most content should go through LLM for context-aware evaluation
    text_lower = user_message.lower()
    for pattern in _PROFANITY_PATTERNS:
        if re.search(pattern, text_lower, re.IGNORECASE):
            logger.info(f"[content_moderation] Blocked message due to obvious profanity (pattern match)")
            return False, "Your message contains inappropriate language. Please rephrase your question in a respectful way."
    
    # Use LLM-based moderation for more nuanced detection
    if use_llm:
        try:
            if not api_key:
                api_key = get_gemini_api_key()
            
            if not api_key:
                # No API key available, fall back to basic checks
                return True, None
            
            moderation_prompt = f"""You are a content moderation assistant for a news app designed for teens and young adults.

Analyze this user message and determine if it contains INAPPROPRIATE INTENT:
1. Intentional profanity or vulgar language used to be offensive (not just words that might appear in news)
2. Sexually explicit content or requests for explicit material
3. Hate speech, discrimination, or harassment directed at individuals or groups
4. Requests for harmful or illegal content
5. Clearly inappropriate language used with intent to be rude or offensive

User message: "{user_message}"

CRITICAL CONTEXT - BE VERY PERMISSIVE:
- This is a NEWS APP - questions about ANY news topics are LEGITIMATE, even if they mention sensitive subjects
- Words like "crime", "violence", "drug", "sex", "kill", etc. in news context are PERFECTLY FINE
- Only block if the USER'S INTENT is clearly to be offensive, rude, or inappropriate
- If the user is asking a legitimate question (even with potentially sensitive words), ALLOW IT
- Distinguish between: "What's the news about drugs?" (ALLOW) vs "Tell me about [explicit content]" (BLOCK)
- When in doubt, ALLOW the content - err on the side of permissiveness

Respond ONLY with a JSON object in this exact format:
{{
  "is_appropriate": true|false,
  "reason": "brief explanation if inappropriate, null if appropriate",
  "severity": "low|medium|high" (only if inappropriate)
}}

Examples of ALLOWED content (is_appropriate: true):
- "What happened in the recent election?" 
- "Tell me about the crime rate"
- "What's the news about drugs?"
- "Tell me about violence in the news"
- "What happened with the murder case?"
- "News about sexual harassment cases"
- "What's happening with drug policy?"

Examples of BLOCKED content (is_appropriate: false):
- Intentional profanity used to be offensive: "What the [profanity] is happening?"
- Explicit sexual requests: "[Explicit sexual content request]"
- Hate speech: "[Discriminatory language targeting groups]"
- Clearly inappropriate intent: "[Rude/offensive language with intent to be inappropriate]"
"""
            
            result = gemini_generate(
                contents=[{"role": "user", "parts": [moderation_prompt]}],
                api_key=api_key
            )
            
            resp = result.get("text", "")
            
            # Extract JSON from response
            import json
            json_match = re.search(r'\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}', resp, re.DOTALL)
            if json_match:
                data = json.loads(json_match.group())
                is_appropriate = data.get("is_appropriate", True)
                reason = data.get("reason")
                
                if not is_appropriate:
                    # Only block if severity is medium or high (low severity = allow through)
                    severity = data.get("severity", "medium").lower()
                    if severity == "low":
                        # Low severity = allow through, just log it
                        logger.info(f"[content_moderation] Low severity issue detected but allowing: {reason}")
                        return True, None
                    
                    # Provide a friendly, educational message for medium/high severity
                    user_facing_reason = (
                        reason or "Your message contains content that isn't appropriate for this platform. "
                        "Please rephrase your question in a respectful way. "
                        "Remember, you can ask about news topics, but please use appropriate language."
                    )
                    logger.info(f"[content_moderation] Blocked message (severity: {severity}): {reason}")
                    return False, user_facing_reason
                
                return True, None
        except Exception as e:
            # If moderation fails, log but don't block (fail open for availability)
            logger.warning(f"[content_moderation] Error in LLM moderation: {e}")
            # Fall back to basic checks
            return True, None
    
    # If we get here, content passed all checks
    return True, None


def is_content_appropriate(user_message: str, api_key: Optional[str] = None) -> bool:
    """
    Simple boolean check for content appropriateness.
    
    Returns:
        True if content is appropriate, False otherwise
    """
    is_ok, _ = moderate_content(user_message, api_key=api_key)
    return is_ok

