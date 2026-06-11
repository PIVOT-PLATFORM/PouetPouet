import { describe, it, expect, vi, beforeEach } from 'vitest'

// Force SMTP off for all tests (reset module-level state)
vi.stubEnv('SMTP_HOST', '')

// Re-import after env stub so the module-level constant is evaluated with the stub.
const { sendVerificationEmail, sendPasswordResetEmail, isSmtpConfigured } = await import('./mailer.js')

describe('mailer (no SMTP)', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  it('isSmtpConfigured is false when SMTP_HOST is not set', () => {
    expect(isSmtpConfigured).toBe(false)
  })

  it('sendVerificationEmail returns false and logs when SMTP not configured', async () => {
    const result = await sendVerificationEmail('user@example.com', 'Alice', 'https://example.com/verify?token=abc')
    expect(result).toBe(false)
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('https://example.com/verify?token=abc'))
  })

  it('sendPasswordResetEmail returns false and logs when SMTP not configured', async () => {
    const result = await sendPasswordResetEmail('user@example.com', 'Bob', 'https://example.com/reset?token=xyz')
    expect(result).toBe(false)
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('https://example.com/reset?token=xyz'))
  })
})
