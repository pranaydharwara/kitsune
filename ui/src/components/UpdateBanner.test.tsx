import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { UpdateBanner } from './UpdateBanner'

describe('UpdateBanner', () => {
  it('renders nothing when idle', () => {
    const { container } = render(
      <UpdateBanner status="idle" version={null} progress={0} onInstall={vi.fn()} onDismiss={vi.fn()} />
    )
    expect(container.innerHTML).toBe('')
  })

  it('renders nothing when error', () => {
    const { container } = render(
      <UpdateBanner status="error" version={null} progress={0} onInstall={vi.fn()} onDismiss={vi.fn()} />
    )
    expect(container.innerHTML).toBe('')
  })

  it('shows update available with version', () => {
    render(
      <UpdateBanner status="available" version="1.2.0" progress={0} onInstall={vi.fn()} onDismiss={vi.fn()} />
    )
    expect(screen.getByText(/1\.2\.0/)).toBeTruthy()
  })

  it('calls onInstall when update button clicked', () => {
    const onInstall = vi.fn()
    render(
      <UpdateBanner status="available" version="1.2.0" progress={0} onInstall={onInstall} onDismiss={vi.fn()} />
    )
    const btn = screen.getByText(/update now/i)
    fireEvent.click(btn)
    expect(onInstall).toHaveBeenCalled()
  })

  it('calls onDismiss when dismiss button clicked', () => {
    const onDismiss = vi.fn()
    render(
      <UpdateBanner status="available" version="1.2.0" progress={0} onInstall={vi.fn()} onDismiss={onDismiss} />
    )
    const buttons = screen.getAllByRole('button')
    const dismissBtn = buttons[buttons.length - 1]
    fireEvent.click(dismissBtn)
    expect(onDismiss).toHaveBeenCalled()
  })

  it('shows downloading state with progress', () => {
    render(
      <UpdateBanner status="downloading" version="1.2.0" progress={50} onInstall={vi.fn()} onDismiss={vi.fn()} />
    )
    expect(screen.getByText(/download/i)).toBeTruthy()
  })

  it('shows ready state', () => {
    render(
      <UpdateBanner status="ready" version="1.2.0" progress={100} onInstall={vi.fn()} onDismiss={vi.fn()} />
    )
    expect(screen.getByText(/restart/i)).toBeTruthy()
  })
})
