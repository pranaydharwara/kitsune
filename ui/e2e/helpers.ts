import type { Page } from '@playwright/test';

const MOCK_MODELS = {
  local: [
    { id: 'local:qwen3:4b', name: 'qwen3:4b', provider: 'local', size: '2.5GB' },
    { id: 'local:llama3:8b', name: 'llama3:8b', provider: 'local', size: '4.7GB' },
  ],
  cloud: [
    { id: 'claude:claude-sonnet-5-5-20250514', name: 'Sonnet 5.5', provider: 'claude', family: 'Claude 5' },
    { id: 'claude:claude-opus-5-5-20250514', name: 'Opus 5.5', provider: 'claude', family: 'Claude 5' },
    { id: 'claude:claude-opus-4-6-20250514', name: 'Opus 4.6', provider: 'claude', family: 'Claude 4' },
    { id: 'claude:claude-haiku-3-5-20241022', name: 'Haiku 3.5', provider: 'claude', family: 'Claude 3.5' },
  ],
};

const MOCK_CONVERSATIONS = [
  { id: 'conv-1', title: 'Test conversation', created_at: new Date().toISOString() },
];

export async function mockApi(page: Page) {
  await page.route('**/api/health', (route) =>
    route.fulfill({ json: { status: 'ok' } })
  );

  await page.route('**/api/models', (route) =>
    route.fulfill({ json: MOCK_MODELS })
  );

  await page.route('**/api/conversations', (route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({ json: MOCK_CONVERSATIONS });
    }
    return route.fulfill({ json: { id: 'conv-new', title: 'New chat' } });
  });

  await page.route('**/api/conversations/*/messages', (route) =>
    route.fulfill({ json: [] })
  );

  await page.route('**/api/settings', (route) =>
    route.fulfill({ json: { anthropic_api_key: '', has_api_key: false, default_mode: 'auto', default_model: null, theme: 'system' } })
  );

  await page.route('**/api/usage', (route) =>
    route.fulfill({ json: { total_messages: 0, cloud_messages: 0, local_messages: 0, total_tokens_in: 0, total_tokens_out: 0, total_cost: 0 } })
  );

  await page.route('**/api/conversations/export-all', (route) =>
    route.fulfill({ json: { content: '{}', filename: 'kitsune-export.json' } })
  );

  await page.route('**/api/conversations/import', (route) =>
    route.fulfill({ json: { imported: 0 } })
  );

  await page.route('**/api/chat', (route) => {
    const body = `data: {"type":"route","source":"local:qwen3:4b","reason":"auto-routed local"}\n\ndata: {"type":"token","text":"Hello"}\n\ndata: {"type":"token","text":" from"}\n\ndata: {"type":"token","text":" mock"}\n\ndata: {"type":"done","conversation_id":"conv-new","route":{"source":"local:qwen3:4b","reason":"auto-routed local"},"speed":42.5}\n\n`;
    return route.fulfill({
      status: 200,
      headers: { 'content-type': 'text/event-stream' },
      body,
    });
  });
}
