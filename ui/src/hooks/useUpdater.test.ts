import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useUpdater } from './useUpdater'

const mockUpdate = {
  version: '1.2.0',
  downloadAndInstall: vi.fn(),
}

vi.mock('@tauri-apps/plugin-updater', () => ({
  check: vi.fn(),
}))

import { check } from '@tauri-apps/plugin-updater'

describe('useUpdater', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(check).mockResolvedValue(null)
  })

  it('starts with idle status', () => {
    const { result } = renderHook(() => useUpdater())
    expect(result.current.status).toBe('idle')
    expect(result.current.version).toBeNull()
  })

  it('checkForUpdate sets available status', async () => {
    vi.mocked(check).mockResolvedValue(mockUpdate as any)
    const { result } = renderHook(() => useUpdater())

    await act(async () => {
      await result.current.checkForUpdate()
    })

    expect(result.current.status).toBe('available')
    expect(result.current.version).toBe('1.2.0')
  })

  it('dismiss resets state to idle', async () => {
    vi.mocked(check).mockResolvedValue(mockUpdate as any)
    const { result } = renderHook(() => useUpdater())

    await act(async () => {
      await result.current.checkForUpdate()
    })

    expect(result.current.status).toBe('available')

    act(() => {
      result.current.dismiss()
    })

    expect(result.current.status).toBe('idle')
    expect(result.current.version).toBeNull()
  })

  it('handles check failure gracefully', async () => {
    vi.mocked(check).mockRejectedValue(new Error('network'))
    const { result } = renderHook(() => useUpdater())

    await act(async () => {
      await result.current.checkForUpdate()
    })

    expect(result.current.status).toBe('idle')
  })

  it('installUpdate handles download and install', async () => {
    mockUpdate.downloadAndInstall.mockImplementation(async (cb: Function) => {
      cb({ event: 'Started', data: { contentLength: 1000 } })
      cb({ event: 'Progress', data: { chunkLength: 500 } })
      cb({ event: 'Finished', data: {} })
    })
    vi.mocked(check).mockResolvedValue(mockUpdate as any)

    const { result } = renderHook(() => useUpdater())

    await act(async () => {
      await result.current.checkForUpdate()
    })

    await act(async () => {
      await result.current.installUpdate()
    })

    expect(result.current.status).toBe('ready')
    expect(result.current.progress).toBe(100)
  })

  it('installUpdate handles errors', async () => {
    vi.mocked(check).mockResolvedValue(mockUpdate as any)
    mockUpdate.downloadAndInstall.mockRejectedValue(new Error('download failed'))

    const { result } = renderHook(() => useUpdater())

    await act(async () => {
      await result.current.checkForUpdate()
    })

    await act(async () => {
      await result.current.installUpdate()
    })

    expect(result.current.status).toBe('error')
  })
})
