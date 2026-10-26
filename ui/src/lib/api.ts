const BASE = '/api';

export interface Conversation {
  id: string;
  title: string;
  mode: string;
  escalated: boolean;
  created_at: string;
  last_message?: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant';
  text: string;
  answered_by?: string;
  latency_ms?: number;
  created_at: string;
}

export interface RouteInfo {
  source: string;
  reason: string;
}

export async function listConversations(): Promise<Conversation[]> {
  const res = await fetch(`${BASE}/conversations`);
  return res.json();
}

export async function getMessages(conversationId: string): Promise<Message[]> {
  const res = await fetch(`${BASE}/conversations/${conversationId}/messages`);
  return res.json();
}

export async function deleteConversation(id: string): Promise<void> {
  await fetch(`${BASE}/conversations/${id}`, { method: 'DELETE' });
}

export async function updateConversation(id: string, fields: { title?: string; mode?: string }): Promise<void> {
  await fetch(`${BASE}/conversations/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(fields),
  });
}

export async function getContextSnapshot(messageId: string): Promise<{ prompt_text: string | null; token_estimate: number | null }> {
  const res = await fetch(`${BASE}/chat/${messageId}/context`);
  return res.json();
}

export interface LocalModel {
  id: string;
  name: string;
  provider: 'local';
  size?: string;
}

export interface CloudModel {
  id: string;
  name: string;
  provider: 'claude';
  family?: string;
}

export interface ModelsResponse {
  local: LocalModel[];
  cloud: CloudModel[];
}

export async function listModels(): Promise<ModelsResponse> {
  const res = await fetch(`${BASE}/models`);
  if (!res.ok) return { local: [], cloud: [] };
  return res.json();
}

export interface StreamCallbacks {
  onToken: (text: string) => void;
  onDone: (data: { message: Message; conversation_id: string; route?: RouteInfo }) => void;
  onError: (error: string) => void;
  onRoute?: (route: RouteInfo) => void;
}

export function streamChat(
  message: string,
  conversationId: string | null,
  callbacks: StreamCallbacks,
  options?: { mode?: string; model?: string; retryMessageId?: string; retryWith?: string },
): AbortController {
  const controller = new AbortController();

  fetch(`${BASE}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      conversation_id: conversationId,
      mode: options?.mode || 'auto',
      model: options?.model || null,
      retry_message_id: options?.retryMessageId || null,
      retry_with: options?.retryWith || null,
    }),
    signal: controller.signal,
  }).then(async (res) => {
    const reader = res.body?.getReader();
    if (!reader) return;

    const decoder = new TextDecoder();
    let buffer = '';
    let currentEvent = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('event: ')) {
          currentEvent = line.slice(7).trim();
        } else if (line.startsWith('data: ')) {
          const raw = line.slice(6);
          try {
            const data = JSON.parse(raw);
            if (currentEvent === 'error') {
              callbacks.onError(data.error || 'Unknown error');
            } else if (currentEvent === 'done') {
              callbacks.onDone(data);
            } else if (currentEvent === 'route') {
              callbacks.onRoute?.(data);
            } else {
              if (data.text) {
                callbacks.onToken(data.text);
              }
            }
          } catch {
            // skip malformed JSON
          }
          currentEvent = '';
        }
      }
    }
  }).catch((err) => {
    if (err.name !== 'AbortError') {
      callbacks.onError(err.message);
    }
  });

  return controller;
}
