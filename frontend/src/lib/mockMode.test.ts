import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('IS_MOCK', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('is false when VITE_MOCK_MODE is not set', async () => {
    vi.stubEnv('VITE_MOCK_MODE', '')
    const { IS_MOCK } = await import('./mockMode')
    expect(IS_MOCK).toBe(false)
  })

  it('is true when VITE_MOCK_MODE is "true"', async () => {
    vi.stubEnv('VITE_MOCK_MODE', 'true')
    const { IS_MOCK } = await import('./mockMode')
    expect(IS_MOCK).toBe(true)
  })

  it('is false when VITE_MOCK_MODE is "false"', async () => {
    vi.stubEnv('VITE_MOCK_MODE', 'false')
    const { IS_MOCK } = await import('./mockMode')
    expect(IS_MOCK).toBe(false)
  })
})
