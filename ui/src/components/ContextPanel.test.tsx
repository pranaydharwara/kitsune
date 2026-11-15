import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ContextPanel } from './ContextPanel'

describe('ContextPanel', () => {
  it('renders nothing when closed', () => {
    const { container } = render(
      <ContextPanel data={null} open={false} onClose={vi.fn()} />
    )
    expect(container.querySelector('[class*="flex flex-col"]')).toBeNull()
  })

  it('renders nothing when no data', () => {
    const { container } = render(
      <ContextPanel data={null} open={true} onClose={vi.fn()} />
    )
    expect(container.innerHTML).toBe('')
  })

  it('renders with mention context data', () => {
    const data = {
      items: [
        { type: 'file', arg: 'test.py', status: 'ok' as const, content: 'print("hi")' },
        { type: 'file', arg: 'missing.py', status: 'not_found' as const },
      ],
    }
    render(<ContextPanel data={data} open={true} onClose={vi.fn()} />)
    expect(screen.getByText(/test\.py/)).toBeTruthy()
    expect(screen.getByText(/missing\.py/)).toBeTruthy()
  })

  it('calls onClose when close button clicked', () => {
    const onClose = vi.fn()
    const data = {
      items: [{ type: 'file', arg: 'test.py', status: 'ok' as const, content: 'hello' }],
    }
    render(<ContextPanel data={data} open={true} onClose={onClose} />)
    const closeButtons = screen.getAllByRole('button')
    fireEvent.click(closeButtons[0])
    expect(onClose).toHaveBeenCalled()
  })

  it('toggles expand on context card click', () => {
    const data = {
      items: [{ type: 'file', arg: 'test.py', status: 'ok' as const, content: 'print("hi")' }],
    }
    render(<ContextPanel data={data} open={true} onClose={vi.fn()} />)
    const card = screen.getByText(/test\.py/)
    fireEvent.click(card.closest('button') || card)
  })
})
