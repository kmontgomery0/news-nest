"""Helper functions for generating chart and timeline data from agent responses."""

from typing import Optional, Dict, Any, List
import json
import re
from .gemini import gemini_generate
from .config import get_gemini_api_key


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
    
    context_text = f"\n\nContext: {context}" if context else ""
    
    prompt = f"""Generate structured data for a {chart_type} chart about: {topic}

{context_text}

Create realistic, educational data points that would help a teen understand this topic.
For line/area charts, include timestamps (years or dates).
For bar/pie charts, use appropriate categories.

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
Use realistic values appropriate for the topic.
"""
    
    try:
        result = gemini_generate(contents=[{"role": "user", "parts": [prompt]}], api_key=api_key)
        resp = result.get("text", "")
        match = re.search(r'\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}', resp, re.DOTALL)
        if match:
            data = json.loads(match.group())
            return {
                "type": chart_type,
                "title": data.get("title", topic),
                "x_axis_label": data.get("x_axis_label"),
                "y_axis_label": data.get("y_axis_label"),
                "description": data.get("description"),
                "data_points": data.get("data_points", [])
            }
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
    
    prompt = f"""Generate structured data for a timeline about: {topic}

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

Use ISO format dates (YYYY-MM-DD). Include events in chronological order.
"""
    
    try:
        result = gemini_generate(contents=[{"role": "user", "parts": [prompt]}], api_key=api_key)
        resp = result.get("text", "")
        match = re.search(r'\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}', resp, re.DOTALL)
        if match:
            data = json.loads(match.group())
            return {
                "title": data.get("title", topic),
                "description": data.get("description"),
                "events": data.get("events", [])
            }
    except Exception as e:
        print(f"[chart_helper] Error generating timeline data: {e}")
    
    return None

