import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { InstructionsEditor } from './InstructionsEditor'

vi.mock('../lib/api', () => ({
  getProjectInstructions: vi.fn().mockResolvedValue({
    found: true,
    file: '.kitsune/instructions.md',
    content: 'Existing instructions',
  }),
  setProjectInstructions: vi.fn().mockResolvedValue(undefined),
}))

describe('InstructionsEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders modal with project name', async () => {
    render(
      <InstructionsEditor projectId="p1" projectName="MyProject" onClose={vi.fn()} />
    )
    expect(screen.getByText(/project instructions/i)).toBeTruthy()
    expect(screen.getByText(/MyProject/)).toBeTruthy()
  })

  it('loads instructions on mount', async () => {
    render(
      <InstructionsEditor projectId="p1" projectName="Test" onClose={vi.fn()} />
    )
    await waitFor(() => {
      expect(screen.getByDisplayValue('Existing instructions')).toBeTruthy()
    })
  })

  it('shows source file info', async () => {
    render(
      <InstructionsEditor projectId="p1" projectName="Test" onClose={vi.fn()} />
    )
    await waitFor(() => {
      expect(screen.getByText(/instructions\.md/)).toBeTruthy()
    })
  })

  it('calls onClose when cancel clicked', async () => {
    const onClose = vi.fn()
    render(
      <InstructionsEditor projectId="p1" projectName="Test" onClose={onClose} />
    )
    await waitFor(() => {
      expect(screen.getByText('Cancel')).toBeTruthy()
    })
    fireEvent.click(screen.getByText('Cancel'))
    expect(onClose).toHaveBeenCalled()
  })

  it('calls onClose when backdrop clicked', async () => {
    const onClose = vi.fn()
    const { container } = render(
      <InstructionsEditor projectId="p1" projectName="Test" onClose={onClose} />
    )
    const backdrop = container.querySelector('.fixed.inset-0')
    if (backdrop) {
      fireEvent.click(backdrop)
      expect(onClose).toHaveBeenCalled()
    }
  })

  it('enables save button when content changes', async () => {
    render(
      <InstructionsEditor projectId="p1" projectName="Test" onClose={vi.fn()} />
    )
    await waitFor(() => {
      expect(screen.getByDisplayValue('Existing instructions')).toBeTruthy()
    })
    const textarea = screen.getByDisplayValue('Existing instructions')
    fireEvent.change(textarea, { target: { value: 'New content' } })
    const saveBtn = screen.getByText('Save')
    expect(saveBtn).not.toBeDisabled()
  })

  it('shows character count', async () => {
    render(
      <InstructionsEditor projectId="p1" projectName="Test" onClose={vi.fn()} />
    )
    await waitFor(() => {
      expect(screen.getByText(/\/ 4000 chars/)).toBeTruthy()
    })
  })

  it('saves instructions and updates source file', async () => {
    const { setProjectInstructions } = await import('../lib/api')
    render(
      <InstructionsEditor projectId="p1" projectName="Test" onClose={vi.fn()} />
    )
    await waitFor(() => {
      expect(screen.getByDisplayValue('Existing instructions')).toBeTruthy()
    })
    const textarea = screen.getByDisplayValue('Existing instructions')
    fireEvent.change(textarea, { target: { value: 'Updated content' } })
    fireEvent.click(screen.getByText('Save'))
    await waitFor(() => {
      expect(setProjectInstructions).toHaveBeenCalledWith('p1', 'Updated content')
    })
  })

  it('shows empty char count when content is empty', async () => {
    const { getProjectInstructions } = await import('../lib/api')
    vi.mocked(getProjectInstructions).mockResolvedValueOnce({
      found: false,
      file: null,
      content: '',
    })
    render(
      <InstructionsEditor projectId="p1" projectName="Test" onClose={vi.fn()} />
    )
    await waitFor(() => {
      expect(screen.queryByText(/\/ 4000 chars/)).toBeNull()
    })
  })

  it('disables save button when not dirty', async () => {
    render(
      <InstructionsEditor projectId="p1" projectName="Test" onClose={vi.fn()} />
    )
    await waitFor(() => {
      expect(screen.getByDisplayValue('Existing instructions')).toBeTruthy()
    })
    const saveBtn = screen.getByText('Save').closest('button')
    expect(saveBtn).toBeDisabled()
  })
})
