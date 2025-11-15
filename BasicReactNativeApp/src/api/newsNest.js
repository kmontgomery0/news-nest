// Simple client for News Nest backend
import { Platform } from 'react-native';

const DEFAULT_BASE =
  Platform.OS === 'android' ? 'http://10.0.2.2:8000' : 'http://localhost:8000';

export const API_BASE = DEFAULT_BASE;

async function postJson(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.detail || `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return data;
}

export async function chatWithPolly(message, geminiApiKeyOptional) {
  // On first message (no history), Polly will include top 10 headlines automatically
  const url = `${API_BASE}/agents/chat`;
  const payload = {
    agent: 'polly',
    message,
    api_key: geminiApiKeyOptional || null,
  };
  return await postJson(url, payload);
}

export async function getPollyWelcome(geminiApiKeyOptional) {
  const url = `${API_BASE}/agents/polly/welcome${geminiApiKeyOptional ? `?api_key=${encodeURIComponent(geminiApiKeyOptional)}` : ''}`;
  const res = await fetch(url, { method: 'GET' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.detail || `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return data;
}

export async function routeOnly(message, geminiApiKeyOptional) {
  const url = `${API_BASE}/agents/route-only`;
  const payload = {
    agent: 'polly',
    message,
    api_key: geminiApiKeyOptional || null,
  };
  return await postJson(url, payload);
}

export async function chatWithAgent(agentId, message, geminiApiKeyOptional) {
  const url = `${API_BASE}/agents/chat`;
  const payload = {
    agent: agentId,
    message,
    api_key: geminiApiKeyOptional || null,
  };
  return await postJson(url, payload);
}


