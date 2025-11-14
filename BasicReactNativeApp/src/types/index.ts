export interface Message {
  id: string;
  type: 'user' | 'agent';
  text: string;
  agentName?: string;
  isRouting?: boolean;
}

export interface ChatResponse {
  agent: string;
  response: string;
  error?: string;
  routing_message?: string;
  routed_from?: string;
}

export interface ConversationHistoryItem {
  role: 'user' | 'model';
  parts: string[];
}
