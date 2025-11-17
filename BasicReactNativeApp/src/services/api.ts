import {API_BASE_URL, API_ENDPOINTS} from '../constants/api';
import {ChatResponse, ConversationHistoryItem} from '../types';

interface ChatRequest {
  agent: string;
  message: string;
  conversation_history?: ConversationHistoryItem[];
  api_key?: string;
  user_name?: string;
  parrot_name?: string;
}

/**
 * Send a message to the backend with conversation history and get agent response with automatic routing
 * 
 * @param message - User's message to send
 * @param conversationHistory - Previous conversation history for context
 * @param agent - Agent ID to use (default: 'polly' for auto-routing)
 * @returns Promise with the agent's response
 * @throws Error if the request fails
 */
export const sendMessage = async (
  message: string,
  conversationHistory: ConversationHistoryItem[] = [],
  agent: string = 'polly',
  userName?: string,
  parrotName?: string,
): Promise<ChatResponse> => {
  try {
    const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.CHAT_AND_ROUTE}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        agent,
        message,
        conversation_history: conversationHistory,
        user_name: userName,
        parrot_name: parrotName,
      } as ChatRequest),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.detail || `HTTP ${response.status}: Failed to get response`);
    }

    return data;
  } catch (error) {
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new Error(
        `Failed to connect to backend at ${API_BASE_URL}. ` +
        'Make sure the backend server is running. ' +
        'See README.md for setup instructions.'
      );
    }
    throw error;
  }
};

/**
 * Get list of available agents
 */
export const getAgents = async () => {
  const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.AGENTS_LIST}`);
  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.detail || 'Failed to get agents list');
  }
  
  return data;
};
