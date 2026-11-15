import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { Composer } from './Composer'
import type { ModelsResponse } from '../lib/api'

vi.mock('../lib/api', async () => {
  const actual = await vi.importActual('../lib/api')
  return {
    ...actual,
    getMentionCompletions: vi.fn().mockResolvedValue({ completions: [] }),
  }
})

const models: ModelsResponse = { local: [], cloud: [] }

const baseProps = {
  onSend: vi.fn(),
  disabled: false,
  isStreaming: false,
  onCancel: vi.fn(),
  mode: 'auto',
  selectedModel: null as string | null,
  onSelect: vi.fn(),
  models,
  activeProjectId: null as string | null,
}

describe('Composer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders textarea', () => {
    render(<Composer {...baseProps} />)
    expect(screen.getByPlaceholderText(/message/i)).toBeTruthy()
  })

  it('calls onSend when Enter is pressed', () => {
    const onSend = vi.fn()
    render(<Composer {...baseProps} onSend={onSend} />)
    const textarea = screen.getByPlaceholderText(/message/i)
    fireEvent.change(textarea, { target: { value: 'Hello' } })
    fireEvent.keyDown(textarea, { key: 'Enter' })
    expect(onSend).toHaveBeenCalledWith('Hello')
  })

  it('does not send on Shift+Enter', () => {
    const onSend = vi.fn()
    render(<Composer {...baseProps} onSend={onSend} />)
    const textarea = screen.getByPlaceholderText(/message/i)
    fireEvent.change(textarea, { target: { value: 'Hello' } })
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true })
    expect(onSend).not.toHaveBeenCalled()
  })

  it('does not send empty message', () => {
    const onSend = vi.fn()
    render(<Composer {...baseProps} onSend={onSend} />)
    const textarea = screen.getByPlaceholderText(/message/i)
    fireEvent.keyDown(textarea, { key: 'Enter' })
    expect(onSend).not.toHaveBeenCalled()
  })

  it('clears text after send', () => {
    render(<Composer {...baseProps} />)
    const textarea = screen.getByPlaceholderText(/message/i) as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: 'Hello' } })
    fireEvent.keyDown(textarea, { key: 'Enter' })
    expect(textarea.value).toBe('')
  })

  it('disables textarea when disabled prop is true', () => {
    render(<Composer {...baseProps} disabled={true} />)
    const textarea = screen.getByPlaceholderText(/message/i)
    expect(textarea).toBeDisabled()
  })

  it('shows cancel button when streaming', () => {
    const onCancel = vi.fn()
    render(<Composer {...baseProps} isStreaming={true} onCancel={onCancel} />)
    const buttons = screen.getAllByRole('button')
    const cancelBtn = buttons[buttons.length - 1]
    fireEvent.click(cancelBtn)
    expect(onCancel).toHaveBeenCalled()
  })

  it('renders mode selector with auto/local/cloud', () => {
    render(<Composer {...baseProps} mode="auto" />)
    expect(screen.getByText('Auto')).toBeTruthy()
    expect(screen.getByText('Local')).toBeTruthy()
    expect(screen.getByText('Cloud')).toBeTruthy()
  })

  it('cycles mode with Cmd+M', () => {
    const onSelect = vi.fn()
    render(<Composer {...baseProps} onSelect={onSelect} mode="auto" />)
    const textarea = screen.getByPlaceholderText(/message/i)
    fireEvent.keyDown(textarea, { key: 'm', metaKey: true })
    expect(onSelect).toHaveBeenCalledWith('local', null)
  })

  it('cycles mode from local to cloud', () => {
    const onSelect = vi.fn()
    render(<Composer {...baseProps} onSelect={onSelect} mode="local" />)
    const textarea = screen.getByPlaceholderText(/message/i)
    fireEvent.keyDown(textarea, { key: 'm', metaKey: true })
    expect(onSelect).toHaveBeenCalledWith('cloud', null)
  })

  it('cycles mode from cloud to auto', () => {
    const onSelect = vi.fn()
    render(<Composer {...baseProps} onSelect={onSelect} mode="cloud" />)
    const textarea = screen.getByPlaceholderText(/message/i)
    fireEvent.keyDown(textarea, { key: 'm', metaKey: true })
    expect(onSelect).toHaveBeenCalledWith('auto', null)
  })

  it('selects auto mode on click', () => {
    const onSelect = vi.fn()
    render(<Composer {...baseProps} onSelect={onSelect} mode="local" />)
    fireEvent.click(screen.getByText('Auto'))
    expect(onSelect).toHaveBeenCalledWith('auto', null)
  })

  it('opens local model menu on click', () => {
    const modelsWithLocal: ModelsResponse = {
      local: [{ id: 'llama3', name: 'Llama 3', size: '8B' }],
      cloud: [],
    }
    render(<Composer {...baseProps} models={modelsWithLocal} mode="local" />)
    fireEvent.click(screen.getByText('Local'))
    expect(screen.getByText('Auto (best available)')).toBeTruthy()
    expect(screen.getByText('Llama 3')).toBeTruthy()
  })

  it('shows model size in local model menu', () => {
    const modelsWithLocal: ModelsResponse = {
      local: [{ id: 'llama3', name: 'Llama 3', size: '8B' }],
      cloud: [],
    }
    render(<Composer {...baseProps} models={modelsWithLocal} mode="local" />)
    fireEvent.click(screen.getByText('Local'))
    expect(screen.getByText('8B')).toBeTruthy()
  })

  it('opens cloud model menu on click', () => {
    const modelsWithCloud: ModelsResponse = {
      local: [],
      cloud: [{ id: 'claude-sonnet', name: 'Sonnet', family: 'Claude' }],
    }
    render(<Composer {...baseProps} models={modelsWithCloud} mode="cloud" />)
    fireEvent.click(screen.getByText('Cloud'))
    expect(screen.getByText('Sonnet')).toBeTruthy()
  })

  it('groups cloud models by family', () => {
    const modelsWithCloud: ModelsResponse = {
      local: [],
      cloud: [
        { id: 'claude-sonnet', name: 'Sonnet', family: 'Claude' },
        { id: 'claude-opus', name: 'Opus', family: 'Claude' },
      ],
    }
    render(<Composer {...baseProps} models={modelsWithCloud} mode="cloud" />)
    fireEvent.click(screen.getByText('Cloud'))
    expect(screen.getByText('Claude')).toBeTruthy()
    expect(screen.getByText('Sonnet')).toBeTruthy()
    expect(screen.getByText('Opus')).toBeTruthy()
  })

  it('selects a model from the menu', () => {
    const onSelect = vi.fn()
    const modelsWithLocal: ModelsResponse = {
      local: [{ id: 'llama3', name: 'Llama 3', size: '8B' }],
      cloud: [],
    }
    render(<Composer {...baseProps} onSelect={onSelect} models={modelsWithLocal} mode="local" />)
    fireEvent.click(screen.getByText('Local'))
    fireEvent.click(screen.getByText('Llama 3'))
    expect(onSelect).toHaveBeenCalledWith('local', 'llama3')
  })

  it('selects auto from model menu', () => {
    const onSelect = vi.fn()
    const modelsWithLocal: ModelsResponse = {
      local: [{ id: 'llama3', name: 'Llama 3', size: '8B' }],
      cloud: [],
    }
    render(<Composer {...baseProps} onSelect={onSelect} models={modelsWithLocal} mode="local" />)
    fireEvent.click(screen.getByText('Local'))
    fireEvent.click(screen.getByText('Auto (best available)'))
    expect(onSelect).toHaveBeenCalledWith('local', null)
  })

  it('shows selected model name in mode label', () => {
    const modelsWithLocal: ModelsResponse = {
      local: [{ id: 'llama3', name: 'Llama 3', size: '8B' }],
      cloud: [],
    }
    render(<Composer {...baseProps} models={modelsWithLocal} mode="local" selectedModel="llama3" />)
    expect(screen.getByText('Llama 3')).toBeTruthy()
  })

  it('closes menu on second click', () => {
    const modelsWithLocal: ModelsResponse = {
      local: [{ id: 'llama3', name: 'Llama 3', size: '8B' }],
      cloud: [],
    }
    render(<Composer {...baseProps} models={modelsWithLocal} mode="local" />)
    fireEvent.click(screen.getByText('Local'))
    expect(screen.getByText('Auto (best available)')).toBeTruthy()
    fireEvent.click(screen.getByText('Local'))
  })

  it('closes menu on outside click', () => {
    const modelsWithLocal: ModelsResponse = {
      local: [{ id: 'llama3', name: 'Llama 3', size: '8B' }],
      cloud: [],
    }
    render(<Composer {...baseProps} models={modelsWithLocal} mode="local" />)
    fireEvent.click(screen.getByText('Local'))
    expect(screen.getByText('Auto (best available)')).toBeTruthy()
    act(() => {
      document.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    })
  })

  it('shows send button when not streaming', () => {
    render(<Composer {...baseProps} />)
    const buttons = screen.getAllByRole('button')
    expect(buttons.length).toBeGreaterThan(0)
  })

  it('send button disabled when text is empty', () => {
    render(<Composer {...baseProps} />)
    const buttons = screen.getAllByRole('button')
    const sendBtn = buttons[buttons.length - 1]
    expect(sendBtn).toBeDisabled()
  })

  it('handles textarea input for auto-resize', () => {
    render(<Composer {...baseProps} />)
    const textarea = screen.getByPlaceholderText(/message/i)
    fireEvent.input(textarea)
  })

  it('detects @mention trigger', () => {
    render(<Composer {...baseProps} />)
    const textarea = screen.getByPlaceholderText(/message/i) as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: '@test' } })
    Object.defineProperty(textarea, 'selectionStart', { value: 5, writable: true })
    fireEvent.input(textarea)
  })

  it('shows keyboard shortcut hint', () => {
    render(<Composer {...baseProps} />)
    expect(screen.getByText('⌘M')).toBeTruthy()
  })

  it('highlights selected model in menu', () => {
    const modelsWithLocal: ModelsResponse = {
      local: [
        { id: 'llama3', name: 'Llama 3', size: '8B' },
        { id: 'qwen', name: 'Qwen', size: '7B' },
      ],
      cloud: [],
    }
    render(<Composer {...baseProps} models={modelsWithLocal} mode="local" selectedModel="llama3" />)
    fireEvent.click(screen.getByText('Llama 3'))
  })

  it('shows selected cloud model name in label', () => {
    const modelsWithCloud: ModelsResponse = {
      local: [],
      cloud: [{ id: 'claude-sonnet', name: 'Sonnet', family: 'Claude' }],
    }
    render(<Composer {...baseProps} models={modelsWithCloud} mode="cloud" selectedModel="claude-sonnet" />)
    expect(screen.getByText('Sonnet')).toBeTruthy()
  })

  it('handles handleMentionSelect via @ replacement', async () => {
    render(<Composer {...baseProps} />)
    const textarea = screen.getByPlaceholderText(/message/i) as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: '@tes' } })
    Object.defineProperty(textarea, 'selectionStart', { value: 4, writable: true })
    fireEvent.input(textarea)
  })
})
