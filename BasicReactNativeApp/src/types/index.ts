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
}

export interface ConversationHistoryItem {
  role: 'user' | 'model';
  parts: string[];
}
