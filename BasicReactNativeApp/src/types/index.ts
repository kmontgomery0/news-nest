export interface Message {
  id: string;
  type: 'user' | 'agent';
  text: string;
  agentName?: string;
  isRouting?: boolean;
  hasArticleReference?: boolean;
}

export interface ChatResponse {
  agent: string;
  response: string;
  error?: string;
  routing_message?: string;
  routed_from?: string;
  has_article_reference?: boolean;
  target_agent_name?: string;
}

export interface ConversationHistoryItem {
  role: 'user' | 'model';
  parts: string[];
}
