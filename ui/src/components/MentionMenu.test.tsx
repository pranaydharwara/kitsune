import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MentionMenu } from './MentionMenu'

vi.mock('../lib/api', () => ({
  getMentionCompletions: vi.fn().mockResolvedValue({
    completions: [
      { type: 'file', value: '@file test.py', label: 'test.py', detail: '1234 bytes' },
      { type: 'folder', value: '@folder src', label: 'src/' },
    ],
  }),
}))

describe('MentionMenu', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  it('renders completions after debounce', async () => {
    vi.useRealTimers()
    render(
      <MentionMenu
        query="@file test"
        projectId="p1"
        position={{ left: 100, bottom: 200 }}
        onSelect={vi.fn()}
        onClose={vi.fn()}
      />
    )
    await waitFor(() => {
      expect(screen.getByText('test.py')).toBeTruthy()
    })
  })

  it('calls onSelect when item clicked', async () => {
    vi.useRealTimers()
    const onSelect = vi.fn()
    render(
      <MentionMenu
        query="@file test"
        projectId="p1"
        position={{ left: 100, bottom: 200 }}
        onSelect={onSelect}
        onClose={vi.fn()}
      />
    )
    await waitFor(() => {
      expect(screen.getByText('test.py')).toBeTruthy()
    })
    fireEvent.click(screen.getByText('test.py'))
    expect(onSelect).toHaveBeenCalledWith('@file test.py')
  })

  it('closes on Escape key', async () => {
    vi.useRealTimers()
    const onClose = vi.fn()
    render(
      <MentionMenu
        query="@file test"
        projectId="p1"
        position={{ left: 100, bottom: 200 }}
        onSelect={vi.fn()}
        onClose={onClose}
      />
    )
    await waitFor(() => {
      expect(screen.getByText('test.py')).toBeTruthy()
    })
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })

  it('navigates with arrow keys', async () => {
    vi.useRealTimers()
    render(
      <MentionMenu
        query="@file test"
        projectId="p1"
        position={{ left: 100, bottom: 200 }}
        onSelect={vi.fn()}
        onClose={vi.fn()}
      />
    )
    await waitFor(() => {
      expect(screen.getByText('test.py')).toBeTruthy()
    })
    fireEvent.keyDown(document, { key: 'ArrowDown' })
    fireEvent.keyDown(document, { key: 'ArrowUp' })
  })

  it('selects with Enter key', async () => {
    vi.useRealTimers()
    const onSelect = vi.fn()
    render(
      <MentionMenu
        query="@file test"
        projectId="p1"
        position={{ left: 100, bottom: 200 }}
        onSelect={onSelect}
        onClose={vi.fn()}
      />
    )
    await waitFor(() => {
      expect(screen.getByText('test.py')).toBeTruthy()
    })
    fireEvent.keyDown(document, { key: 'Enter' })
    expect(onSelect).toHaveBeenCalledWith('@file test.py')
  })

  it('closes on outside click', async () => {
    vi.useRealTimers()
    const onClose = vi.fn()
    render(
      <MentionMenu
        query="@file test"
        projectId="p1"
        position={{ left: 100, bottom: 200 }}
        onSelect={vi.fn()}
        onClose={onClose}
      />
    )
    await waitFor(() => {
      expect(screen.getByText('test.py')).toBeTruthy()
    })
    fireEvent.mouseDown(document.body)
    expect(onClose).toHaveBeenCalled()
  })
})
