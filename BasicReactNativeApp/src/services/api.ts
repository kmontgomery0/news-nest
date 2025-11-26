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
 * Auth: Login user
 */
export const loginUser = async (email: string, password: string) => {
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.detail || 'Login failed');
  }
  return data;
};

/**
 * Auth: Register user
 */
export const registerUser = async (name: string, email: string, password: string) => {
  const response = await fetch(`${API_BASE_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password }),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.detail || 'Registration failed');
  }
  return data;
};

/**
 * Auth: Check email availability
 */
export const checkEmailAvailable = async (email: string): Promise<boolean> => {
  const url = `${API_BASE_URL}/auth/check-email?email=${encodeURIComponent(email)}`;
  const response = await fetch(url, { method: 'GET' });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.detail || 'Failed to check email');
  }
  return Boolean(data.available);
};

/**
 * Save user preferences
 */
export type UserPreferences = {
  email: string;
  parrot_name?: string;
  times?: string[];
  frequency?: string;
  push_notifications?: boolean;
  email_summaries?: boolean;
  topics?: string[];
};

export const saveUserPreferences = async (prefs: UserPreferences) => {
  const response = await fetch(`${API_BASE_URL}/auth/preferences`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(prefs),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.detail || 'Failed to save preferences');
  }
  return data;
};

/**
 * Save user profile (name and/or password)
 */
export const saveUserProfile = async (email: string, name?: string, password?: string) => {
  const payload: any = { email };
  if (name !== undefined) payload.name = name;
  if (password) payload.password = password;
  const response = await fetch(`${API_BASE_URL}/auth/profile`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.detail || 'Failed to update profile');
  }
  return data;
};

/**
 * Fetch user profile
 */
export const getUserProfile = async (email: string) => {
  const response = await fetch(`${API_BASE_URL}/auth/profile?email=${encodeURIComponent(email)}`);
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.detail || 'Failed to fetch profile');
  }
  return data as { email: string; name?: string; created_at?: string };
};

/**
 * Fetch user preferences
 */
export const getUserPreferences = async (email: string) => {
  const response = await fetch(`${API_BASE_URL}/auth/preferences?email=${encodeURIComponent(email)}`);
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.detail || 'Failed to fetch preferences');
  }
  return data as {
    email: string;
    parrot_name?: string;
    times?: string[];
    frequency?: string;
    push_notifications?: boolean;
    email_summaries?: boolean;
    topics?: string[];
  };
};
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
