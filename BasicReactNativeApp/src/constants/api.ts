import {ENV} from '../config/environment';

// Backend API URL - configured via environment.ts
export const API_BASE_URL = ENV.apiBaseUrl;

export const API_ENDPOINTS = {
  CHAT_AND_ROUTE: '/agents/chat-and-route',
  CHAT: '/agents/chat',
  AGENTS_LIST: '/agents/list',
} as const;

