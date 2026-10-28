const BASE = window.location.protocol === 'tauri:'
  ? 'http://127.0.0.1:9848/api'
  : '/api';

export interface Project {
  id: string;
  name: string;
  path: string;
  icon: string | null;
  conversation_count: number;
  created_at: string;
}

export interface Conversation {
  id: string;
  title: string;
  project_id: string | null;
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
  tokens_in?: number;
  tokens_out?: number;
  cost_usd?: number;
  created_at: string;
}

export interface RouteInfo {
  source: string;
  reason: string;
}

export async function listProjects(): Promise<Project[]> {
  const res = await fetch(`${BASE}/projects`);
  return res.json();
}

export async function createProject(path: string, name?: string): Promise<Project> {
  const res = await fetch(`${BASE}/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, name }),
  });
  return res.json();
}

export async function deleteProject(id: string): Promise<void> {
  await fetch(`${BASE}/projects/${id}`, { method: 'DELETE' });
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

export async function updateConversation(id: string, fields: { title?: string; mode?: string; project_id?: string | null }): Promise<void> {
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

export async function cancelStream(conversationId: string): Promise<void> {
  await fetch(`${BASE}/chat/${conversationId}/cancel`, { method: 'POST' });
}

export async function submitFeedback(messageId: string, feedback: 'up' | 'down'): Promise<void> {
  await fetch(`${BASE}/chat/${messageId}/feedback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ feedback }),
  });
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

export interface ToolUseEvent {
  tool: string;
  arguments: Record<string, unknown>;
  status: 'running' | 'done';
  result?: Record<string, unknown>;
}

export interface StreamCallbacks {
  onToken: (text: string) => void;
  onDone: (data: { message: Message; conversation_id: string; route?: RouteInfo; speed?: number }) => void;
  onError: (error: string) => void;
  onRoute?: (route: RouteInfo) => void;
  onCancelled?: () => void;
  onToolUse?: (event: ToolUseEvent) => void;
}

export interface Settings {
  anthropic_api_key: string;
  has_api_key: boolean;
  default_mode: string;
  default_model: string | null;
  theme: string;
}

export interface UsageStats {
  total_messages: number;
  cloud_messages: number;
  local_messages: number;
  total_tokens_in: number;
  total_tokens_out: number;
  total_cost: number;
}

export async function getSettings(): Promise<Settings> {
  const res = await fetch(`${BASE}/settings`);
  return res.json();
}

export async function updateSettings(updates: Partial<Settings>): Promise<void> {
  await fetch(`${BASE}/settings`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
}

export async function clearApiKey(): Promise<void> {
  await fetch(`${BASE}/settings/api-key`, { method: 'DELETE' });
}

export async function getUsage(): Promise<UsageStats> {
  const res = await fetch(`${BASE}/usage`);
  return res.json();
}

export async function exportConversation(conversationId: string, format: 'json' | 'markdown' = 'json'): Promise<{ content: string; filename: string }> {
  const res = await fetch(`${BASE}/conversations/${conversationId}/export?format=${format}`);
  return res.json();
}

export async function exportAll(): Promise<{ content: string; filename: string }> {
  const res = await fetch(`${BASE}/conversations/export-all`);
  return res.json();
}

export async function importConversations(file: File): Promise<{ imported: number }> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${BASE}/conversations/import`, { method: 'POST', body: form });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Import failed');
  }
  return res.json();
}

export function streamChat(
  message: string,
  conversationId: string | null,
  callbacks: StreamCallbacks,
  options?: { mode?: string; model?: string; retryMessageId?: string; retryWith?: string; projectId?: string },
): AbortController {
  const controller = new AbortController();

  fetch(`${BASE}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      conversation_id: conversationId,
      project_id: options?.projectId || null,
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
            } else if (currentEvent === 'cancelled') {
              callbacks.onCancelled?.();
            } else if (currentEvent === 'done') {
              callbacks.onDone(data);
            } else if (currentEvent === 'route') {
              callbacks.onRoute?.(data);
            } else if (currentEvent === 'tool_use') {
              callbacks.onToolUse?.(data as ToolUseEvent);
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
