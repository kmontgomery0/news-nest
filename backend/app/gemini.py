import google.generativeai as genai
from typing import List, Dict, Any, Optional
import time


def gemini_generate(
    contents: List[Dict[str, Any]],
    system_prompt: str = "",
    api_key: Optional[str] = None,
) -> Dict[str, Any]:
    """Generate content using Gemini API."""
    if not api_key:
        raise ValueError("GEMINI_API_KEY not set")

    genai.configure(api_key=api_key)
    
    # Configure model with system instruction if provided
    # Using gemini-1.5-flash for better free tier availability
    if system_prompt:
        model = genai.GenerativeModel(
            model_name="gemini-2.5-flash",
            system_instruction=system_prompt,
        )
    else:
        model = genai.GenerativeModel(
            model_name="gemini-2.5-flash",
        )

    # Convert contents to Gemini format
    # Contents should be a list of dicts with 'role' and 'parts' keys
    # If it's already in the right format, use as-is
    formatted_contents = []
    for content in contents:
        if isinstance(content, str):
            formatted_contents.append({"role": "user", "parts": [content]})
        elif isinstance(content, dict) and "role" in content and "parts" in content:
            formatted_contents.append(content)
        else:
            # Try to extract text from dict if it has a 'text' or 'message' key
            text = content.get("text") or content.get("message") or str(content)
            formatted_contents.append({"role": "user", "parts": [text]})

    # Retry strategy: up to 3 attempts with exponential backoff
    max_attempts = 3
    last_error_msg = None
    for attempt in range(1, max_attempts + 1):
        try:
            response = model.generate_content(formatted_contents)
            text = response.text if hasattr(response, "text") and response.text else ""
            return {"text": text, "raw": response}
        except Exception as e:
            error_msg = str(e)
            last_error_msg = error_msg
            is_quota = (
                "429" in error_msg
                or "quota" in error_msg.lower()
                or "quota exceeded" in error_msg.lower()
            )
            # If not last attempt, wait then retry
            if attempt < max_attempts:
                # Gentle exponential backoff
                delay_seconds = 0.5 * (2 ** (attempt - 1))
                time.sleep(delay_seconds)
                continue
            # On final failure, raise a user-friendly error
            if is_quota:
                raise ValueError(
                    "Gemini rate limit reached. Please wait a moment and try again. "
                    f"Details: {error_msg[:200]}"
                )
            raise ValueError(
                "We hit a temporary issue contacting Gemini. Please try again shortly. "
                f"Details: {error_msg[:200]}"
            )

