export interface ChartDataPoint {
  label: string;
  value: number;
  timestamp?: string | null;
}

export interface ChartData {
  type: string; // "line", "bar", "pie", "area", etc.
  title: string;
  x_axis_label?: string | null;
  y_axis_label?: string | null;
  data_points: ChartDataPoint[];
  description?: string | null;
}

export interface TimelineEvent {
  date: string; // ISO format date string
  title: string;
  description?: string | null;
  category?: string | null;
}

export interface TimelineData {
  title: string;
  events: TimelineEvent[];
  description?: string | null;
}

export type SportsGameStatus = 'past' | 'live' | 'upcoming';

export interface SportsTeam {
  id: string;
  name: string;
  shortName: string;
  badgeUrl?: string | null;
}

export interface SportsGame {
  id: string;
  sport: string;
  leagueId?: string;
  leagueName?: string;
  date: string;
  timeLocal?: string | null;
  status: SportsGameStatus;
  venueName?: string | null;
  homeTeam: SportsTeam;
  awayTeam: SportsTeam;
  homeScore?: number | null;
  awayScore?: number | null;
}

export interface TeamStanding {
  team: SportsTeam;
  rank: number;
  gamesPlayed: number;
  wins: number;
  losses: number;
  draws?: number;
  winPct?: number;
  streakType?: 'W' | 'L' | 'D';
  streakLength?: number;
}

export interface LeagueStandings {
  leagueId: string;
  leagueName: string;
  season?: string;
  conference?: string;
  rows: TeamStanding[];
}

export interface SportsScoreboardResponse {
  date: string;
  games: SportsGame[];
}

export interface Message {
  id: string;
  type: 'user' | 'agent' | 'system';
  text: string;
  agentName?: string;
  isRouting?: boolean;
  hasArticleReference?: boolean;
  articleCards?: {
    headline: string;
    url?: string | null;
    sourceName?: string | null;
    tags?: string[] | null;
  }[];
  chart?: ChartData | null;
  timeline?: TimelineData | null;
  scoreboard?: SportsScoreboardResponse | null;
}

export interface ChatResponse {
  agent: string;
  response: string;
  error?: string;
  routing_message?: string;
  routed_from?: string;
  has_article_reference?: boolean;
  target_agent_name?: string;
  articles?: {
    headline: string;
    url?: string | null;
    source_name?: string | null;
    tags?: string[] | null;
  }[];
  chart?: ChartData | null;
  timeline?: TimelineData | null;
  scoreboard?: SportsScoreboardResponse | null;
}

export interface ConversationHistoryItem {
  role: 'user' | 'model';
  parts: string[];
}
