export interface Message {
  id: string;
  type: 'user' | 'agent';
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
}

export interface ConversationHistoryItem {
  role: 'user' | 'model';
  parts: string[];
}
