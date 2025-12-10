"""Helper functions for generating chart and timeline data from agent responses."""

from typing import Optional, Dict, Any, List, Tuple
import json
import re
from .gemini import gemini_generate
from .config import get_gemini_api_key


_CHART_CACHE: Dict[Tuple[str, str, str], Dict[str, Any]] = {}
_TIMELINE_CACHE: Dict[Tuple[str, str], Dict[str, Any]] = {}


def detect_chart_or_timeline_intent(user_message: str, agent_name: str, api_key: Optional[str] = None) -> Dict[str, Any]:
    """Detect if the user is asking for a chart, timeline, or other visualization.
    
    Returns:
        {
            "needs_visualization": bool,
            "visualization_type": "chart" | "timeline" | None,
            "chart_type": "line" | "bar" | "pie" | "area" | None,
            "topic": str (what the visualization should show)
        }
    """
    # Cheap keyword heuristic to avoid unnecessary LLM calls.
    lowered = (user_message or "").lower()

    # Time-range heuristic: questions like "renewable energy over the past 5 years"
    # or "climate change in the last ten years" should almost always be shown
    # as a line chart over time, even if the user never says "chart" or "graph".
    if (("past" in lowered or "last" in lowered) and "year" in lowered):
        return {
            "needs_visualization": True,
            "visualization_type": "chart",
            "chart_type": "line",
            "topic": user_message.strip(),
        }

    # Only bother checking with Gemini if the user clearly hints at a
    # visualization (chart/graph/trend/timeline/etc.).
    visualization_keywords = [
        "chart",
        "graph",
        "diagram",
        "trend",
        "trends",
        "over time",
        "timeline",
        "line graph",
        "bar chart",
        "pie chart",
        "visualize",
        "visualisation",
        "visualization",
    ]
    if not any(kw in lowered for kw in visualization_keywords):
        return {"needs_visualization": False}

    # Very cheap heuristics for common cases to avoid extra Gemini calls:
    # - "trends" or "over time" -> line chart over time
    # - "timeline" or "history"  -> timeline (not a chart)
    # - "compare X" / "vs" / "by country" -> bar chart
    if any(kw in lowered for kw in ["timeline", "time line", "chronology", "history of"]):
        # Historical / ordered events → use timeline visualization
        return {
            "needs_visualization": True,
            "visualization_type": "timeline",
            "chart_type": None,
            "topic": user_message.strip(),
        }

    if any(kw in lowered for kw in ["trend", "trends", "over time"]):
        # Trends over time → default to line chart
        return {
            "needs_visualization": True,
            "visualization_type": "chart",
            "chart_type": "line",
            "topic": user_message.strip(),
        }

    if any(kw in lowered for kw in ["compare", "vs ", " versus ", "by country", "by region", "by state"]):
        # Comparisons across categories → bar chart
        return {
            "needs_visualization": True,
            "visualization_type": "chart",
            "chart_type": "bar",
            "topic": user_message.strip(),
        }

    if not api_key:
        api_key = get_gemini_api_key()
    
    if not api_key:
        return {"needs_visualization": False}
    
    prompt = f"""Analyze this user message to determine if they want a chart, timeline, or other visualization.

User message: "{user_message}"
Agent: {agent_name}

Respond ONLY as JSON with keys:
{{
  "needs_visualization": true|false,
  "visualization_type": "chart"|"timeline"|null,
  "chart_type": "line"|"bar"|"pie"|"area"|null,
  "topic": "brief description of what to visualize"
}}

Examples:
- "show me trends of green energy over the years" -> {{"needs_visualization": true, "visualization_type": "chart", "chart_type": "line", "topic": "green energy adoption over time"}}
- "what's the timeline of climate change events" -> {{"needs_visualization": true, "visualization_type": "timeline", "chart_type": null, "topic": "climate change events timeline"}}
- "compare renewable energy by country" -> {{"needs_visualization": true, "visualization_type": "chart", "chart_type": "bar", "topic": "renewable energy by country"}}
"""
    
    try:
        result = gemini_generate(contents=[{"role": "user", "parts": [prompt]}], api_key=api_key)
        resp = result.get("text", "")
        match = re.search(r'\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}', resp, re.DOTALL)
        if match:
            data = json.loads(match.group())
            return {
                "needs_visualization": bool(data.get("needs_visualization", False)),
                "visualization_type": data.get("visualization_type"),
                "chart_type": data.get("chart_type"),
                "topic": data.get("topic", "")
            }
    except Exception as e:
        print(f"[chart_helper] Error detecting visualization intent: {e}")
    
    return {"needs_visualization": False}


def generate_chart_data(
    topic: str,
    chart_type: str,
    context: Optional[str] = None,
    api_key: Optional[str] = None
) -> Optional[Dict[str, Any]]:
    """Generate structured chart data using LLM.
    
    Args:
        topic: What the chart should show
        chart_type: "line", "bar", "pie", "area", etc.
        context: Optional context from conversation or news
        api_key: Gemini API key
    
    Returns:
        ChartData dict or None if generation fails
    """
    if not api_key:
        api_key = get_gemini_api_key()
    
    if not api_key:
        return None
    
    # Normalize chart_type
    chart_type = (chart_type or "line").lower()
    if chart_type not in ["line", "bar", "pie", "area"]:
        chart_type = "line"

    context_text = f"\n\nContext: {context}" if context else ""

    # Simple in-memory cache to reduce duplicate Gemini calls for the same
    # topic/chart/context within a running backend process.
    cache_key = (chart_type, topic.strip(), context_text.strip())
    if cache_key in _CHART_CACHE:
        return _CHART_CACHE[cache_key]
    
    prompt = f"""You are a careful data formatting assistant.
Generate structured data for a {chart_type} chart about: {topic}

{context_text}

Create realistic, educational data points that would help a teen understand this topic.
For line/area charts, include timestamps (years or dates).
For bar/pie charts, use appropriate categories (4–10 total).

CRITICAL READABILITY RULES:
- Limit data_points to between 4 and 10 items so the chart is not crowded.
- For trend/\"over time\" topics, prefer evenly spaced years or dates.
- Keep values in a reasonable range (e.g., percentages between 0 and 100 where appropriate).

Respond ONLY as JSON in this exact format:
{{
  "title": "Chart title",
  "x_axis_label": "X-axis label (e.g., 'Year', 'Country')",
  "y_axis_label": "Y-axis label (e.g., 'Percentage', 'Amount')",
  "description": "Brief description of what the chart shows",
  "data_points": [
    {{"label": "Label", "value": 0.0, "timestamp": "2020-01-01"}},
    {{"label": "Label", "value": 0.0, "timestamp": "2021-01-01"}}
  ]
}}

For time-series data (line/area charts), include "timestamp" in ISO format (YYYY-MM-DD).
For categorical data (bar/pie charts), omit "timestamp" or set to null.
Use realistic values appropriate for the topic and keep the total number of data_points between 4 and 10.
"""
    
    try:
        result = gemini_generate(contents=[{"role": "user", "parts": [prompt]}], api_key=api_key)
        resp = result.get("text", "")
        match = re.search(r'\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}', resp, re.DOTALL)
        if match:
            data = json.loads(match.group())
            chart = {
                "type": chart_type,
                "title": data.get("title", topic),
                "x_axis_label": data.get("x_axis_label"),
                "y_axis_label": data.get("y_axis_label"),
                "description": data.get("description"),
                "data_points": data.get("data_points", []),
            }
            # Cache successful generations to avoid repeat calls
            _CHART_CACHE[cache_key] = chart
            return chart
    except Exception as e:
        print(f"[chart_helper] Error generating chart data: {e}")
    
    return None


def generate_timeline_data(
    topic: str,
    context: Optional[str] = None,
    api_key: Optional[str] = None
) -> Optional[Dict[str, Any]]:
    """Generate structured timeline data using LLM.
    
    Args:
        topic: What the timeline should show
        context: Optional context from conversation or news
        api_key: Gemini API key
    
    Returns:
        TimelineData dict or None if generation fails
    """
    if not api_key:
        api_key = get_gemini_api_key()
    
    if not api_key:
        return None
    
    context_text = f"\n\nContext: {context}" if context else ""

    cache_key = (topic.strip(), context_text.strip())
    if cache_key in _TIMELINE_CACHE:
        return _TIMELINE_CACHE[cache_key]
    
    prompt = f"""You are a careful data formatting assistant.
Generate structured data for a timeline about: {topic}

{context_text}

Create 5-10 key events in chronological order that would help a teen understand this topic.
Use real historical events when possible, or realistic examples if it's a conceptual timeline.

Respond ONLY as JSON in this exact format:
{{
  "title": "Timeline title",
  "description": "Brief description of what the timeline shows",
  "events": [
    {{
      "date": "2020-01-01",
      "title": "Event title",
      "description": "Brief description of the event",
      "category": "Optional category"
    }}
  ]
}}

Use ISO format dates (YYYY-MM-DD). Include events in chronological order and keep the number of events between 5 and 10.
"""
    
    try:
        result = gemini_generate(contents=[{"role": "user", "parts": [prompt]}], api_key=api_key)
        resp = result.get("text", "")
        match = re.search(r'\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}', resp, re.DOTALL)
        if match:
            data = json.loads(match.group())
            timeline = {
                "title": data.get("title", topic),
                "description": data.get("description"),
                "events": data.get("events", []),
            }
            _TIMELINE_CACHE[cache_key] = timeline
            return timeline
    except Exception as e:
        print(f"[chart_helper] Error generating timeline data: {e}")
    
    return None

