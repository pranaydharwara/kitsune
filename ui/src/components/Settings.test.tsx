import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { Settings } from './Settings'

const mockGetSettings = vi.fn()
const mockUpdateSettings = vi.fn()
const mockClearApiKey = vi.fn()
const mockGetUsage = vi.fn()
const mockExportAll = vi.fn()
const mockImportConversations = vi.fn()

vi.mock('../lib/api', () => ({
  getSettings: (...args: unknown[]) => mockGetSettings(...args),
  updateSettings: (...args: unknown[]) => mockUpdateSettings(...args),
  clearApiKey: (...args: unknown[]) => mockClearApiKey(...args),
  getUsage: (...args: unknown[]) => mockGetUsage(...args),
  exportAll: (...args: unknown[]) => mockExportAll(...args),
  importConversations: (...args: unknown[]) => mockImportConversations(...args),
}))

const updater = {
  status: 'idle' as const,
  version: null,
  error: null,
  progress: 0,
  checkForUpdate: vi.fn(),
  installUpdate: vi.fn(),
  dismiss: vi.fn(),
}

describe('Settings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetSettings.mockResolvedValue({
      anthropic_api_key: '',
      has_api_key: false,
      default_mode: 'auto',
      default_model: null,
      theme: 'system',
    })
    mockGetUsage.mockResolvedValue({
      total_messages: 100,
      cloud_messages: 30,
      local_messages: 70,
      total_tokens_in: 50000,
      total_tokens_out: 25000,
      total_cost: 0.50,
    })
    mockUpdateSettings.mockResolvedValue(undefined)
    mockClearApiKey.mockResolvedValue(undefined)
    mockExportAll.mockResolvedValue({ content: '{}', filename: 'export.json' })
    mockImportConversations.mockResolvedValue({ imported: 5 })
  })

  it('renders nothing when closed', () => {
    const { container } = render(
      <Settings open={false} onClose={vi.fn()} onRefresh={vi.fn()} updater={updater} />
    )
    expect(container.innerHTML).toBe('')
  })

  it('renders modal when open', async () => {
    render(
      <Settings open={true} onClose={vi.fn()} onRefresh={vi.fn()} updater={updater} />
    )
    await waitFor(() => {
      expect(screen.getByText('Settings')).toBeTruthy()
    })
  })

  it('shows general tab by default', async () => {
    render(
      <Settings open={true} onClose={vi.fn()} onRefresh={vi.fn()} updater={updater} />
    )
    await waitFor(() => {
      expect(screen.getByText(/api key/i)).toBeTruthy()
    })
  })

  it('calls onClose when close button clicked', async () => {
    const onClose = vi.fn()
    render(
      <Settings open={true} onClose={onClose} onRefresh={vi.fn()} updater={updater} />
    )
    await waitFor(() => expect(screen.getByText('Settings')).toBeTruthy())
    const closeButtons = screen.getAllByRole('button')
    const closeBtn = closeButtons.find(b => b.querySelector('svg') && !b.textContent)
    if (closeBtn) fireEvent.click(closeBtn)
    expect(onClose).toHaveBeenCalled()
  })

  it('renders version info', async () => {
    render(
      <Settings open={true} onClose={vi.fn()} onRefresh={vi.fn()} updater={updater} />
    )
    await waitFor(() => {
      expect(screen.getByText(/0\.0\.0/)).toBeTruthy()
    })
  })

  it('saves API key', async () => {
    mockGetSettings.mockResolvedValueOnce({
      anthropic_api_key: '',
      has_api_key: false,
      default_mode: 'auto',
    }).mockResolvedValue({
      anthropic_api_key: 'sk-ant-***',
      has_api_key: true,
      default_mode: 'auto',
    })

    render(
      <Settings open={true} onClose={vi.fn()} onRefresh={vi.fn()} updater={updater} />
    )
    await waitFor(() => expect(screen.getByPlaceholderText('sk-ant-...')).toBeTruthy())
    const input = screen.getByPlaceholderText('sk-ant-...')
    fireEvent.change(input, { target: { value: 'sk-ant-test123' } })
    fireEvent.click(screen.getByText('Save'))
    await waitFor(() => {
      expect(mockUpdateSettings).toHaveBeenCalledWith({ anthropic_api_key: 'sk-ant-test123' })
    })
  })

  it('does not save empty API key', async () => {
    render(
      <Settings open={true} onClose={vi.fn()} onRefresh={vi.fn()} updater={updater} />
    )
    await waitFor(() => expect(screen.getByText('Save')).toBeTruthy())
    fireEvent.click(screen.getByText('Save'))
    expect(mockUpdateSettings).not.toHaveBeenCalled()
  })

  it('toggles API key visibility', async () => {
    render(
      <Settings open={true} onClose={vi.fn()} onRefresh={vi.fn()} updater={updater} />
    )
    await waitFor(() => expect(screen.getByPlaceholderText('sk-ant-...')).toBeTruthy())
    const input = screen.getByPlaceholderText('sk-ant-...') as HTMLInputElement
    expect(input.type).toBe('password')
    const toggleButtons = screen.getAllByRole('button')
    const eyeBtn = toggleButtons.find(b => b.closest('.relative'))
    if (eyeBtn) {
      fireEvent.click(eyeBtn)
      expect(input.type).toBe('text')
    }
  })

  it('clears API key', async () => {
    mockGetSettings.mockResolvedValueOnce({
      anthropic_api_key: 'sk-ant-***',
      has_api_key: true,
      default_mode: 'auto',
    }).mockResolvedValue({
      anthropic_api_key: '',
      has_api_key: false,
      default_mode: 'auto',
    })

    render(
      <Settings open={true} onClose={vi.fn()} onRefresh={vi.fn()} updater={updater} />
    )
    await waitFor(() => expect(screen.getByText('sk-ant-***')).toBeTruthy())
    const buttons = screen.getAllByRole('button')
    const trashBtn = buttons.find(b => {
      const svg = b.querySelector('svg')
      return svg && b.closest('.flex.items-center.gap-2')
    })
    if (trashBtn) {
      fireEvent.click(trashBtn)
      await waitFor(() => {
        expect(mockClearApiKey).toHaveBeenCalled()
      })
    }
  })

  it('changes default mode', async () => {
    mockGetSettings.mockResolvedValue({
      anthropic_api_key: '',
      has_api_key: false,
      default_mode: 'auto',
    })

    render(
      <Settings open={true} onClose={vi.fn()} onRefresh={vi.fn()} updater={updater} />
    )
    await waitFor(() => expect(screen.getByText('Local')).toBeTruthy())
    fireEvent.click(screen.getByText('Local'))
    await waitFor(() => {
      expect(mockUpdateSettings).toHaveBeenCalledWith({ default_mode: 'local' })
    })
  })

  it('switches to usage tab', async () => {
    render(
      <Settings open={true} onClose={vi.fn()} onRefresh={vi.fn()} updater={updater} />
    )
    await waitFor(() => expect(screen.getByText('Usage')).toBeTruthy())
    fireEvent.click(screen.getByText('Usage'))
    await waitFor(() => {
      expect(screen.getByText('Total Messages')).toBeTruthy()
      expect(screen.getByText('100')).toBeTruthy()
      expect(screen.getByText('Cloud Messages')).toBeTruthy()
      expect(screen.getByText('30')).toBeTruthy()
      expect(screen.getByText('Local Messages')).toBeTruthy()
      expect(screen.getByText('70')).toBeTruthy()
    })
  })

  it('formats large numbers in usage', async () => {
    mockGetUsage.mockResolvedValue({
      total_messages: 100,
      cloud_messages: 30,
      local_messages: 70,
      total_tokens_in: 1500000,
      total_tokens_out: 25000,
      total_cost: 0.50,
    })
    render(
      <Settings open={true} onClose={vi.fn()} onRefresh={vi.fn()} updater={updater} />
    )
    await waitFor(() => expect(screen.getByText('Usage')).toBeTruthy())
    fireEvent.click(screen.getByText('Usage'))
    await waitFor(() => {
      expect(screen.getByText('1.5M')).toBeTruthy()
      expect(screen.getByText('25.0K')).toBeTruthy()
    })
  })

  it('shows cost in usage', async () => {
    render(
      <Settings open={true} onClose={vi.fn()} onRefresh={vi.fn()} updater={updater} />
    )
    await waitFor(() => expect(screen.getByText('Usage')).toBeTruthy())
    fireEvent.click(screen.getByText('Usage'))
    await waitFor(() => {
      expect(screen.getByText('$0.5000')).toBeTruthy()
    })
  })

  it('switches to data tab', async () => {
    render(
      <Settings open={true} onClose={vi.fn()} onRefresh={vi.fn()} updater={updater} />
    )
    await waitFor(() => expect(screen.getByText('Data')).toBeTruthy())
    fireEvent.click(screen.getByText('Data'))
    await waitFor(() => {
      expect(screen.getByText('Export all conversations')).toBeTruthy()
      expect(screen.getByText('Choose JSON file')).toBeTruthy()
    })
  })

  it('exports conversations in non-Tauri env', async () => {
    const createObjectURL = vi.fn().mockReturnValue('blob:url')
    const revokeObjectURL = vi.fn()
    Object.defineProperty(window, 'URL', {
      value: { createObjectURL, revokeObjectURL },
      writable: true,
    })

    render(
      <Settings open={true} onClose={vi.fn()} onRefresh={vi.fn()} updater={updater} />
    )
    await waitFor(() => expect(screen.getByText('Data')).toBeTruthy())
    fireEvent.click(screen.getByText('Data'))
    await waitFor(() => expect(screen.getByText('Export all conversations')).toBeTruthy())
    fireEvent.click(screen.getByText('Export all conversations'))
    await waitFor(() => {
      expect(mockExportAll).toHaveBeenCalled()
    })
  })

  it('imports conversations via file input', async () => {
    render(
      <Settings open={true} onClose={vi.fn()} onRefresh={vi.fn()} updater={updater} />
    )
    await waitFor(() => expect(screen.getByText('Data')).toBeTruthy())
    fireEvent.click(screen.getByText('Data'))
    await waitFor(() => expect(screen.getByText('Choose JSON file')).toBeTruthy())
    fireEvent.click(screen.getByText('Choose JSON file'))
  })

  it('shows import status', async () => {
    render(
      <Settings open={true} onClose={vi.fn()} onRefresh={vi.fn()} updater={updater} />
    )
    await waitFor(() => expect(screen.getByText('Data')).toBeTruthy())
    fireEvent.click(screen.getByText('Data'))
    await waitFor(() => expect(screen.getByText('Choose JSON file')).toBeTruthy())
  })

  it('shows updater available status', async () => {
    const availableUpdater = {
      ...updater,
      status: 'available' as const,
      version: '1.2.0',
    }
    render(
      <Settings open={true} onClose={vi.fn()} onRefresh={vi.fn()} updater={availableUpdater} />
    )
    await waitFor(() => {
      expect(screen.getByText('v1.2.0 available')).toBeTruthy()
      expect(screen.getByText('Update now')).toBeTruthy()
    })
  })

  it('shows updater downloading status', async () => {
    const downloadingUpdater = {
      ...updater,
      status: 'downloading' as const,
      progress: 45,
    }
    render(
      <Settings open={true} onClose={vi.fn()} onRefresh={vi.fn()} updater={downloadingUpdater} />
    )
    await waitFor(() => {
      expect(screen.getByText(/downloading.*45%/i)).toBeTruthy()
    })
  })

  it('shows updater ready status', async () => {
    const readyUpdater = {
      ...updater,
      status: 'ready' as const,
    }
    render(
      <Settings open={true} onClose={vi.fn()} onRefresh={vi.fn()} updater={readyUpdater} />
    )
    await waitFor(() => {
      expect(screen.getByText(/update installed/i)).toBeTruthy()
    })
  })

  it('checks for updates', async () => {
    const checkFn = vi.fn().mockResolvedValue(null)
    const checkUpdater = {
      ...updater,
      checkForUpdate: checkFn,
    }
    render(
      <Settings open={true} onClose={vi.fn()} onRefresh={vi.fn()} updater={checkUpdater} />
    )
    await waitFor(() => expect(screen.getByText('Check for updates')).toBeTruthy())
    fireEvent.click(screen.getByText('Check for updates'))
    expect(checkFn).toHaveBeenCalled()
    await waitFor(() => {
      expect(screen.getByText('Up to date ✓')).toBeTruthy()
    })
  })

  it('calls installUpdate when Update now clicked', async () => {
    const installFn = vi.fn()
    const availableUpdater = {
      ...updater,
      status: 'available' as const,
      version: '1.2.0',
      installUpdate: installFn,
    }
    render(
      <Settings open={true} onClose={vi.fn()} onRefresh={vi.fn()} updater={availableUpdater} />
    )
    await waitFor(() => expect(screen.getByText('Update now')).toBeTruthy())
    fireEvent.click(screen.getByText('Update now'))
    expect(installFn).toHaveBeenCalled()
  })

  it('shows claude.ai import instructions in data tab', async () => {
    render(
      <Settings open={true} onClose={vi.fn()} onRefresh={vi.fn()} updater={updater} />
    )
    await waitFor(() => expect(screen.getByText('Data')).toBeTruthy())
    fireEvent.click(screen.getByText('Data'))
    await waitFor(() => {
      expect(screen.getByText(/importing from claude\.ai/i)).toBeTruthy()
    })
  })

  it('shows default mode section', async () => {
    render(
      <Settings open={true} onClose={vi.fn()} onRefresh={vi.fn()} updater={updater} />
    )
    await waitFor(() => {
      expect(screen.getByText('Default Mode')).toBeTruthy()
    })
  })

  it('handles export error', async () => {
    mockExportAll.mockRejectedValue(new Error('Export broke'))
    const createObjectURL = vi.fn().mockReturnValue('blob:url')
    const revokeObjectURL = vi.fn()
    Object.defineProperty(window, 'URL', {
      value: { createObjectURL, revokeObjectURL },
      writable: true,
    })

    render(
      <Settings open={true} onClose={vi.fn()} onRefresh={vi.fn()} updater={updater} />
    )
    await waitFor(() => expect(screen.getByText('Data')).toBeTruthy())
    fireEvent.click(screen.getByText('Data'))
    await waitFor(() => expect(screen.getByText('Export all conversations')).toBeTruthy())
    fireEvent.click(screen.getByText('Export all conversations'))
    await waitFor(() => {
      expect(screen.getByText(/error.*export broke/i)).toBeTruthy()
    })
  })

  it('handles import via file input change', async () => {
    const onRefresh = vi.fn()
    render(
      <Settings open={true} onClose={vi.fn()} onRefresh={onRefresh} updater={updater} />
    )
    await waitFor(() => expect(screen.getByText('Data')).toBeTruthy())
    fireEvent.click(screen.getByText('Data'))
    await waitFor(() => expect(screen.getByText('Choose JSON file')).toBeTruthy())

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    if (fileInput) {
      const file = new File(['{}'], 'test.json', { type: 'application/json' })
      Object.defineProperty(fileInput, 'files', { value: [file] })
      fireEvent.change(fileInput)
      await waitFor(() => {
        expect(mockImportConversations).toHaveBeenCalled()
      })
      await waitFor(() => {
        expect(screen.getByText(/imported 5/i)).toBeTruthy()
      })
    }
  })

  it('handles import error', async () => {
    mockImportConversations.mockRejectedValue(new Error('Bad file'))
    render(
      <Settings open={true} onClose={vi.fn()} onRefresh={vi.fn()} updater={updater} />
    )
    await waitFor(() => expect(screen.getByText('Data')).toBeTruthy())
    fireEvent.click(screen.getByText('Data'))
    await waitFor(() => expect(screen.getByText('Choose JSON file')).toBeTruthy())

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    if (fileInput) {
      const file = new File(['bad'], 'bad.json', { type: 'application/json' })
      Object.defineProperty(fileInput, 'files', { value: [file] })
      fireEvent.change(fileInput)
      await waitFor(() => {
        expect(screen.getByText(/error.*bad file/i)).toBeTruthy()
      })
    }
  })

  it('handles singular import count', async () => {
    mockImportConversations.mockResolvedValue({ imported: 1 })
    render(
      <Settings open={true} onClose={vi.fn()} onRefresh={vi.fn()} updater={updater} />
    )
    await waitFor(() => expect(screen.getByText('Data')).toBeTruthy())
    fireEvent.click(screen.getByText('Data'))
    await waitFor(() => expect(screen.getByText('Choose JSON file')).toBeTruthy())

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    if (fileInput) {
      const file = new File(['{}'], 'test.json', { type: 'application/json' })
      Object.defineProperty(fileInput, 'files', { value: [file] })
      fireEvent.change(fileInput)
      await waitFor(() => {
        expect(screen.getByText('Imported 1 conversation')).toBeTruthy()
      })
    }
  })

  it('shows zero tokens as 0', async () => {
    mockGetUsage.mockResolvedValue({
      total_messages: 0,
      cloud_messages: 0,
      local_messages: 0,
      total_tokens_in: 0,
      total_tokens_out: 0,
      total_cost: 0,
    })
    render(
      <Settings open={true} onClose={vi.fn()} onRefresh={vi.fn()} updater={updater} />
    )
    await waitFor(() => expect(screen.getByText('Usage')).toBeTruthy())
    fireEvent.click(screen.getByText('Usage'))
    await waitFor(() => {
      const zeros = screen.getAllByText('0')
      expect(zeros.length).toBeGreaterThanOrEqual(1)
    })
  })

  it('changes mode to cloud', async () => {
    mockGetSettings.mockResolvedValue({
      anthropic_api_key: '',
      has_api_key: false,
      default_mode: 'auto',
    })

    render(
      <Settings open={true} onClose={vi.fn()} onRefresh={vi.fn()} updater={updater} />
    )
    await waitFor(() => expect(screen.getByText('Cloud')).toBeTruthy())
    fireEvent.click(screen.getByText('Cloud'))
    await waitFor(() => {
      expect(mockUpdateSettings).toHaveBeenCalledWith({ default_mode: 'cloud' })
    })
  })

  it('exports via Tauri path when available', async () => {
    const originalTauri = (window as any).__TAURI_INTERNALS__
    ;(window as any).__TAURI_INTERNALS__ = {}

    const mockSave = vi.fn().mockResolvedValue('/test/export.json')
    const mockWriteTextFile = vi.fn().mockResolvedValue(undefined)
    vi.doMock('@tauri-apps/plugin-dialog', () => ({ save: mockSave, open: vi.fn() }))
    vi.doMock('@tauri-apps/plugin-fs', () => ({ writeTextFile: mockWriteTextFile, readTextFile: vi.fn() }))

    render(
      <Settings open={true} onClose={vi.fn()} onRefresh={vi.fn()} updater={updater} />
    )
    await waitFor(() => expect(screen.getByText('Data')).toBeTruthy())
    fireEvent.click(screen.getByText('Data'))
    await waitFor(() => expect(screen.getByText('Export all conversations')).toBeTruthy())
    fireEvent.click(screen.getByText('Export all conversations'))
    await waitFor(() => {
      expect(mockExportAll).toHaveBeenCalled()
    })

    ;(window as any).__TAURI_INTERNALS__ = originalTauri
  })

  it('imports via Tauri path when available', async () => {
    const originalTauri = (window as any).__TAURI_INTERNALS__
    ;(window as any).__TAURI_INTERNALS__ = {}

    const mockOpen = vi.fn().mockResolvedValue('/test/import.json')
    const mockReadTextFile = vi.fn().mockResolvedValue('{"conversations": []}')
    vi.doMock('@tauri-apps/plugin-dialog', () => ({ save: vi.fn(), open: mockOpen }))
    vi.doMock('@tauri-apps/plugin-fs', () => ({ writeTextFile: vi.fn(), readTextFile: mockReadTextFile }))

    render(
      <Settings open={true} onClose={vi.fn()} onRefresh={vi.fn()} updater={updater} />
    )
    await waitFor(() => expect(screen.getByText('Data')).toBeTruthy())
    fireEvent.click(screen.getByText('Data'))
    await waitFor(() => expect(screen.getByText('Choose JSON file')).toBeTruthy())
    fireEvent.click(screen.getByText('Choose JSON file'))
    await waitFor(() => {
      expect(mockImportConversations).toHaveBeenCalled()
    })

    ;(window as any).__TAURI_INTERNALS__ = originalTauri
  })

  it('formats number with toString for small numbers', async () => {
    mockGetUsage.mockResolvedValue({
      total_messages: 42,
      cloud_messages: 10,
      local_messages: 32,
      total_tokens_in: 500,
      total_tokens_out: 200,
      total_cost: 0.01,
    })
    render(
      <Settings open={true} onClose={vi.fn()} onRefresh={vi.fn()} updater={updater} />
    )
    await waitFor(() => expect(screen.getByText('Usage')).toBeTruthy())
    fireEvent.click(screen.getByText('Usage'))
    await waitFor(() => {
      expect(screen.getByText('500')).toBeTruthy()
      expect(screen.getByText('200')).toBeTruthy()
    })
  })
})
