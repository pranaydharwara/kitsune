import { describe, it, expect } from 'vitest'

describe('API module', () => {
  it('should be importable', async () => {
    const api = await import('./api')
    expect(api).toBeDefined()
  })
})
