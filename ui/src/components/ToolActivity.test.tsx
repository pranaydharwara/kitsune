import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ToolActivity } from './ToolActivity'
import type { ToolUseEvent } from '../lib/api'

describe('ToolActivity', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders nothing when closed', () => {
    const events: ToolUseEvent[] = [
      { tool: 'read_file', arguments: { path: 'test.py' }, status: 'done', result: { content: 'hello' } },
    ]
    const { container } = render(
      <ToolActivity events={events} open={false} onClose={vi.fn()} />
    )
    expect(container.innerHTML).toBe('')
  })

  it('renders nothing when open but no events', () => {
    const { container } = render(
      <ToolActivity events={[]} open={true} onClose={vi.fn()} />
    )
    expect(container.innerHTML).toBe('')
  })

  it('renders panel when open with events', () => {
    const events: ToolUseEvent[] = [
      { tool: 'read_file', arguments: { path: 'test.py' }, status: 'done', result: { content: 'hello' } },
    ]
    render(
      <ToolActivity events={events} open={true} onClose={vi.fn()} />
    )
    expect(screen.getByText(/tool activity/i)).toBeTruthy()
  })

  it('shows event count badge', () => {
    const events: ToolUseEvent[] = [
      { tool: 'read_file', arguments: { path: 'a.py' }, status: 'done', result: { content: 'hello' } },
      { tool: 'read_file', arguments: { path: 'b.py' }, status: 'done', result: { content: 'world' } },
    ]
    render(
      <ToolActivity events={events} open={true} onClose={vi.fn()} />
    )
    expect(screen.getByText('2')).toBeTruthy()
  })

  it('calls onClose when close button clicked', () => {
    const onClose = vi.fn()
    const events: ToolUseEvent[] = [
      { tool: 'read_file', arguments: { path: 'test.py' }, status: 'done', result: { content: 'hello' } },
    ]
    render(
      <ToolActivity events={events} open={true} onClose={onClose} />
    )
    const closeButtons = screen.getAllByRole('button')
    fireEvent.click(closeButtons[0])
    expect(onClose).toHaveBeenCalled()
  })

  it('renders read_file event with path', () => {
    const events: ToolUseEvent[] = [
      { tool: 'read_file', arguments: { path: 'main.py' }, status: 'done', result: { content: 'code here' } },
    ]
    render(
      <ToolActivity events={events} open={true} onClose={vi.fn()} />
    )
    expect(screen.getByText('main.py')).toBeTruthy()
    expect(screen.getByText('Read')).toBeTruthy()
  })

  it('renders create_file event', () => {
    const events: ToolUseEvent[] = [
      { tool: 'create_file', arguments: { path: 'new.py', content: 'print("hi")' }, status: 'done', result: { success: true, size: 12 } },
    ]
    render(
      <ToolActivity events={events} open={true} onClose={vi.fn()} />
    )
    expect(screen.getByText('new.py')).toBeTruthy()
    expect(screen.getByText('Created')).toBeTruthy()
    expect(screen.getByText('Created (12 bytes)')).toBeTruthy()
  })

  it('renders edit_file event with diff', () => {
    const events: ToolUseEvent[] = [
      { tool: 'edit_file', arguments: { path: 'edit.py', old_string: 'old code', new_string: 'new code' }, status: 'done', result: { success: true, replacements: 1 } },
    ]
    render(
      <ToolActivity events={events} open={true} onClose={vi.fn()} />
    )
    expect(screen.getByText('edit.py')).toBeTruthy()
    expect(screen.getByText('Edited')).toBeTruthy()
    expect(screen.getByText(/- old code/)).toBeTruthy()
    expect(screen.getByText(/\+ new code/)).toBeTruthy()
    expect(screen.getByText('Edited (1 replacement)')).toBeTruthy()
  })

  it('renders run_command event', () => {
    const events: ToolUseEvent[] = [
      { tool: 'run_command', arguments: { command: 'pytest' }, status: 'done', result: { output: 'all passed', exit_code: 0 } },
    ]
    render(
      <ToolActivity events={events} open={true} onClose={vi.fn()} />
    )
    expect(screen.getByText('Ran')).toBeTruthy()
    expect(screen.getByText('$ pytest')).toBeTruthy()
    expect(screen.getByText('all passed')).toBeTruthy()
  })

  it('renders run_command with non-zero exit code', () => {
    const events: ToolUseEvent[] = [
      { tool: 'run_command', arguments: { command: 'false' }, status: 'done', result: { output: 'failed', exit_code: 1 } },
    ]
    render(
      <ToolActivity events={events} open={true} onClose={vi.fn()} />
    )
    expect(screen.getByText(/Exit code: 1/)).toBeTruthy()
  })

  it('renders list_files event', () => {
    const events: ToolUseEvent[] = [
      { tool: 'list_files', arguments: { path: 'src/' }, status: 'done', result: { entries: ['a.py', 'b.py'] } },
    ]
    render(
      <ToolActivity events={events} open={true} onClose={vi.fn()} />
    )
    expect(screen.getByText('src/')).toBeTruthy()
    expect(screen.getByText('Listed')).toBeTruthy()
  })

  it('renders list_files with default path', () => {
    const events: ToolUseEvent[] = [
      { tool: 'list_files', arguments: {}, status: 'done', result: { entries: ['x.py'] } },
    ]
    render(
      <ToolActivity events={events} open={true} onClose={vi.fn()} />
    )
    expect(screen.getByText('.')).toBeTruthy()
  })

  it('renders git_operation event', () => {
    const events: ToolUseEvent[] = [
      { tool: 'git_operation', arguments: { operation: 'commit', args: '-m "fix"' }, status: 'done', result: { output: 'committed', exit_code: 0 } },
    ]
    render(
      <ToolActivity events={events} open={true} onClose={vi.fn()} />
    )
    expect(screen.getByText('Git')).toBeTruthy()
    expect(screen.getByText('commit -m "fix"')).toBeTruthy()
  })

  it('renders think event with steps', () => {
    const events: ToolUseEvent[] = [
      { tool: 'think', arguments: { steps: ['Step 1', 'Step 2', 'Step 3'] }, status: 'done', result: { steps: ['Step 1', 'Step 2', 'Step 3'] } },
    ]
    render(
      <ToolActivity events={events} open={true} onClose={vi.fn()} />
    )
    expect(screen.getByText('Planned')).toBeTruthy()
    expect(screen.getByText('3 steps')).toBeTruthy()
    expect(screen.getByText('Step 1')).toBeTruthy()
    expect(screen.getByText('Step 2')).toBeTruthy()
  })

  it('renders verify event - pass', () => {
    const events: ToolUseEvent[] = [
      { tool: 'verify', arguments: { check: 'tests pass' }, status: 'done', result: { result: 'pass', check: 'tests pass', details: 'all good' } },
    ]
    render(
      <ToolActivity events={events} open={true} onClose={vi.fn()} />
    )
    expect(screen.getByText('Verified')).toBeTruthy()
    expect(screen.getByText('✓ Pass')).toBeTruthy()
    expect(screen.getAllByText(/all good/).length).toBeGreaterThanOrEqual(1)
  })

  it('renders verify event - fail', () => {
    const events: ToolUseEvent[] = [
      { tool: 'verify', arguments: { check: 'lint' }, status: 'done', result: { result: 'fail', check: 'lint', details: 'errors found' } },
    ]
    render(
      <ToolActivity events={events} open={true} onClose={vi.fn()} />
    )
    expect(screen.getByText('✗ Fail')).toBeTruthy()
  })

  it('renders verify event - partial', () => {
    const events: ToolUseEvent[] = [
      { tool: 'verify', arguments: { check: 'coverage' }, status: 'done', result: { result: 'partial', check: 'coverage' } },
    ]
    render(
      <ToolActivity events={events} open={true} onClose={vi.fn()} />
    )
    expect(screen.getByText('~ Partial')).toBeTruthy()
  })

  it('renders running event with spinner', () => {
    const events: ToolUseEvent[] = [
      { tool: 'run_command', arguments: { command: 'make build' }, status: 'running' },
    ]
    render(
      <ToolActivity events={events} open={true} onClose={vi.fn()} />
    )
    expect(screen.getByText('Run Command')).toBeTruthy()
    expect(screen.getByText('Executing...')).toBeTruthy()
  })

  it('renders running event with partial output', () => {
    const events: ToolUseEvent[] = [
      { tool: 'run_command', arguments: { command: 'make build' }, status: 'running', partial: 'Building...' },
    ]
    render(
      <ToolActivity events={events} open={true} onClose={vi.fn()} />
    )
    expect(screen.getByText('Building...')).toBeTruthy()
    expect(screen.getByText('Running...')).toBeTruthy()
  })

  it('renders error event with red styling', () => {
    const events: ToolUseEvent[] = [
      { tool: 'run_command', arguments: { command: 'bad' }, status: 'done', result: { error: 'command not found' } },
    ]
    render(
      <ToolActivity events={events} open={true} onClose={vi.fn()} />
    )
    expect(screen.getByText('command not found')).toBeTruthy()
  })

  it('truncates long run_command detail', () => {
    const longCmd = 'a'.repeat(50)
    const events: ToolUseEvent[] = [
      { tool: 'run_command', arguments: { command: longCmd }, status: 'done', result: { output: 'done', exit_code: 0 } },
    ]
    render(
      <ToolActivity events={events} open={true} onClose={vi.fn()} />
    )
    expect(screen.getByText(longCmd.slice(0, 37) + '...')).toBeTruthy()
  })

  it('toggles card collapse on click', () => {
    const events: ToolUseEvent[] = [
      { tool: 'read_file', arguments: { path: 'test.py' }, status: 'done', result: { content: 'file content here' } },
    ]
    render(
      <ToolActivity events={events} open={true} onClose={vi.fn()} />
    )
    expect(screen.getByText('file content here')).toBeTruthy()
    const cardButtons = screen.getAllByRole('button')
    const toggleBtn = cardButtons.find(b => b.textContent?.includes('Read'))
    if (toggleBtn) {
      fireEvent.click(toggleBtn)
      expect(screen.queryByText('file content here')).toBeNull()
      fireEvent.click(toggleBtn)
      expect(screen.getByText('file content here')).toBeTruthy()
    }
  })

  it('renders unknown tool type with default icon', () => {
    const events: ToolUseEvent[] = [
      { tool: 'custom_tool', arguments: {}, status: 'done', result: {} },
    ]
    render(
      <ToolActivity events={events} open={true} onClose={vi.fn()} />
    )
    expect(screen.getByText('custom_tool')).toBeTruthy()
  })

  it('renders create_file content preview', () => {
    const events: ToolUseEvent[] = [
      { tool: 'create_file', arguments: { path: 'new.py', content: 'print("hello world")' }, status: 'done', result: { success: true, size: 20 } },
    ]
    render(
      <ToolActivity events={events} open={true} onClose={vi.fn()} />
    )
    expect(screen.getByText('print("hello world")')).toBeTruthy()
  })

  it('handles scroll event on container', () => {
    const events: ToolUseEvent[] = [
      { tool: 'read_file', arguments: { path: 'a.py' }, status: 'done', result: { content: 'a' } },
      { tool: 'read_file', arguments: { path: 'b.py' }, status: 'done', result: { content: 'b' } },
    ]
    const { container } = render(
      <ToolActivity events={events} open={true} onClose={vi.fn()} />
    )
    const scrollContainer = container.querySelector('.overflow-y-auto')
    if (scrollContainer) {
      fireEvent.scroll(scrollContainer)
    }
  })
})
