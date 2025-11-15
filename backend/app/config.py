import os
from typing import Optional, Dict, Any
from dotenv import load_dotenv, find_dotenv


_ENV_LOADED = False
_ENV_PATH: Optional[str] = None


def _ensure_env_loaded() -> None:
    global _ENV_LOADED, _ENV_PATH
    if _ENV_LOADED:
        return
    # Try nearest .env by walking up from CWD
    found = find_dotenv()
    if found:
        load_dotenv(found, override=False)
        _ENV_PATH = found
        _ENV_LOADED = True
        return
    # Fallback: repo root relative to this file: backend/app/ -> repo/.env
    repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    candidate = os.path.join(repo_root, ".env")
    if os.path.exists(candidate):
        load_dotenv(candidate, override=False)
        _ENV_PATH = candidate
    else:
        # Last resort: default load (may be no-op)
        load_dotenv(override=False)
        _ENV_PATH = None
    _ENV_LOADED = True


def _read_key(*names: str) -> str:
    for name in names:
        value = os.getenv(name)
        if value:
            trimmed = value.strip().strip('"').strip("'")
            if trimmed:
                return trimmed
    return ""


def get_newsapi_key() -> str:
    """Fetch NewsAPI key from environment/.env supporting common var names."""
    _ensure_env_loaded()
    return _read_key("NEWSAPI_KEY", "NEWS_API_KEY", "NEWSAPI_API_KEY")


def get_gemini_api_key() -> str:
    """Fetch Gemini API key from environment/.env supporting common var names."""
    _ensure_env_loaded()
    return _read_key("GEMINI_API_KEY", "GEMINI_KEY")


def get_env_debug() -> Dict[str, Any]:
    """Return safe env diagnostics (no secrets)."""
    _ensure_env_loaded()
    return {
        "env_path": _ENV_PATH,
        "has_newsapi": bool(get_newsapi_key()),
        "has_gemini": bool(get_gemini_api_key()),
        "cwd": os.getcwd(),
    }


