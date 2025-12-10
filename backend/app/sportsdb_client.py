from __future__ import annotations

"""
Thin client for TheSportsDB to fetch schedules/scores and normalize them into
simple dicts that the frontend can render (past / live / upcoming games).
"""

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
import os

import requests


def _get_api_key() -> str:
    """
    Read TheSportsDB API key from env, defaulting to the public demo key '123'.
    """
    return os.getenv("THESPORTSDB_KEY", "123").strip() or "123"


def _base_url() -> str:
    return f"https://www.thesportsdb.com/api/v1/json/{_get_api_key()}"


# Known league ID mappings for common US leagues we care about.
# These IDs come from TheSportsDB documentation.
LEAGUE_IDS: Dict[tuple[str, str], str] = {
    ("NFL", "American Football"): "4391",
    ("NBA", "Basketball"): "4387",
}


def _short_name(name: Optional[str]) -> str:
    if not name:
        return ""
    parts = name.split()
    return parts[-1] if parts else name


def _classify_status(ev: Dict[str, Any]) -> str:
    """Map a TheSportsDB event into 'past' | 'live' | 'upcoming'."""
    home = ev.get("intHomeScore")
    away = ev.get("intAwayScore")
    status = (ev.get("strStatus") or "").lower()

    if status in ("live", "in play", "in-play"):
        return "live"

    # Scores present and not explicitly live → treat as finished
    if home is not None or away is not None:
        return "past"

    # Fallback: compare timestamp with "now"
    ts = (
        ev.get("strTimestamp")
        or (ev.get("dateEvent") or "") + " " + (ev.get("strTime") or "")
    ).strip()
    try:
        if "t" not in ts.lower() and " " in ts:
            ts = ts.replace(" ", "T", 1)
        dt = datetime.fromisoformat(ts)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        now = datetime.now(timezone.utc)
        return "upcoming" if dt > now else "past"
    except Exception:
        # If we can't parse the date, assume upcoming (safer UX)
        return "upcoming"


def normalize_event(ev: Dict[str, Any]) -> Dict[str, Any]:
    """
    Normalize a TheSportsDB event into a SportsGame-shaped dict for the frontend.
    """
    status = _classify_status(ev)

    def _to_int(value: Any) -> Optional[int]:
        if value is None or value == "":
            return None
        try:
            return int(value)
        except Exception:
            return None

    return {
        "id": ev.get("idEvent"),
        "sport": ev.get("strSport"),
        "leagueId": ev.get("idLeague"),
        "leagueName": ev.get("strLeague"),
        "date": ev.get("dateEvent"),
        "timeLocal": ev.get("strTime"),  # TheSportsDB local time string
        "status": status,  # 'past' | 'live' | 'upcoming'
        "venueName": ev.get("strVenue"),
        "homeTeam": {
            "id": ev.get("idHomeTeam"),
            "name": ev.get("strHomeTeam"),
            "shortName": _short_name(ev.get("strHomeTeam")),
            "badgeUrl": ev.get("strHomeBadge"),
        },
        "awayTeam": {
            "id": ev.get("idAwayTeam"),
            "name": ev.get("strAwayTeam"),
            "shortName": _short_name(ev.get("strAwayTeam")),
            "badgeUrl": ev.get("strAwayBadge"),
        },
        "homeScore": _to_int(ev.get("intHomeScore")),
        "awayScore": _to_int(ev.get("intAwayScore")),
    }


def fetch_events_day(
    date_iso: str,
    *,
    sport: Optional[str] = None,
    league: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """
    Fetch events for a specific day using TheSportsDB eventsday.php endpoint.

    Args:
        date_iso: Date in YYYY-MM-DD format.
        sport: Optional sport filter (e.g., "Basketball").
        league: Optional league filter (name or ID, e.g., "NBA" or "4328").
    """
    params: Dict[str, Any] = {"d": date_iso}
    if sport:
        params["s"] = sport
    if league:
        params["l"] = league

    url = f"{_base_url()}/eventsday.php"
    print(f"[sportsdb] GET {url} params={params}")
    resp = requests.get(url, params=params, timeout=15)
    resp.raise_for_status()
    data = resp.json()
    events = data.get('events') or []
    print(f"[sportsdb] eventsday returned {len(events)} events")
    return [normalize_event(ev) for ev in events]


def fetch_past_league_events(
    league: str,
    *,
    limit: int = 20,
) -> List[Dict[str, Any]]:
    """
    Fetch most recent completed events for a league using eventspastleague.php.

    `league` can be a league name (e.g. 'NFL') or a numeric league ID string.
    We map common names to their numeric IDs via LEAGUE_IDS.
    """
    league_id = league
    if not league_id.isdigit():
        for (name, _sport), lid in LEAGUE_IDS.items():
            if name.lower() == league.lower():
                league_id = lid
                break

    params: Dict[str, Any] = {'id': league_id}
    url = f"{_base_url()}/eventspastleague.php"
    print(f"[sportsdb] GET {url} params={params}")
    resp = requests.get(url, params=params, timeout=15)
    resp.raise_for_status()
    data = resp.json()
    events = data.get('events') or []
    print(f"[sportsdb] eventspastleague returned {len(events)} events")

    if not events:
        return []

    # Determine most recent event date and return all events from that date
    def _event_date(ev: Dict[str, Any]) -> str:
        return (ev.get('dateEvent') or '')  # ISO date string

    latest_date = max(_event_date(e) for e in events if _event_date(e))
    latest_events = [e for e in events if _event_date(e) == latest_date]
    latest_events = latest_events[:limit]
    print(f"[sportsdb] filtered to {len(latest_events)} events on latest date {latest_date}")
    return [normalize_event(ev) for ev in latest_events]

