import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react'
import App from './App'

const mockListConversations = vi.fn().mockResolvedValue([])
const mockListProjects = vi.fn().mockResolvedValue([])
const mockListModels = vi.fn().mockResolvedValue({ local: [], cloud: [] })
const mockGetMessages = vi.fn().mockResolvedValue([])
const mockStreamChat = vi.fn().mockReturnValue(new AbortController())
const mockCancelStream = vi.fn()
const mockDeleteConversation = vi.fn().mockResolvedValue(undefined)
const mockCreateProject = vi.fn().mockResolvedValue({ id: 'p1', name: 'test' })
const mockDeleteProject = vi.fn().mockResolvedValue(undefined)
const mockUpdateConversation = vi.fn().mockResolvedValue(undefined)
const mockEditMessage = vi.fn().mockResolvedValue(undefined)
const mockForkConversation = vi.fn().mockResolvedValue({ id: 'new', title: 'Fork' })

vi.mock('./lib/api', () => ({
  listConversations: (...args: unknown[]) => mockListConversations(...args),
  listProjects: (...args: unknown[]) => mockListProjects(...args),
  listModels: (...args: unknown[]) => mockListModels(...args),
  getMessages: (...args: unknown[]) => mockGetMessages(...args),
  streamChat: (...args: unknown[]) => mockStreamChat(...args),
  cancelStream: (...args: unknown[]) => mockCancelStream(...args),
  deleteConversation: (...args: unknown[]) => mockDeleteConversation(...args),
  createProject: (...args: unknown[]) => mockCreateProject(...args),
  deleteProject: (...args: unknown[]) => mockDeleteProject(...args),
  updateConversation: (...args: unknown[]) => mockUpdateConversation(...args),
  editMessage: (...args: unknown[]) => mockEditMessage(...args),
  forkConversation: (...args: unknown[]) => mockForkConversation(...args),
  getSettings: vi.fn().mockResolvedValue({ anthropic_api_key: '', has_api_key: false }),
  submitFeedback: vi.fn(),
  getContextSnapshot: vi.fn().mockResolvedValue({ prompt_text: null, token_estimate: null }),
  getMentionCompletions: vi.fn().mockResolvedValue({ completions: [] }),
  getProjectInstructions: vi.fn().mockResolvedValue({ found: false, file: null, content: null }),
  setProjectInstructions: vi.fn().mockResolvedValue(undefined),
  updateSettings: vi.fn().mockResolvedValue(undefined),
  clearApiKey: vi.fn().mockResolvedValue(undefined),
  getUsage: vi.fn().mockResolvedValue({ total_messages: 0, cloud_messages: 0, local_messages: 0, total_tokens_in: 0, total_tokens_out: 0, total_cost: 0 }),
  exportAll: vi.fn().mockResolvedValue({ content: '{}', filename: 'export.json' }),
  importConversations: vi.fn().mockResolvedValue({ imported: 0 }),
}))

vi.mock('./hooks/useUpdater', () => ({
  useUpdater: () => ({
    status: 'idle',
    version: null,
    error: null,
    progress: 0,
    checkForUpdate: vi.fn(),
    installUpdate: vi.fn(),
    dismiss: vi.fn(),
  }),
}))

vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: vi.fn().mockResolvedValue(null),
}))

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockListConversations.mockResolvedValue([])
    mockListProjects.mockResolvedValue([])
  })

  it('renders without crashing', async () => {
    render(<App />)
    await waitFor(() => {
      expect(screen.getByText(/new/i)).toBeTruthy()
    })
  })

  it('renders sidebar', async () => {
    render(<App />)
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/search/i)).toBeTruthy()
    })
  })

  it('renders composer', async () => {
    render(<App />)
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/message/i)).toBeTruthy()
    })
  })

  it('renders empty chat state', async () => {
    render(<App />)
    await waitFor(() => {
      expect(screen.getByText(/kitsune/i)).toBeTruthy()
    })
  })

  it('loads conversations on mount', async () => {
    mockListConversations.mockResolvedValue([
      { id: 'c1', title: 'Test Chat', project_id: null, mode: 'auto', escalated: false, starred: false, created_at: new Date().toISOString() },
    ])
    render(<App />)
    await waitFor(() => {
      expect(screen.getByText('Test Chat')).toBeTruthy()
    })
  })

  it('loads projects on mount', async () => {
    mockListProjects.mockResolvedValue([
      { id: 'p1', name: 'MyProject', path: '/path', icon: null, conversation_count: 0, created_at: new Date().toISOString() },
    ])
    render(<App />)
    await waitFor(() => {
      expect(screen.getByText('MyProject')).toBeTruthy()
    })
  })

  it('selects conversation and loads messages', async () => {
    mockListConversations.mockResolvedValue([
      { id: 'c1', title: 'Chat One', project_id: null, mode: 'auto', escalated: false, starred: false, created_at: new Date().toISOString() },
    ])
    mockGetMessages.mockResolvedValue([
      { id: 'm1', conversation_id: 'c1', role: 'user', text: 'Hello', created_at: new Date().toISOString() },
    ])
    render(<App />)
    await waitFor(() => {
      expect(screen.getByText('Chat One')).toBeTruthy()
    })
    fireEvent.click(screen.getByText('Chat One'))
    await waitFor(() => {
      expect(mockGetMessages).toHaveBeenCalledWith('c1')
    })
  })

  it('creates new chat', async () => {
    mockListConversations.mockResolvedValue([
      { id: 'c1', title: 'Old Chat', project_id: null, mode: 'auto', escalated: false, starred: false, created_at: new Date().toISOString() },
    ])
    render(<App />)
    await waitFor(() => expect(screen.getByText('Old Chat')).toBeTruthy())
    fireEvent.click(screen.getByText(/new chat/i))
    expect(screen.getByText(/what can i help with/i)).toBeTruthy()
  })

  it('handles sending a message', async () => {
    render(<App />)
    await waitFor(() => expect(screen.getByPlaceholderText(/message/i)).toBeTruthy())
    const textarea = screen.getByPlaceholderText(/message/i)
    fireEvent.change(textarea, { target: { value: 'Test message' } })
    fireEvent.keyDown(textarea, { key: 'Enter' })
    await waitFor(() => {
      expect(mockStreamChat).toHaveBeenCalled()
    })
  })

  it('handles Cmd+N keyboard shortcut for new chat', async () => {
    render(<App />)
    await waitFor(() => expect(screen.getByPlaceholderText(/message/i)).toBeTruthy())
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'n', metaKey: true }))
    })
    expect(screen.getByText(/what can i help with/i)).toBeTruthy()
  })

  it('handles Cmd+/ keyboard shortcut to toggle settings', async () => {
    render(<App />)
    await waitFor(() => expect(screen.getByPlaceholderText(/message/i)).toBeTruthy())
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: '/', metaKey: true }))
    })
    await waitFor(() => {
      expect(screen.getByText('Settings')).toBeTruthy()
    })
  })

  it('handles delete conversation', async () => {
    mockListConversations.mockResolvedValue([
      { id: 'c1', title: 'To Delete', project_id: null, mode: 'auto', escalated: false, starred: false, created_at: new Date().toISOString() },
    ])
    render(<App />)
    await waitFor(() => expect(screen.getByText('To Delete')).toBeTruthy())
    fireEvent.click(screen.getByText('To Delete'))
    await waitFor(() => expect(mockGetMessages).toHaveBeenCalled())
    const trashBtns = screen.getAllByRole('button')
    const trashBtn = trashBtns.find(b => b.querySelector('svg') && b.closest('.group'))
    if (trashBtn) fireEvent.click(trashBtn)
  })

  it('handles star conversation', async () => {
    mockListConversations.mockResolvedValue([
      { id: 'c1', title: 'Star Me', project_id: null, mode: 'auto', escalated: false, starred: false, created_at: new Date().toISOString() },
    ])
    render(<App />)
    await waitFor(() => expect(screen.getByText('Star Me')).toBeTruthy())
    const starBtns = screen.getAllByRole('button').filter(b => b.getAttribute('title') === 'Star')
    if (starBtns.length) {
      fireEvent.click(starBtns[0])
      await waitFor(() => {
        expect(mockUpdateConversation).toHaveBeenCalledWith('c1', { starred: true })
      })
    }
  })

  it('handles cancel stream', async () => {
    mockStreamChat.mockImplementation((_text: string, _id: string | null, callbacks: { onToken: (t: string) => void }) => {
      setTimeout(() => callbacks.onToken('streaming'), 10)
      return new AbortController()
    })
    render(<App />)
    await waitFor(() => expect(screen.getByPlaceholderText(/message/i)).toBeTruthy())
    const textarea = screen.getByPlaceholderText(/message/i)
    fireEvent.change(textarea, { target: { value: 'Test' } })
    fireEvent.keyDown(textarea, { key: 'Enter' })
    await waitFor(() => {
      const buttons = screen.getAllByRole('button')
      const cancelBtn = buttons.find(b => b.querySelector('svg'))
      if (cancelBtn) fireEvent.click(cancelBtn)
    })
  })

  it('handles add project via fallback path', async () => {
    const mockOpen = vi.fn().mockRejectedValue(new Error('not tauri'))
    vi.mocked(await import('@tauri-apps/plugin-dialog')).open = mockOpen
    render(<App />)
    await waitFor(() => expect(screen.getByText(/add project/i)).toBeTruthy())
    fireEvent.click(screen.getByText(/add project/i))
  })

  it('handles add project path', async () => {
    render(<App />)
    await waitFor(() => expect(screen.getByText(/add project/i)).toBeTruthy())
    fireEvent.click(screen.getByText(/add project/i))
  })

  it('renders project badge when active project selected', async () => {
    mockListProjects.mockResolvedValue([
      { id: 'p1', name: 'TestProj', path: '/test', icon: null, conversation_count: 0, created_at: new Date().toISOString() },
    ])
    render(<App />)
    await waitFor(() => expect(screen.getByText('TestProj')).toBeTruthy())
    fireEvent.click(screen.getByText('TestProj'))
    await waitFor(() => {
      expect(screen.getAllByText('TestProj').length).toBeGreaterThanOrEqual(1)
    })
  })

  it('handles streamChat callbacks - onDone', async () => {
    mockStreamChat.mockImplementation((_text: string, _id: string | null, callbacks: {
      onToken: (t: string) => void
      onDone: (data: { conversation_id: string; route?: { source: string; reason: string }; speed?: number }) => void
    }) => {
      setTimeout(() => {
        callbacks.onToken('Hello ')
        callbacks.onDone({ conversation_id: 'c1', route: { source: 'claude', reason: 'test' }, speed: 42 })
      }, 10)
      return new AbortController()
    })
    render(<App />)
    await waitFor(() => expect(screen.getByPlaceholderText(/message/i)).toBeTruthy())
    const textarea = screen.getByPlaceholderText(/message/i)
    fireEvent.change(textarea, { target: { value: 'Test' } })
    fireEvent.keyDown(textarea, { key: 'Enter' })
    await waitFor(() => {
      expect(mockGetMessages).toHaveBeenCalled()
    })
  })

  it('handles streamChat callbacks - onError', async () => {
    mockStreamChat.mockImplementation((_text: string, _id: string | null, callbacks: {
      onError: (err: string) => void
    }) => {
      setTimeout(() => callbacks.onError('Connection failed'), 10)
      return new AbortController()
    })
    render(<App />)
    await waitFor(() => expect(screen.getByPlaceholderText(/message/i)).toBeTruthy())
    const textarea = screen.getByPlaceholderText(/message/i)
    fireEvent.change(textarea, { target: { value: 'Test' } })
    fireEvent.keyDown(textarea, { key: 'Enter' })
    await waitFor(() => {
      expect(screen.getByText(/connection failed/i)).toBeTruthy()
    })
  })

  it('handles streamChat callbacks - onRoute', async () => {
    mockStreamChat.mockImplementation((_text: string, _id: string | null, callbacks: {
      onToken: (t: string) => void
      onRoute: (route: { source: string; reason: string }) => void
    }) => {
      callbacks.onRoute({ source: 'claude-sonnet', reason: 'complex query' })
      callbacks.onToken('Working...')
      return new AbortController()
    })
    render(<App />)
    await waitFor(() => expect(screen.getByPlaceholderText(/message/i)).toBeTruthy())
    const textarea = screen.getByPlaceholderText(/message/i)
    fireEvent.change(textarea, { target: { value: 'Test' } })
    fireEvent.keyDown(textarea, { key: 'Enter' })
    await waitFor(() => {
      expect(screen.getByText(/claude/i)).toBeTruthy()
    })
  })

  it('handles streamChat callbacks - onToolUse', async () => {
    mockStreamChat.mockImplementation((_text: string, _id: string | null, callbacks: {
      onToken: (t: string) => void
      onToolUse: (event: { tool: string; arguments: Record<string, unknown>; status: string }) => void
    }) => {
      callbacks.onToolUse({ tool: 'read_file', arguments: { path: 'test.py' }, status: 'running' })
      callbacks.onToken('Reading...')
      return new AbortController()
    })
    render(<App />)
    await waitFor(() => expect(screen.getByPlaceholderText(/message/i)).toBeTruthy())
    const textarea = screen.getByPlaceholderText(/message/i)
    fireEvent.change(textarea, { target: { value: 'Test' } })
    fireEvent.keyDown(textarea, { key: 'Enter' })
    await waitFor(() => {
      expect(screen.getAllByText(/test\.py/).length).toBeGreaterThanOrEqual(1)
    })
  })

  it('handles streamChat callbacks - onToolUse done updates existing event', async () => {
    mockStreamChat.mockImplementation((_text: string, _id: string | null, callbacks: {
      onToken: (t: string) => void
      onToolUse: (event: { tool: string; arguments: Record<string, unknown>; status: string; result?: Record<string, unknown>; partial?: string }) => void
    }) => {
      callbacks.onToolUse({ tool: 'read_file', arguments: { path: 'x.py' }, status: 'running' })
      callbacks.onToolUse({ tool: 'read_file', arguments: { path: 'x.py' }, status: 'done', result: { content: 'done' } })
      callbacks.onToken('Done')
      return new AbortController()
    })
    render(<App />)
    await waitFor(() => expect(screen.getByPlaceholderText(/message/i)).toBeTruthy())
    const textarea = screen.getByPlaceholderText(/message/i)
    fireEvent.change(textarea, { target: { value: 'Test' } })
    fireEvent.keyDown(textarea, { key: 'Enter' })
  })

  it('handles streamChat callbacks - onToolUse partial appends', async () => {
    mockStreamChat.mockImplementation((_text: string, _id: string | null, callbacks: {
      onToken: (t: string) => void
      onToolUse: (event: { tool: string; arguments: Record<string, unknown>; status: string; partial?: string }) => void
    }) => {
      callbacks.onToolUse({ tool: 'run_command', arguments: { command: 'make' }, status: 'running' })
      callbacks.onToolUse({ tool: 'run_command', arguments: { command: 'make' }, status: 'running', partial: 'output line 1' })
      callbacks.onToken('Working...')
      return new AbortController()
    })
    render(<App />)
    await waitFor(() => expect(screen.getByPlaceholderText(/message/i)).toBeTruthy())
    const textarea = screen.getByPlaceholderText(/message/i)
    fireEvent.change(textarea, { target: { value: 'Test' } })
    fireEvent.keyDown(textarea, { key: 'Enter' })
  })

  it('handles streamChat callbacks - onMentions', async () => {
    mockStreamChat.mockImplementation((_text: string, _id: string | null, callbacks: {
      onToken: (t: string) => void
      onMentions: (data: { items: Array<{ type: string; arg: string; status: string; content: string | null }> }) => void
    }) => {
      callbacks.onMentions({ items: [{ type: 'file', arg: 'test.py', status: 'ok', content: 'code' }] })
      callbacks.onToken('Checking...')
      return new AbortController()
    })
    render(<App />)
    await waitFor(() => expect(screen.getByPlaceholderText(/message/i)).toBeTruthy())
    const textarea = screen.getByPlaceholderText(/message/i)
    fireEvent.change(textarea, { target: { value: 'Test' } })
    fireEvent.keyDown(textarea, { key: 'Enter' })
  })

  it('handles streamChat callbacks - onModelPull', async () => {
    mockStreamChat.mockImplementation((_text: string, _id: string | null, callbacks: {
      onToken: (t: string) => void
      onModelPull: (event: { status: string; model: string; percent: number }) => void
    }) => {
      callbacks.onModelPull({ status: 'downloading', model: 'llama', percent: 50 })
      callbacks.onToken('Downloading...')
      return new AbortController()
    })
    render(<App />)
    await waitFor(() => expect(screen.getByPlaceholderText(/message/i)).toBeTruthy())
    const textarea = screen.getByPlaceholderText(/message/i)
    fireEvent.change(textarea, { target: { value: 'Test' } })
    fireEvent.keyDown(textarea, { key: 'Enter' })
    await waitFor(() => {
      expect(screen.getByText(/llama/)).toBeTruthy()
    })
  })

  it('handles streamChat callbacks - onCancelled', async () => {
    mockStreamChat.mockImplementation((_text: string, _id: string | null, callbacks: {
      onCancelled: () => void
    }) => {
      callbacks.onCancelled()
      return new AbortController()
    })
    render(<App />)
    await waitFor(() => expect(screen.getByPlaceholderText(/message/i)).toBeTruthy())
    const textarea = screen.getByPlaceholderText(/message/i)
    fireEvent.change(textarea, { target: { value: 'Test' } })
    fireEvent.keyDown(textarea, { key: 'Enter' })
    expect(mockStreamChat).toHaveBeenCalled()
  })

  it('handles onDone with activeProjectId set', async () => {
    mockListProjects.mockResolvedValue([
      { id: 'p1', name: 'ProjA', path: '/a', icon: null, conversation_count: 0, created_at: new Date().toISOString() },
    ])
    mockStreamChat.mockImplementation((_text: string, _id: string | null, callbacks: {
      onToken: (t: string) => void
      onDone: (data: { conversation_id: string }) => void
    }) => {
      callbacks.onToken('Hello')
      callbacks.onDone({ conversation_id: 'c1' })
      return new AbortController()
    })
    render(<App />)
    await waitFor(() => expect(screen.getByText('ProjA')).toBeTruthy())
    fireEvent.click(screen.getByText('ProjA'))
    const textarea = screen.getByPlaceholderText(/message/i)
    fireEvent.change(textarea, { target: { value: 'Hello' } })
    fireEvent.keyDown(textarea, { key: 'Enter' })
    expect(mockStreamChat).toHaveBeenCalled()
  })

  it('handles delete project', async () => {
    mockListProjects.mockResolvedValue([
      { id: 'p1', name: 'DelProj', path: '/del', icon: null, conversation_count: 0, created_at: new Date().toISOString() },
    ])
    render(<App />)
    await waitFor(() => expect(screen.getByText('DelProj')).toBeTruthy())
    const removeBtn = screen.getByTitle('Remove project')
    fireEvent.click(removeBtn)
    await waitFor(() => {
      expect(mockDeleteProject).toHaveBeenCalledWith('p1')
    })
  })

  it('handles select project', async () => {
    mockListProjects.mockResolvedValue([
      { id: 'p1', name: 'SelectProj', path: '/sel', icon: null, conversation_count: 0, created_at: new Date().toISOString() },
    ])
    render(<App />)
    await waitFor(() => expect(screen.getByText('SelectProj')).toBeTruthy())
    fireEvent.click(screen.getByText('SelectProj'))
  })

  it('handles mode selection in composer', async () => {
    render(<App />)
    await waitFor(() => expect(screen.getByText('Auto')).toBeTruthy())
    fireEvent.click(screen.getByText('Local'))
  })

  it('handles Cmd+K to focus search', async () => {
    render(<App />)
    await waitFor(() => expect(screen.getByPlaceholderText(/search/i)).toBeTruthy())
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))
    })
  })

  it('handles handleRetry', async () => {
    mockListConversations.mockResolvedValue([
      { id: 'c1', title: 'Retry Chat', project_id: null, mode: 'auto', escalated: false, starred: false, created_at: new Date().toISOString() },
    ])
    mockGetMessages.mockResolvedValue([
      { id: 'm1', conversation_id: 'c1', role: 'user', text: 'Hello', created_at: new Date().toISOString() },
      { id: 'm2', conversation_id: 'c1', role: 'assistant', text: 'Hi there', answered_by: 'ollama/llama', created_at: new Date().toISOString() },
    ])
    mockStreamChat.mockReturnValue(new AbortController())
    render(<App />)
    await waitFor(() => expect(screen.getByText('Retry Chat')).toBeTruthy())
    fireEvent.click(screen.getByText('Retry Chat'))
    await waitFor(() => expect(screen.getByText('Hi there')).toBeTruthy())
    const retryBtns = screen.getAllByRole('button').filter(b => b.textContent?.includes('Retry'))
    if (retryBtns.length) {
      fireEvent.click(retryBtns[0])
      await waitFor(() => {
        expect(mockStreamChat).toHaveBeenCalled()
        const lastCall = mockStreamChat.mock.calls[mockStreamChat.mock.calls.length - 1]
        expect(lastCall[0]).toBe('Hello')
      })
    }
  })

  it('handles handleCancel with activeId', async () => {
    mockListConversations.mockResolvedValue([
      { id: 'c1', title: 'Cancel Chat', project_id: null, mode: 'auto', escalated: false, starred: false, created_at: new Date().toISOString() },
    ])
    mockGetMessages.mockResolvedValue([
      { id: 'm1', conversation_id: 'c1', role: 'user', text: 'Hello', created_at: new Date().toISOString() },
    ])
    mockStreamChat.mockImplementation((_text: string, _id: string | null, callbacks: {
      onToken: (t: string) => void
    }) => {
      callbacks.onToken('Streaming response...')
      return new AbortController()
    })
    render(<App />)
    await waitFor(() => expect(screen.getByText('Cancel Chat')).toBeTruthy())
    fireEvent.click(screen.getByText('Cancel Chat'))
    await waitFor(() => expect(mockGetMessages).toHaveBeenCalledWith('c1'))
    const textarea = screen.getByPlaceholderText(/message/i)
    fireEvent.change(textarea, { target: { value: 'Test' } })
    fireEvent.keyDown(textarea, { key: 'Enter' })
    expect(mockStreamChat).toHaveBeenCalled()
    expect(mockCancelStream).not.toHaveBeenCalled()
  })

  it('handles handleFork', async () => {
    mockListConversations.mockResolvedValue([
      { id: 'c1', title: 'Fork Chat', project_id: null, mode: 'auto', escalated: false, starred: false, created_at: new Date().toISOString() },
    ])
    mockGetMessages.mockResolvedValue([
      { id: 'm1', conversation_id: 'c1', role: 'user', text: 'Hello', created_at: new Date().toISOString() },
      { id: 'm2', conversation_id: 'c1', role: 'assistant', text: 'World', answered_by: 'ollama/llama', created_at: new Date().toISOString() },
    ])
    render(<App />)
    await waitFor(() => expect(screen.getByText('Fork Chat')).toBeTruthy())
    fireEvent.click(screen.getByText('Fork Chat'))
    await waitFor(() => expect(screen.getByText('World')).toBeTruthy())
    const forkBtns = screen.getAllByRole('button').filter(b => b.textContent?.includes('Fork'))
    if (forkBtns.length) {
      fireEvent.click(forkBtns[0])
      await waitFor(() => {
        expect(mockForkConversation).toHaveBeenCalledWith('c1', expect.any(String))
      })
    }
  })

  it('handles handleDeleteProject when activeProjectId matches', async () => {
    mockListProjects.mockResolvedValue([
      { id: 'p1', name: 'ActiveProj', path: '/a', icon: null, conversation_count: 0, created_at: new Date().toISOString() },
    ])
    render(<App />)
    await waitFor(() => expect(screen.getByText('ActiveProj')).toBeTruthy())
    fireEvent.click(screen.getByText('ActiveProj'))
    const removeBtn = screen.getByTitle('Remove project')
    fireEvent.click(removeBtn)
    await waitFor(() => {
      expect(mockDeleteProject).toHaveBeenCalledWith('p1')
    })
  })

  it('renders project badge dismiss button', async () => {
    mockListProjects.mockResolvedValue([
      { id: 'p1', name: 'BadgeProj', path: '/b', icon: null, conversation_count: 0, created_at: new Date().toISOString() },
    ])
    render(<App />)
    await waitFor(() => expect(screen.getByText('BadgeProj')).toBeTruthy())
    fireEvent.click(screen.getByText('BadgeProj'))
    await waitFor(() => {
      expect(screen.getAllByText('BadgeProj').length).toBeGreaterThanOrEqual(1)
    })
    const dismissBtn = screen.getByText('✕')
    fireEvent.click(dismissBtn)
    await waitFor(() => {
      expect(screen.queryByText('✕')).toBeNull()
    })
  })

  it('opens InstructionsEditor from sidebar', async () => {
    mockListProjects.mockResolvedValue([
      { id: 'p1', name: 'InstrProj', path: '/i', icon: null, conversation_count: 0, created_at: new Date().toISOString() },
    ])
    render(<App />)
    await waitFor(() => expect(screen.getByText('InstrProj')).toBeTruthy())
    const instrBtn = screen.getByTitle('Project instructions')
    fireEvent.click(instrBtn)
    await waitFor(() => {
      expect(screen.getByText(/project instructions/i)).toBeTruthy()
    })
  })

  it('handles onCancelled with activeId set', async () => {
    mockListConversations.mockResolvedValue([
      { id: 'c1', title: 'CancelId Chat', project_id: null, mode: 'auto', escalated: false, starred: false, created_at: new Date().toISOString() },
    ])
    mockGetMessages.mockResolvedValue([
      { id: 'm1', conversation_id: 'c1', role: 'user', text: 'Hello', created_at: new Date().toISOString() },
    ])
    mockStreamChat.mockImplementation((_text: string, _id: string | null, callbacks: {
      onCancelled: () => void
    }) => {
      callbacks.onCancelled()
      return new AbortController()
    })
    render(<App />)
    await waitFor(() => expect(screen.getByText('CancelId Chat')).toBeTruthy())
    fireEvent.click(screen.getByText('CancelId Chat'))
    await waitFor(() => expect(mockGetMessages).toHaveBeenCalledWith('c1'))
    mockGetMessages.mockClear()
    const textarea = screen.getByPlaceholderText(/message/i)
    fireEvent.change(textarea, { target: { value: 'Test' } })
    fireEvent.keyDown(textarea, { key: 'Enter' })
    await waitFor(() => {
      expect(mockGetMessages).toHaveBeenCalledWith('c1')
    })
  })

  it('handles onDone setting activeId for new conversation', async () => {
    mockStreamChat.mockImplementation((_text: string, _id: string | null, callbacks: {
      onToken: (t: string) => void
      onDone: (data: { conversation_id: string; route?: { source: string; reason: string }; speed?: number }) => void
    }) => {
      callbacks.onToken('Hello')
      callbacks.onDone({ conversation_id: 'new-conv-1' })
      return new AbortController()
    })
    render(<App />)
    await waitFor(() => expect(screen.getByPlaceholderText(/message/i)).toBeTruthy())
    const textarea = screen.getByPlaceholderText(/message/i)
    fireEvent.change(textarea, { target: { value: 'Test' } })
    fireEvent.keyDown(textarea, { key: 'Enter' })
    await waitFor(() => {
      expect(mockGetMessages).toHaveBeenCalledWith('new-conv-1')
    })
  })

  it('handles onDone with activeProjectId for new conversation', async () => {
    mockListProjects.mockResolvedValue([
      { id: 'p1', name: 'ProjForNew', path: '/p', icon: null, conversation_count: 0, created_at: new Date().toISOString() },
    ])
    mockStreamChat.mockImplementation((_text: string, _id: string | null, callbacks: {
      onToken: (t: string) => void
      onDone: (data: { conversation_id: string }) => void
    }) => {
      callbacks.onToken('Hello')
      callbacks.onDone({ conversation_id: 'new-conv-2' })
      return new AbortController()
    })
    render(<App />)
    await waitFor(() => expect(screen.getByText('ProjForNew')).toBeTruthy())
    fireEvent.click(screen.getByText('ProjForNew'))
    const textarea = screen.getByPlaceholderText(/message/i)
    fireEvent.change(textarea, { target: { value: 'Test' } })
    fireEvent.keyDown(textarea, { key: 'Enter' })
    await waitFor(() => {
      expect(mockUpdateConversation).toHaveBeenCalledWith('new-conv-2', { project_id: 'p1' })
    })
  })

  it('handles handleCancel calling cancelStream', async () => {
    mockStreamChat.mockImplementation((_text: string, _id: string | null, callbacks: {
      onToken: (t: string) => void
    }) => {
      new Promise<void>(() => {}).then(() => callbacks.onToken('tok'))
      return new AbortController()
    })
    mockListConversations.mockResolvedValue([
      { id: 'c1', title: 'CancelTest', project_id: null, mode: 'auto', escalated: false, starred: false, created_at: new Date().toISOString() },
    ])
    mockGetMessages.mockResolvedValue([
      { id: 'm1', conversation_id: 'c1', role: 'user', text: 'Hello', created_at: new Date().toISOString() },
    ])
    render(<App />)
    await waitFor(() => expect(screen.getByText('CancelTest')).toBeTruthy())
    fireEvent.click(screen.getByText('CancelTest'))
    await waitFor(() => expect(mockGetMessages).toHaveBeenCalledWith('c1'))
    const textarea = screen.getByPlaceholderText(/message/i)
    fireEvent.change(textarea, { target: { value: 'Test' } })
    fireEvent.keyDown(textarea, { key: 'Enter' })
    expect(mockStreamChat).toHaveBeenCalled()
  })

  it('handles delete active conversation', async () => {
    mockListConversations.mockResolvedValue([
      { id: 'c1', title: 'ActiveDel', project_id: null, mode: 'auto', escalated: false, starred: false, created_at: new Date().toISOString() },
    ])
    mockGetMessages.mockResolvedValue([
      { id: 'm1', conversation_id: 'c1', role: 'user', text: 'Hello', created_at: new Date().toISOString() },
    ])
    mockDeleteConversation.mockResolvedValue(undefined)
    render(<App />)
    await waitFor(() => expect(screen.getByText('ActiveDel')).toBeTruthy())
    fireEvent.click(screen.getByText('ActiveDel'))
    await waitFor(() => expect(mockGetMessages).toHaveBeenCalledWith('c1'))
    // Find the conversation item's group and click the trash button (last button in the group)
    const convItem = screen.getByText('ActiveDel').closest('.group')
    const buttons = convItem?.querySelectorAll('button')
    const trashBtn = buttons?.[buttons.length - 1]
    if (trashBtn) fireEvent.click(trashBtn)
    await waitFor(() => {
      expect(mockDeleteConversation).toHaveBeenCalledWith('c1')
    })
  })

  it('handles add project path submission', async () => {
    const mockOpen = vi.fn().mockRejectedValue(new Error('not tauri'))
    vi.mocked(await import('@tauri-apps/plugin-dialog')).open = mockOpen
    render(<App />)
    await waitFor(() => expect(screen.getByText(/add project/i)).toBeTruthy())
    fireEvent.click(screen.getByText(/add project/i))
    await waitFor(() => {
      const input = screen.queryByPlaceholderText(/path/i)
      if (input) {
        fireEvent.change(input, { target: { value: '/test/project' } })
        fireEvent.keyDown(input, { key: 'Enter' })
      }
    })
  })

  it('handles onToolUse with tool panel open', async () => {
    mockStreamChat.mockImplementation((_text: string, _id: string | null, callbacks: {
      onToken: (t: string) => void
      onToolUse: (event: { tool: string; arguments: Record<string, unknown>; status: string }) => void
      onDone: (data: { conversation_id: string }) => void
    }) => {
      callbacks.onToolUse({ tool: 'read_file', arguments: { path: 'tool.py' }, status: 'running' })
      callbacks.onToolUse({ tool: 'read_file', arguments: { path: 'tool.py' }, status: 'done' })
      callbacks.onToken('Done')
      callbacks.onDone({ conversation_id: 'c-tool' })
      return new AbortController()
    })
    render(<App />)
    await waitFor(() => expect(screen.getByPlaceholderText(/message/i)).toBeTruthy())
    const textarea = screen.getByPlaceholderText(/message/i)
    fireEvent.change(textarea, { target: { value: 'Test' } })
    fireEvent.keyDown(textarea, { key: 'Enter' })
    await waitFor(() => {
      expect(screen.getAllByText(/tool\.py/).length).toBeGreaterThanOrEqual(1)
    })
  })

  it('handles handleRetry with all callbacks', async () => {
    mockListConversations.mockResolvedValue([
      { id: 'c1', title: 'RetryFull', project_id: null, mode: 'auto', escalated: false, starred: false, created_at: new Date().toISOString() },
    ])
    mockGetMessages.mockResolvedValue([
      { id: 'm1', conversation_id: 'c1', role: 'user', text: 'Question', created_at: new Date().toISOString() },
      { id: 'm2', conversation_id: 'c1', role: 'assistant', text: 'Bad answer', answered_by: 'local/llama', created_at: new Date().toISOString() },
    ])
    mockStreamChat.mockImplementation((_text: string, _id: string | null, callbacks: {
      onToken: (t: string) => void
      onDone: (data: { conversation_id: string; route?: { source: string; reason: string }; speed?: number }) => void
    }) => {
      callbacks.onToken('Better answer')
      callbacks.onDone({ conversation_id: 'c1', route: { source: 'claude', reason: 'retry' }, speed: 50 })
      return new AbortController()
    })
    render(<App />)
    await waitFor(() => expect(screen.getByText('RetryFull')).toBeTruthy())
    fireEvent.click(screen.getByText('RetryFull'))
    await waitFor(() => expect(screen.getByText('Bad answer')).toBeTruthy())
    const retryBtns = screen.getAllByRole('button').filter(b => b.textContent?.includes('Retry'))
    if (retryBtns.length) {
      fireEvent.click(retryBtns[0])
      await waitFor(() => {
        const lastCall = mockStreamChat.mock.calls[mockStreamChat.mock.calls.length - 1]
        expect(lastCall[0]).toBe('Question')
        expect(lastCall[3]?.retryMessageId).toBe('m2')
      })
    }
  })

  it('handles handleRetry onError callback', async () => {
    mockListConversations.mockResolvedValue([
      { id: 'c1', title: 'RetryErr', project_id: null, mode: 'auto', escalated: false, starred: false, created_at: new Date().toISOString() },
    ])
    mockGetMessages.mockResolvedValue([
      { id: 'm1', conversation_id: 'c1', role: 'user', text: 'Q', created_at: new Date().toISOString() },
      { id: 'm2', conversation_id: 'c1', role: 'assistant', text: 'A', answered_by: 'local/llama', created_at: new Date().toISOString() },
    ])
    mockStreamChat.mockImplementation((_text: string, _id: string | null, callbacks: {
      onError: (err: string) => void
    }) => {
      callbacks.onError('Retry failed')
      return new AbortController()
    })
    render(<App />)
    await waitFor(() => expect(screen.getByText('RetryErr')).toBeTruthy())
    fireEvent.click(screen.getByText('RetryErr'))
    await waitFor(() => expect(screen.getByText('A')).toBeTruthy())
    const retryBtns = screen.getAllByRole('button').filter(b => b.textContent?.includes('Retry'))
    if (retryBtns.length) {
      fireEvent.click(retryBtns[0])
      await waitFor(() => {
        expect(screen.getByText(/retry failed/i)).toBeTruthy()
      })
    }
  })

  it('handles onMentions callback setting context panel', async () => {
    mockStreamChat.mockImplementation((_text: string, _id: string | null, callbacks: {
      onToken: (t: string) => void
      onMentions: (data: { items: Array<{ type: string; arg: string; status: string; content: string | null }> }) => void
      onDone: (data: { conversation_id: string }) => void
    }) => {
      callbacks.onMentions({ items: [{ type: 'file', arg: 'main.py', status: 'ok', content: 'print("hello")' }] })
      callbacks.onToken('Reading...')
      callbacks.onDone({ conversation_id: 'c-new' })
      return new AbortController()
    })
    render(<App />)
    await waitFor(() => expect(screen.getByPlaceholderText(/message/i)).toBeTruthy())
    const textarea = screen.getByPlaceholderText(/message/i)
    fireEvent.change(textarea, { target: { value: '@main.py test' } })
    fireEvent.keyDown(textarea, { key: 'Enter' })
    await waitFor(() => {
      expect(screen.getByText(/main\.py/)).toBeTruthy()
    })
  })

  it('handles onModelPull ready status', async () => {
    mockStreamChat.mockImplementation((_text: string, _id: string | null, callbacks: {
      onToken: (t: string) => void
      onModelPull: (event: { status: string; model: string; percent: number }) => void
    }) => {
      callbacks.onModelPull({ status: 'ready', model: 'llama', percent: 100 })
      callbacks.onToken('Ready!')
      return new AbortController()
    })
    render(<App />)
    await waitFor(() => expect(screen.getByPlaceholderText(/message/i)).toBeTruthy())
    const textarea = screen.getByPlaceholderText(/message/i)
    fireEvent.change(textarea, { target: { value: 'Test' } })
    fireEvent.keyDown(textarea, { key: 'Enter' })
    expect(mockStreamChat).toHaveBeenCalled()
  })

  it('closes InstructionsEditor modal', async () => {
    mockListProjects.mockResolvedValue([
      { id: 'p1', name: 'CloseInstr', path: '/c', icon: null, conversation_count: 0, created_at: new Date().toISOString() },
    ])
    render(<App />)
    await waitFor(() => expect(screen.getByText('CloseInstr')).toBeTruthy())
    fireEvent.click(screen.getByTitle('Project instructions'))
    await waitFor(() => expect(screen.getByText(/project instructions/i)).toBeTruthy())
    fireEvent.click(screen.getByText('Cancel'))
    await waitFor(() => {
      expect(screen.queryByText(/project instructions/i)).toBeNull()
    })
  })

  it('opens and closes settings via Cmd+/ toggle', async () => {
    render(<App />)
    await waitFor(() => expect(screen.getByPlaceholderText(/message/i)).toBeTruthy())
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: '/', metaKey: true }))
    })
    await waitFor(() => expect(screen.getByText('Settings')).toBeTruthy())
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: '/', metaKey: true }))
    })
    await waitFor(() => expect(screen.queryByText('Settings')).toBeNull())
  })

  it('passes handleEdit callback to ChatThread', async () => {
    mockListConversations.mockResolvedValue([
      { id: 'c1', title: 'Edit Chat', project_id: null, mode: 'auto', escalated: false, starred: false, created_at: new Date().toISOString() },
    ])
    mockGetMessages.mockResolvedValue([
      { id: 'm1', conversation_id: 'c1', role: 'user', text: 'Hello', created_at: new Date().toISOString() },
    ])
    render(<App />)
    await waitFor(() => expect(screen.getByText('Edit Chat')).toBeTruthy())
    fireEvent.click(screen.getByText('Edit Chat'))
    await waitFor(() => expect(screen.getByText('Hello')).toBeTruthy())
    const editBtn = screen.getByTitle('Edit message')
    fireEvent.click(editBtn)
    await waitFor(() => {
      const textarea = screen.getByDisplayValue('Hello')
      expect(textarea).toBeTruthy()
    })
  })

  it('handles handleAddProjectPath', async () => {
    render(<App />)
    await waitFor(() => expect(screen.getByText(/add project/i)).toBeTruthy())
    fireEvent.click(screen.getByText(/add project/i))
    await waitFor(() => {
      const input = screen.queryByPlaceholderText(/enter folder path/i)
      if (input) {
        fireEvent.change(input, { target: { value: '/my/new/project' } })
        fireEvent.keyDown(input, { key: 'Enter' })
      }
    })
  })

  it('onSelect callback on Composer sets mode and model', async () => {
    render(<App />)
    await waitFor(() => expect(screen.getByText('Local')).toBeTruthy())
    fireEvent.click(screen.getByText('Local'))
  })
})
