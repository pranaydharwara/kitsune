import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.restoreAllMocks()
})

function mockJsonResponse(data: unknown, ok = true) {
  return Promise.resolve({
    ok,
    json: () => Promise.resolve(data),
    body: null,
  })
}

describe('API module', () => {
  it('uses /api as base when not tauri protocol', async () => {
    fetchMock.mockReturnValue(mockJsonResponse([]))
    const { listProjects } = await import('./api')
    await listProjects()
    expect(fetchMock).toHaveBeenCalledWith('/api/projects')
  })
})

describe('listProjects', () => {
  it('fetches and returns projects', async () => {
    const projects = [{ id: '1', name: 'test' }]
    fetchMock.mockReturnValue(mockJsonResponse(projects))
    const { listProjects } = await import('./api')
    const result = await listProjects()
    expect(result).toEqual(projects)
  })
})

describe('createProject', () => {
  it('sends POST with path and name', async () => {
    fetchMock.mockReturnValue(mockJsonResponse({ id: '1', name: 'proj' }))
    const { createProject } = await import('./api')
    await createProject('/path/to/proj', 'proj')
    expect(fetchMock).toHaveBeenCalledWith('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: '/path/to/proj', name: 'proj' }),
    })
  })
})

describe('deleteProject', () => {
  it('sends DELETE', async () => {
    fetchMock.mockReturnValue(mockJsonResponse(undefined))
    const { deleteProject } = await import('./api')
    await deleteProject('abc')
    expect(fetchMock).toHaveBeenCalledWith('/api/projects/abc', { method: 'DELETE' })
  })
})

describe('listConversations', () => {
  it('fetches conversations', async () => {
    const convs = [{ id: 'c1', title: 'Chat' }]
    fetchMock.mockReturnValue(mockJsonResponse(convs))
    const { listConversations } = await import('./api')
    const result = await listConversations()
    expect(result).toEqual(convs)
  })
})

describe('getMessages', () => {
  it('fetches messages for a conversation', async () => {
    const msgs = [{ id: 'm1', role: 'user', text: 'hi' }]
    fetchMock.mockReturnValue(mockJsonResponse(msgs))
    const { getMessages } = await import('./api')
    const result = await getMessages('c1')
    expect(result).toEqual(msgs)
    expect(fetchMock).toHaveBeenCalledWith('/api/conversations/c1/messages')
  })
})

describe('deleteConversation', () => {
  it('sends DELETE', async () => {
    fetchMock.mockReturnValue(mockJsonResponse(undefined))
    const { deleteConversation } = await import('./api')
    await deleteConversation('c1')
    expect(fetchMock).toHaveBeenCalledWith('/api/conversations/c1', { method: 'DELETE' })
  })
})

describe('updateConversation', () => {
  it('sends PATCH with fields', async () => {
    fetchMock.mockReturnValue(mockJsonResponse(undefined))
    const { updateConversation } = await import('./api')
    await updateConversation('c1', { title: 'New title', starred: true })
    expect(fetchMock).toHaveBeenCalledWith('/api/conversations/c1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'New title', starred: true }),
    })
  })
})

describe('forkConversation', () => {
  it('sends POST with message_id', async () => {
    fetchMock.mockReturnValue(mockJsonResponse({ id: 'new', title: 'Fork' }))
    const { forkConversation } = await import('./api')
    const result = await forkConversation('c1', 'm1')
    expect(result).toEqual({ id: 'new', title: 'Fork' })
  })
})

describe('editMessage', () => {
  it('sends PUT with text', async () => {
    fetchMock.mockReturnValue(mockJsonResponse(undefined))
    const { editMessage } = await import('./api')
    await editMessage('c1', 'm1', 'updated text')
    expect(fetchMock).toHaveBeenCalledWith('/api/conversations/c1/messages/m1', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'updated text' }),
    })
  })
})

describe('getConversationUsage', () => {
  it('fetches usage stats', async () => {
    const usage = { total_messages: 10 }
    fetchMock.mockReturnValue(mockJsonResponse(usage))
    const { getConversationUsage } = await import('./api')
    const result = await getConversationUsage('c1')
    expect(result).toEqual(usage)
  })
})

describe('getContextSnapshot', () => {
  it('fetches context snapshot', async () => {
    const snap = { prompt_text: 'hello', token_estimate: 5 }
    fetchMock.mockReturnValue(mockJsonResponse(snap))
    const { getContextSnapshot } = await import('./api')
    const result = await getContextSnapshot('m1')
    expect(result).toEqual(snap)
  })
})

describe('cancelStream', () => {
  it('sends POST to cancel', async () => {
    fetchMock.mockReturnValue(mockJsonResponse(undefined))
    const { cancelStream } = await import('./api')
    await cancelStream('c1')
    expect(fetchMock).toHaveBeenCalledWith('/api/chat/c1/cancel', { method: 'POST' })
  })
})

describe('submitFeedback', () => {
  it('sends feedback', async () => {
    fetchMock.mockReturnValue(mockJsonResponse(undefined))
    const { submitFeedback } = await import('./api')
    await submitFeedback('m1', 'up')
    expect(fetchMock).toHaveBeenCalledWith('/api/chat/m1/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ feedback: 'up' }),
    })
  })
})

describe('listModels', () => {
  it('returns models on success', async () => {
    const models = { local: [{ id: 'a' }], cloud: [] }
    fetchMock.mockReturnValue(mockJsonResponse(models))
    const { listModels } = await import('./api')
    const result = await listModels()
    expect(result).toEqual(models)
  })

  it('returns empty on failure', async () => {
    fetchMock.mockReturnValue(Promise.resolve({ ok: false, json: () => Promise.resolve({}) }))
    const { listModels } = await import('./api')
    const result = await listModels()
    expect(result).toEqual({ local: [], cloud: [] })
  })
})

describe('getSettings', () => {
  it('fetches settings', async () => {
    const settings = { anthropic_api_key: '', has_api_key: false }
    fetchMock.mockReturnValue(mockJsonResponse(settings))
    const { getSettings } = await import('./api')
    const result = await getSettings()
    expect(result).toEqual(settings)
  })
})

describe('updateSettings', () => {
  it('sends PUT with updates', async () => {
    fetchMock.mockReturnValue(mockJsonResponse(undefined))
    const { updateSettings } = await import('./api')
    await updateSettings({ theme: 'dark' })
    expect(fetchMock).toHaveBeenCalledWith('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ theme: 'dark' }),
    })
  })
})

describe('clearApiKey', () => {
  it('sends DELETE', async () => {
    fetchMock.mockReturnValue(mockJsonResponse(undefined))
    const { clearApiKey } = await import('./api')
    await clearApiKey()
    expect(fetchMock).toHaveBeenCalledWith('/api/settings/api-key', { method: 'DELETE' })
  })
})

describe('getUsage', () => {
  it('fetches usage', async () => {
    const usage = { total_messages: 5 }
    fetchMock.mockReturnValue(mockJsonResponse(usage))
    const { getUsage } = await import('./api')
    const result = await getUsage()
    expect(result).toEqual(usage)
  })
})

describe('exportConversation', () => {
  it('fetches export with format', async () => {
    const exp = { content: '{}', filename: 'chat.json' }
    fetchMock.mockReturnValue(mockJsonResponse(exp))
    const { exportConversation } = await import('./api')
    const result = await exportConversation('c1', 'markdown')
    expect(result).toEqual(exp)
    expect(fetchMock).toHaveBeenCalledWith('/api/conversations/c1/export?format=markdown')
  })
})

describe('exportAll', () => {
  it('fetches all exports', async () => {
    const exp = { content: '{}', filename: 'all.json' }
    fetchMock.mockReturnValue(mockJsonResponse(exp))
    const { exportAll } = await import('./api')
    const result = await exportAll()
    expect(result).toEqual(exp)
  })
})

describe('importConversations', () => {
  it('posts file and returns result', async () => {
    fetchMock.mockReturnValue(mockJsonResponse({ imported: 3 }))
    const { importConversations } = await import('./api')
    const file = new File(['{}'], 'data.json', { type: 'application/json' })
    const result = await importConversations(file)
    expect(result).toEqual({ imported: 3 })
  })

  it('throws on error response', async () => {
    fetchMock.mockReturnValue(Promise.resolve({
      ok: false,
      json: () => Promise.resolve({ error: 'bad format' }),
    }))
    const { importConversations } = await import('./api')
    const file = new File(['bad'], 'data.json')
    await expect(importConversations(file)).rejects.toThrow('bad format')
  })
})

describe('getProjectInstructions', () => {
  it('fetches instructions', async () => {
    const info = { found: true, file: '.kitsune.md', content: 'rules' }
    fetchMock.mockReturnValue(mockJsonResponse(info))
    const { getProjectInstructions } = await import('./api')
    const result = await getProjectInstructions('p1')
    expect(result).toEqual(info)
  })
})

describe('setProjectInstructions', () => {
  it('sends PUT with content', async () => {
    fetchMock.mockReturnValue(mockJsonResponse(undefined))
    const { setProjectInstructions } = await import('./api')
    await setProjectInstructions('p1', 'new rules')
    expect(fetchMock).toHaveBeenCalledWith('/api/projects/p1/instructions', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'new rules' }),
    })
  })
})

describe('searchFiles', () => {
  it('posts search query', async () => {
    fetchMock.mockReturnValue(mockJsonResponse({ results: [] }))
    const { searchFiles } = await import('./api')
    await searchFiles('p1', 'test')
    expect(fetchMock).toHaveBeenCalledWith('/api/search/files', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project_id: 'p1', query: 'test', limit: 20 }),
    })
  })
})

describe('searchContent', () => {
  it('posts content search', async () => {
    fetchMock.mockReturnValue(mockJsonResponse({ results: [] }))
    const { searchContent } = await import('./api')
    await searchContent('p1', 'TODO')
    expect(fetchMock).toHaveBeenCalledWith('/api/search/content', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project_id: 'p1', query: 'TODO', limit: 10 }),
    })
  })
})

describe('getMentionCompletions', () => {
  it('posts completion query', async () => {
    fetchMock.mockReturnValue(mockJsonResponse({ completions: [] }))
    const { getMentionCompletions } = await import('./api')
    await getMentionCompletions('@file', 'p1')
    expect(fetchMock).toHaveBeenCalledWith('/api/mentions/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: '@file', project_id: 'p1' }),
    })
  })
})

describe('streamChat', () => {
  it('sends chat request and processes SSE events', async () => {
    const encoder = new TextEncoder()
    const events = [
      'event: token\ndata: {"text":"Hello"}\n\n',
      'event: route\ndata: {"source":"local","reason":"simple"}\n\n',
      'event: done\ndata: {"message":{"id":"m1"},"conversation_id":"c1"}\n\n',
    ].join('')

    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(events))
        controller.close()
      },
    })

    fetchMock.mockReturnValue(Promise.resolve({
      body: stream,
    }))

    const { streamChat } = await import('./api')
    const onToken = vi.fn()
    const onDone = vi.fn()
    const onError = vi.fn()
    const onRoute = vi.fn()

    streamChat('hello', null, { onToken, onDone, onError, onRoute })

    await vi.waitFor(() => {
      expect(onToken).toHaveBeenCalledWith('Hello')
    })
    await vi.waitFor(() => {
      expect(onDone).toHaveBeenCalled()
    })
  })

  it('handles error events', async () => {
    const encoder = new TextEncoder()
    const events = 'event: error\ndata: {"error":"Something went wrong"}\n\n'

    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(events))
        controller.close()
      },
    })

    fetchMock.mockReturnValue(Promise.resolve({ body: stream }))

    const { streamChat } = await import('./api')
    const onToken = vi.fn()
    const onDone = vi.fn()
    const onError = vi.fn()

    streamChat('hello', 'c1', { onToken, onDone, onError })

    await vi.waitFor(() => {
      expect(onError).toHaveBeenCalledWith('Something went wrong')
    })
  })

  it('handles cancelled events', async () => {
    const encoder = new TextEncoder()
    const events = 'event: cancelled\ndata: {}\n\n'

    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(events))
        controller.close()
      },
    })

    fetchMock.mockReturnValue(Promise.resolve({ body: stream }))

    const { streamChat } = await import('./api')
    const onCancelled = vi.fn()

    streamChat('hello', null, {
      onToken: vi.fn(),
      onDone: vi.fn(),
      onError: vi.fn(),
      onCancelled,
    })

    await vi.waitFor(() => {
      expect(onCancelled).toHaveBeenCalled()
    })
  })

  it('handles tool_use events', async () => {
    const encoder = new TextEncoder()
    const events = 'event: tool_use\ndata: {"tool":"read_file","arguments":{"path":"test.py"},"status":"running"}\n\n'

    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(events))
        controller.close()
      },
    })

    fetchMock.mockReturnValue(Promise.resolve({ body: stream }))

    const { streamChat } = await import('./api')
    const onToolUse = vi.fn()

    streamChat('hello', null, {
      onToken: vi.fn(),
      onDone: vi.fn(),
      onError: vi.fn(),
      onToolUse,
    })

    await vi.waitFor(() => {
      expect(onToolUse).toHaveBeenCalledWith(expect.objectContaining({ tool: 'read_file' }))
    })
  })

  it('handles mentions events', async () => {
    const encoder = new TextEncoder()
    const events = 'event: mentions\ndata: {"items":[]}\n\n'

    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(events))
        controller.close()
      },
    })

    fetchMock.mockReturnValue(Promise.resolve({ body: stream }))

    const { streamChat } = await import('./api')
    const onMentions = vi.fn()

    streamChat('hello', null, {
      onToken: vi.fn(),
      onDone: vi.fn(),
      onError: vi.fn(),
      onMentions,
    })

    await vi.waitFor(() => {
      expect(onMentions).toHaveBeenCalled()
    })
  })

  it('handles model_pull events', async () => {
    const encoder = new TextEncoder()
    const events = 'event: model_pull\ndata: {"status":"pulling","model":"qwen3"}\n\n'

    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(events))
        controller.close()
      },
    })

    fetchMock.mockReturnValue(Promise.resolve({ body: stream }))

    const { streamChat } = await import('./api')
    const onModelPull = vi.fn()

    streamChat('hello', null, {
      onToken: vi.fn(),
      onDone: vi.fn(),
      onError: vi.fn(),
      onModelPull,
    })

    await vi.waitFor(() => {
      expect(onModelPull).toHaveBeenCalledWith(expect.objectContaining({ status: 'pulling' }))
    })
  })

  it('handles fetch errors (non-abort)', async () => {
    fetchMock.mockReturnValue(Promise.reject(new Error('Network error')))

    const { streamChat } = await import('./api')
    const onError = vi.fn()

    streamChat('hello', null, {
      onToken: vi.fn(),
      onDone: vi.fn(),
      onError,
    })

    await vi.waitFor(() => {
      expect(onError).toHaveBeenCalledWith('Network error')
    })
  })

  it('ignores AbortError', async () => {
    const abortError = new DOMException('Aborted', 'AbortError')
    fetchMock.mockReturnValue(Promise.reject(abortError))

    const { streamChat } = await import('./api')
    const onError = vi.fn()

    const controller = streamChat('hello', null, {
      onToken: vi.fn(),
      onDone: vi.fn(),
      onError,
    })

    await new Promise(r => setTimeout(r, 50))
    expect(onError).not.toHaveBeenCalled()
    expect(controller).toBeDefined()
  })

  it('returns an AbortController', async () => {
    fetchMock.mockReturnValue(Promise.resolve({ body: null }))
    const { streamChat } = await import('./api')
    const controller = streamChat('hello', null, {
      onToken: vi.fn(),
      onDone: vi.fn(),
      onError: vi.fn(),
    })
    expect(controller).toBeInstanceOf(AbortController)
  })

  it('sends options in request body', async () => {
    fetchMock.mockReturnValue(Promise.resolve({ body: null }))
    const { streamChat } = await import('./api')
    streamChat('hello', 'c1', {
      onToken: vi.fn(),
      onDone: vi.fn(),
      onError: vi.fn(),
    }, { mode: 'cloud', model: 'opus', projectId: 'p1' })

    expect(fetchMock).toHaveBeenCalledWith('/api/chat', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({
        message: 'hello',
        conversation_id: 'c1',
        project_id: 'p1',
        mode: 'cloud',
        model: 'opus',
        retry_message_id: null,
        retry_with: null,
      }),
    }))
  })
})
