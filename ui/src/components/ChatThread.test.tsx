import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ChatThread } from './ChatThread'
import type { Message, RouteInfo, ToolUseEvent, ModelPullEvent, ResolvedMention } from '../lib/api'

vi.mock('../lib/api', async () => {
  const actual = await vi.importActual('../lib/api')
  return {
    ...actual,
    submitFeedback: vi.fn(),
    getContextSnapshot: vi.fn().mockResolvedValue({ prompt_text: 'test prompt', token_estimate: 1234 }),
  }
})

const baseProps = {
  messages: [] as Message[],
  streamingText: '',
  isStreaming: false,
  error: null as string | null,
  routeInfo: null as RouteInfo | null,
  speed: null as number | null,
  toolEvents: [] as ToolUseEvent[],
  resolvedMentions: [] as ResolvedMention[],
  onRetry: vi.fn(),
  onEdit: vi.fn(),
  onFork: vi.fn(),
  onSend: vi.fn(),
  modelPull: null as ModelPullEvent | null,
}

describe('ChatThread', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    })
  })

  it('renders empty state when no messages', () => {
    render(<ChatThread {...baseProps} />)
    expect(screen.getByText(/what can i help with/i)).toBeTruthy()
  })

  it('renders suggestion buttons in empty state', () => {
    render(<ChatThread {...baseProps} />)
    expect(screen.getByText(/summarise/i)).toBeTruthy()
  })

  it('calls onSend when suggestion button clicked', () => {
    const onSend = vi.fn()
    render(<ChatThread {...baseProps} onSend={onSend} />)
    fireEvent.click(screen.getByText(/summarise/i))
    expect(onSend).toHaveBeenCalledWith('Summarise this article for me')
  })

  it('renders user messages', () => {
    const messages: Message[] = [
      { id: 'm1', conversation_id: 'c1', role: 'user', text: 'Hello there', created_at: new Date().toISOString() },
    ]
    render(<ChatThread {...baseProps} messages={messages} />)
    expect(screen.getByText('Hello there')).toBeTruthy()
  })

  it('renders assistant messages', () => {
    const messages: Message[] = [
      { id: 'm1', conversation_id: 'c1', role: 'user', text: 'Hi', created_at: new Date().toISOString() },
      { id: 'm2', conversation_id: 'c1', role: 'assistant', text: 'Hello!', created_at: new Date().toISOString() },
    ]
    render(<ChatThread {...baseProps} messages={messages} />)
    expect(screen.getByText('Hello!')).toBeTruthy()
  })

  it('renders streaming text', () => {
    const messages: Message[] = [
      { id: 'm1', conversation_id: 'c1', role: 'user', text: 'Hi', created_at: new Date().toISOString() },
    ]
    render(<ChatThread {...baseProps} messages={messages} streamingText="Thinking..." isStreaming={true} />)
    expect(screen.getByText('Thinking...')).toBeTruthy()
  })

  it('renders error message', () => {
    const messages: Message[] = [
      { id: 'm1', conversation_id: 'c1', role: 'user', text: 'Hi', created_at: new Date().toISOString() },
    ]
    render(<ChatThread {...baseProps} messages={messages} error="Something went wrong" />)
    expect(screen.getByText(/something went wrong/i)).toBeTruthy()
  })

  it('renders route info badge during streaming', () => {
    const messages: Message[] = [
      { id: 'm1', conversation_id: 'c1', role: 'user', text: 'Hi', created_at: new Date().toISOString() },
    ]
    const routeInfo: RouteInfo = { source: 'claude-sonnet', reason: 'complex query' }
    render(<ChatThread {...baseProps} messages={messages} routeInfo={routeInfo} isStreaming={true} streamingText="Working..." />)
    expect(screen.getByText(/claude/i)).toBeTruthy()
  })

  it('renders local route badge', () => {
    const messages: Message[] = [
      { id: 'm1', conversation_id: 'c1', role: 'user', text: 'Hi', created_at: new Date().toISOString() },
    ]
    const routeInfo: RouteInfo = { source: 'local-llama', reason: 'simple query' }
    render(<ChatThread {...baseProps} messages={messages} routeInfo={routeInfo} isStreaming={true} streamingText="Working..." />)
    expect(screen.getByText('Local')).toBeTruthy()
  })

  it('renders route badge with cost', () => {
    const messages: Message[] = [
      { id: 'm1', conversation_id: 'c1', role: 'user', text: 'Hi', created_at: new Date().toISOString() },
    ]
    const routeInfo: RouteInfo = { source: 'claude-sonnet', reason: 'complex', estimated_cost: 0.05 }
    render(<ChatThread {...baseProps} messages={messages} routeInfo={routeInfo} isStreaming={true} streamingText="Working..." />)
    expect(screen.getByText('~$0.05')).toBeTruthy()
  })

  it('renders route badge with small cost in cents', () => {
    const messages: Message[] = [
      { id: 'm1', conversation_id: 'c1', role: 'user', text: 'Hi', created_at: new Date().toISOString() },
    ]
    const routeInfo: RouteInfo = { source: 'claude-sonnet', reason: 'complex', estimated_cost: 0.005 }
    render(<ChatThread {...baseProps} messages={messages} routeInfo={routeInfo} isStreaming={true} streamingText="Working..." />)
    expect(screen.getByText('~$0.5¢')).toBeTruthy()
  })

  it('renders code blocks in assistant messages', () => {
    const messages: Message[] = [
      { id: 'm1', conversation_id: 'c1', role: 'user', text: 'Hi', created_at: new Date().toISOString() },
      { id: 'm2', conversation_id: 'c1', role: 'assistant', text: 'Here is code:\n```python\nprint("hello")\n```', created_at: new Date().toISOString() },
    ]
    render(<ChatThread {...baseProps} messages={messages} />)
    expect(screen.getByText(/print/)).toBeTruthy()
  })

  it('renders model pull event during streaming', () => {
    const messages: Message[] = [
      { id: 'm1', conversation_id: 'c1', role: 'user', text: 'Hi', created_at: new Date().toISOString() },
    ]
    const modelPull: ModelPullEvent = { status: 'downloading', model: 'qwen3', percent: 50 }
    render(<ChatThread {...baseProps} messages={messages} modelPull={modelPull} isStreaming={true} />)
    expect(screen.getByText(/qwen3/i)).toBeTruthy()
  })

  it('renders model pull without percent', () => {
    const messages: Message[] = [
      { id: 'm1', conversation_id: 'c1', role: 'user', text: 'Hi', created_at: new Date().toISOString() },
    ]
    const modelPull: ModelPullEvent = { status: 'downloading', model: 'llama', percent: undefined as unknown as number }
    render(<ChatThread {...baseProps} messages={messages} modelPull={modelPull} isStreaming={true} />)
    expect(screen.getByText(/llama/i)).toBeTruthy()
  })

  it('renders "Preparing model..." when model pulling with no streaming text', () => {
    const messages: Message[] = [
      { id: 'm1', conversation_id: 'c1', role: 'user', text: 'Hi', created_at: new Date().toISOString() },
    ]
    const modelPull: ModelPullEvent = { status: 'downloading', model: 'llama', percent: 30 }
    render(<ChatThread {...baseProps} messages={messages} modelPull={modelPull} isStreaming={true} streamingText="" />)
    expect(screen.getByText('Preparing model...')).toBeTruthy()
  })

  it('renders "Working..." when tools running with no streaming text', () => {
    const messages: Message[] = [
      { id: 'm1', conversation_id: 'c1', role: 'user', text: 'Hi', created_at: new Date().toISOString() },
    ]
    const toolEvents: ToolUseEvent[] = [
      { tool: 'read_file', arguments: { path: 'test.py' }, status: 'running' },
    ]
    render(<ChatThread {...baseProps} messages={messages} toolEvents={toolEvents} isStreaming={true} streamingText="" />)
    expect(screen.getByText('Working...')).toBeTruthy()
  })

  it('renders resolved mentions during streaming', () => {
    const messages: Message[] = [
      { id: 'm1', conversation_id: 'c1', role: 'user', text: 'Check @file test.py', created_at: new Date().toISOString() },
    ]
    const resolvedMentions: ResolvedMention[] = [
      { type: 'file', arg: 'test.py', status: 'ok', content: 'print("hi")' },
    ]
    render(<ChatThread {...baseProps} messages={messages} resolvedMentions={resolvedMentions} isStreaming={true} streamingText="Looking..." />)
    expect(screen.getAllByText(/test\.py/).length).toBeGreaterThanOrEqual(1)
  })

  it('renders mention badge with not-found status', () => {
    const messages: Message[] = [
      { id: 'm1', conversation_id: 'c1', role: 'user', text: 'Hi', created_at: new Date().toISOString() },
    ]
    const resolvedMentions: ResolvedMention[] = [
      { type: 'file', arg: 'missing.py', status: 'error', content: null },
    ]
    render(<ChatThread {...baseProps} messages={messages} resolvedMentions={resolvedMentions} isStreaming={true} streamingText="Looking..." />)
    expect(screen.getByText('not found')).toBeTruthy()
  })

  it('renders mention badge for folder type', () => {
    const messages: Message[] = [
      { id: 'm1', conversation_id: 'c1', role: 'user', text: 'Hi', created_at: new Date().toISOString() },
    ]
    const resolvedMentions: ResolvedMention[] = [
      { type: 'folder', arg: 'src/', status: 'ok', content: 'files...' },
    ]
    render(<ChatThread {...baseProps} messages={messages} resolvedMentions={resolvedMentions} isStreaming={true} streamingText="Looking..." />)
    expect(screen.getByText('@folder')).toBeTruthy()
  })

  it('renders mention badge for errors type', () => {
    const messages: Message[] = [
      { id: 'm1', conversation_id: 'c1', role: 'user', text: 'Hi', created_at: new Date().toISOString() },
    ]
    const resolvedMentions: ResolvedMention[] = [
      { type: 'errors', arg: '', status: 'ok', content: 'errors...' },
    ]
    render(<ChatThread {...baseProps} messages={messages} resolvedMentions={resolvedMentions} isStreaming={true} streamingText="Checking..." />)
    expect(screen.getByText('@errors')).toBeTruthy()
  })

  it('shows answered_by badge on assistant messages', () => {
    const messages: Message[] = [
      { id: 'm1', conversation_id: 'c1', role: 'user', text: 'Hi', created_at: new Date().toISOString() },
      { id: 'm2', conversation_id: 'c1', role: 'assistant', text: 'Hello!', answered_by: 'local:qwen3', created_at: new Date().toISOString() },
    ]
    render(<ChatThread {...baseProps} messages={messages} />)
    expect(screen.getByText(/qwen3/)).toBeTruthy()
  })

  it('shows answered_by badge with latency and tokens', () => {
    const messages: Message[] = [
      { id: 'm1', conversation_id: 'c1', role: 'user', text: 'Hi', created_at: new Date().toISOString() },
      { id: 'm2', conversation_id: 'c1', role: 'assistant', text: 'Hello!', answered_by: 'claude:sonnet', latency_ms: 2500, tokens_out: 150, created_at: new Date().toISOString() },
    ]
    render(<ChatThread {...baseProps} messages={messages} />)
    expect(screen.getByText(/2\.5s/)).toBeTruthy()
    expect(screen.getByText(/150 tok/)).toBeTruthy()
  })

  it('shows "Retry with Claude" for local messages', () => {
    const messages: Message[] = [
      { id: 'm1', conversation_id: 'c1', role: 'user', text: 'Hi', created_at: new Date().toISOString() },
      { id: 'm2', conversation_id: 'c1', role: 'assistant', text: 'Hello!', answered_by: 'local:qwen3', created_at: new Date().toISOString() },
    ]
    render(<ChatThread {...baseProps} messages={messages} />)
    expect(screen.getByText('Retry with Claude')).toBeTruthy()
  })

  it('shows "Retry locally" for cloud messages', () => {
    const messages: Message[] = [
      { id: 'm1', conversation_id: 'c1', role: 'user', text: 'Hi', created_at: new Date().toISOString() },
      { id: 'm2', conversation_id: 'c1', role: 'assistant', text: 'Hello!', answered_by: 'claude:sonnet', created_at: new Date().toISOString() },
    ]
    render(<ChatThread {...baseProps} messages={messages} />)
    expect(screen.getByText('Retry locally')).toBeTruthy()
  })

  it('calls onRetry when retry button clicked', () => {
    const onRetry = vi.fn()
    const messages: Message[] = [
      { id: 'm1', conversation_id: 'c1', role: 'user', text: 'Hi', created_at: new Date().toISOString() },
      { id: 'm2', conversation_id: 'c1', role: 'assistant', text: 'Hello!', answered_by: 'local:qwen3', created_at: new Date().toISOString() },
    ]
    render(<ChatThread {...baseProps} messages={messages} onRetry={onRetry} />)
    fireEvent.click(screen.getByText('Retry with Claude'))
    expect(onRetry).toHaveBeenCalledWith('m2', 'cloud')
  })

  it('shows "What was sent" inspector link for cloud messages', () => {
    const messages: Message[] = [
      { id: 'm1', conversation_id: 'c1', role: 'user', text: 'Hi', created_at: new Date().toISOString() },
      { id: 'm2', conversation_id: 'c1', role: 'assistant', text: 'Hello!', answered_by: 'claude:sonnet', created_at: new Date().toISOString() },
    ]
    render(<ChatThread {...baseProps} messages={messages} />)
    expect(screen.getByText('What was sent')).toBeTruthy()
  })

  it('toggles inspector link on click', async () => {
    const messages: Message[] = [
      { id: 'm1', conversation_id: 'c1', role: 'user', text: 'Hi', created_at: new Date().toISOString() },
      { id: 'm2', conversation_id: 'c1', role: 'assistant', text: 'Hello!', answered_by: 'claude:sonnet', created_at: new Date().toISOString() },
    ]
    render(<ChatThread {...baseProps} messages={messages} />)
    fireEvent.click(screen.getByText('What was sent'))
    await waitFor(() => {
      expect(screen.getByText(/1,234 tokens/)).toBeTruthy()
    })
    fireEvent.click(screen.getByText('What was sent'))
    await waitFor(() => {
      expect(screen.queryByText(/1,234 tokens/)).toBeNull()
    })
  })

  it('renders copy button on assistant messages', () => {
    const messages: Message[] = [
      { id: 'm1', conversation_id: 'c1', role: 'user', text: 'Hi', created_at: new Date().toISOString() },
      { id: 'm2', conversation_id: 'c1', role: 'assistant', text: 'Hello!', answered_by: 'local:qwen3', created_at: new Date().toISOString() },
    ]
    render(<ChatThread {...baseProps} messages={messages} />)
    const copyBtn = screen.getByTitle('Copy message')
    expect(copyBtn).toBeTruthy()
  })

  it('handles copy button click', async () => {
    const messages: Message[] = [
      { id: 'm1', conversation_id: 'c1', role: 'user', text: 'Hi', created_at: new Date().toISOString() },
      { id: 'm2', conversation_id: 'c1', role: 'assistant', text: 'Copy me!', answered_by: 'local:qwen3', created_at: new Date().toISOString() },
    ]
    render(<ChatThread {...baseProps} messages={messages} />)
    fireEvent.click(screen.getByTitle('Copy message'))
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('Copy me!')
  })

  it('shows feedback buttons on assistant messages', () => {
    const messages: Message[] = [
      { id: 'm1', conversation_id: 'c1', role: 'user', text: 'Hi', created_at: new Date().toISOString() },
      { id: 'm2', conversation_id: 'c1', role: 'assistant', text: 'Hello!', answered_by: 'local:qwen3', created_at: new Date().toISOString() },
    ]
    render(<ChatThread {...baseProps} messages={messages} />)
    expect(screen.getByTitle('Good response')).toBeTruthy()
    expect(screen.getByTitle('Bad response')).toBeTruthy()
  })

  it('handles feedback button click', async () => {
    const { submitFeedback } = await import('../lib/api')
    const messages: Message[] = [
      { id: 'm1', conversation_id: 'c1', role: 'user', text: 'Hi', created_at: new Date().toISOString() },
      { id: 'm2', conversation_id: 'c1', role: 'assistant', text: 'Hello!', answered_by: 'local:qwen3', created_at: new Date().toISOString() },
    ]
    render(<ChatThread {...baseProps} messages={messages} />)
    fireEvent.click(screen.getByTitle('Good response'))
    expect(submitFeedback).toHaveBeenCalledWith('m2', 'up')
  })

  it('toggles feedback off on second click', async () => {
    const messages: Message[] = [
      { id: 'm1', conversation_id: 'c1', role: 'user', text: 'Hi', created_at: new Date().toISOString() },
      { id: 'm2', conversation_id: 'c1', role: 'assistant', text: 'Hello!', answered_by: 'local:qwen3', created_at: new Date().toISOString() },
    ]
    render(<ChatThread {...baseProps} messages={messages} />)
    fireEvent.click(screen.getByTitle('Good response'))
    fireEvent.click(screen.getByTitle('Good response'))
  })

  it('shows fork button on user messages', () => {
    const messages: Message[] = [
      { id: 'm1', conversation_id: 'c1', role: 'user', text: 'Hello', created_at: new Date().toISOString() },
    ]
    render(<ChatThread {...baseProps} messages={messages} />)
    const forkBtns = screen.getAllByTitle('Fork conversation from here')
    expect(forkBtns.length).toBeGreaterThan(0)
  })

  it('calls onFork when fork button clicked on user message', () => {
    const onFork = vi.fn()
    const messages: Message[] = [
      { id: 'm1', conversation_id: 'c1', role: 'user', text: 'Hello', created_at: new Date().toISOString() },
    ]
    render(<ChatThread {...baseProps} messages={messages} onFork={onFork} />)
    const forkBtns = screen.getAllByTitle('Fork conversation from here')
    fireEvent.click(forkBtns[0])
    expect(onFork).toHaveBeenCalledWith('m1')
  })

  it('shows edit button on user messages', () => {
    const messages: Message[] = [
      { id: 'm1', conversation_id: 'c1', role: 'user', text: 'Hello', created_at: new Date().toISOString() },
    ]
    render(<ChatThread {...baseProps} messages={messages} />)
    expect(screen.getByTitle('Edit message')).toBeTruthy()
  })

  it('enters edit mode on click', () => {
    const messages: Message[] = [
      { id: 'm1', conversation_id: 'c1', role: 'user', text: 'Hello', created_at: new Date().toISOString() },
    ]
    render(<ChatThread {...baseProps} messages={messages} />)
    fireEvent.click(screen.getByTitle('Edit message'))
    expect(screen.getByDisplayValue('Hello')).toBeTruthy()
    expect(screen.getByText('Cancel')).toBeTruthy()
    expect(screen.getByText('Send')).toBeTruthy()
  })

  it('cancels edit with Cancel button', () => {
    const messages: Message[] = [
      { id: 'm1', conversation_id: 'c1', role: 'user', text: 'Hello', created_at: new Date().toISOString() },
    ]
    render(<ChatThread {...baseProps} messages={messages} />)
    fireEvent.click(screen.getByTitle('Edit message'))
    fireEvent.click(screen.getByText('Cancel'))
    expect(screen.getByText('Hello')).toBeTruthy()
  })

  it('cancels edit with Escape', () => {
    const messages: Message[] = [
      { id: 'm1', conversation_id: 'c1', role: 'user', text: 'Hello', created_at: new Date().toISOString() },
    ]
    render(<ChatThread {...baseProps} messages={messages} />)
    fireEvent.click(screen.getByTitle('Edit message'))
    fireEvent.keyDown(screen.getByDisplayValue('Hello'), { key: 'Escape' })
    expect(screen.getByText('Hello')).toBeTruthy()
  })

  it('submits edit with Enter', () => {
    const onEdit = vi.fn()
    const messages: Message[] = [
      { id: 'm1', conversation_id: 'c1', role: 'user', text: 'Hello', created_at: new Date().toISOString() },
    ]
    render(<ChatThread {...baseProps} messages={messages} onEdit={onEdit} />)
    fireEvent.click(screen.getByTitle('Edit message'))
    const textarea = screen.getByDisplayValue('Hello')
    fireEvent.change(textarea, { target: { value: 'Updated' } })
    fireEvent.keyDown(textarea, { key: 'Enter' })
    expect(onEdit).toHaveBeenCalledWith('m1', 'Updated')
  })

  it('submits edit with Send button', () => {
    const onEdit = vi.fn()
    const messages: Message[] = [
      { id: 'm1', conversation_id: 'c1', role: 'user', text: 'Hello', created_at: new Date().toISOString() },
    ]
    render(<ChatThread {...baseProps} messages={messages} onEdit={onEdit} />)
    fireEvent.click(screen.getByTitle('Edit message'))
    const textarea = screen.getByDisplayValue('Hello')
    fireEvent.change(textarea, { target: { value: 'Updated' } })
    fireEvent.click(screen.getByText('Send'))
    expect(onEdit).toHaveBeenCalledWith('m1', 'Updated')
  })

  it('does not submit edit if text unchanged', () => {
    const onEdit = vi.fn()
    const messages: Message[] = [
      { id: 'm1', conversation_id: 'c1', role: 'user', text: 'Hello', created_at: new Date().toISOString() },
    ]
    render(<ChatThread {...baseProps} messages={messages} onEdit={onEdit} />)
    fireEvent.click(screen.getByTitle('Edit message'))
    fireEvent.click(screen.getByText('Send'))
    expect(onEdit).not.toHaveBeenCalled()
  })

  it('renders tool event badges during streaming', () => {
    const messages: Message[] = [
      { id: 'm1', conversation_id: 'c1', role: 'user', text: 'Hi', created_at: new Date().toISOString() },
    ]
    const toolEvents: ToolUseEvent[] = [
      { tool: 'read_file', arguments: { path: 'main.py' }, status: 'done', result: { content: 'code' } },
      { tool: 'run_command', arguments: { command: 'python test.py' }, status: 'running' },
    ]
    render(<ChatThread {...baseProps} messages={messages} toolEvents={toolEvents} isStreaming={true} streamingText="Working..." />)
    expect(screen.getByText(/main\.py/)).toBeTruthy()
    expect(screen.getByText(/python test\.py/)).toBeTruthy()
  })

  it('renders tool event badge with error', () => {
    const messages: Message[] = [
      { id: 'm1', conversation_id: 'c1', role: 'user', text: 'Hi', created_at: new Date().toISOString() },
    ]
    const toolEvents: ToolUseEvent[] = [
      { tool: 'run_command', arguments: { command: 'bad cmd' }, status: 'done', result: { error: 'command not found' } },
    ]
    render(<ChatThread {...baseProps} messages={messages} toolEvents={toolEvents} isStreaming={true} streamingText="Oops..." />)
    expect(screen.getByText('Failed')).toBeTruthy()
  })

  it('renders tool event badge for list_files', () => {
    const messages: Message[] = [
      { id: 'm1', conversation_id: 'c1', role: 'user', text: 'Hi', created_at: new Date().toISOString() },
    ]
    const toolEvents: ToolUseEvent[] = [
      { tool: 'list_files', arguments: { path: 'src/' }, status: 'done', result: { entries: ['a.py', 'b.py'] } },
    ]
    render(<ChatThread {...baseProps} messages={messages} toolEvents={toolEvents} isStreaming={true} streamingText="Done" />)
    expect(screen.getByText('src/')).toBeTruthy()
  })

  it('truncates long command in tool event badge', () => {
    const messages: Message[] = [
      { id: 'm1', conversation_id: 'c1', role: 'user', text: 'Hi', created_at: new Date().toISOString() },
    ]
    const longCmd = 'a'.repeat(100)
    const toolEvents: ToolUseEvent[] = [
      { tool: 'run_command', arguments: { command: longCmd }, status: 'running' },
    ]
    render(<ChatThread {...baseProps} messages={messages} toolEvents={toolEvents} isStreaming={true} streamingText="Running..." />)
    expect(screen.getByText(longCmd.slice(0, 57) + '...')).toBeTruthy()
  })

  it('shows fork button on assistant messages with answered_by', () => {
    const onFork = vi.fn()
    const messages: Message[] = [
      { id: 'm1', conversation_id: 'c1', role: 'user', text: 'Hi', created_at: new Date().toISOString() },
      { id: 'm2', conversation_id: 'c1', role: 'assistant', text: 'Hello!', answered_by: 'local:qwen3', created_at: new Date().toISOString() },
    ]
    render(<ChatThread {...baseProps} messages={messages} onFork={onFork} />)
    const forkBtns = screen.getAllByTitle('Fork conversation from here')
    expect(forkBtns.length).toBeGreaterThan(0)
  })

  it('shows retry with Claude button for local messages', () => {
    const onRetry = vi.fn()
    const messages: Message[] = [
      { id: 'm1', conversation_id: 'c1', role: 'user', text: 'Hi', created_at: new Date().toISOString() },
      { id: 'm2', conversation_id: 'c1', role: 'assistant', text: 'Hello!', answered_by: 'local:qwen3', created_at: new Date().toISOString() },
    ]
    render(<ChatThread {...baseProps} messages={messages} onRetry={onRetry} />)
    const retryBtn = screen.getByText('Retry with Claude')
    fireEvent.click(retryBtn)
    expect(onRetry).toHaveBeenCalledWith('m2', 'cloud')
  })

  it('shows retry locally button for cloud messages', () => {
    const onRetry = vi.fn()
    const messages: Message[] = [
      { id: 'm1', conversation_id: 'c1', role: 'user', text: 'Hi', created_at: new Date().toISOString() },
      { id: 'm2', conversation_id: 'c1', role: 'assistant', text: 'Hello!', answered_by: 'claude-sonnet-4-20250514', created_at: new Date().toISOString() },
    ]
    render(<ChatThread {...baseProps} messages={messages} onRetry={onRetry} />)
    const retryBtn = screen.getByText('Retry locally')
    fireEvent.click(retryBtn)
    expect(onRetry).toHaveBeenCalledWith('m2', 'local')
  })

  it('renders user message text as plain text', () => {
    const messages: Message[] = [
      { id: 'm1', conversation_id: 'c1', role: 'user', text: 'Hello **bold**', created_at: new Date().toISOString() },
    ]
    render(<ChatThread {...baseProps} messages={messages} />)
    expect(screen.getByText('Hello **bold**')).toBeTruthy()
  })

  it('renders thumbs down feedback button', () => {
    const messages: Message[] = [
      { id: 'm1', conversation_id: 'c1', role: 'user', text: 'Hi', created_at: new Date().toISOString() },
      { id: 'm2', conversation_id: 'c1', role: 'assistant', text: 'Hello!', answered_by: 'ollama/llama', created_at: new Date().toISOString() },
    ]
    render(<ChatThread {...baseProps} messages={messages} />)
    const badBtn = screen.getByTitle('Bad response')
    fireEvent.click(badBtn)
  })
})
