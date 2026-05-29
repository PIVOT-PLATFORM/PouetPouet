import { describe, it, expect } from 'vitest'
import { tokenTimes } from './jwt'

// Builds a JWT-shaped string with the given payload (unsigned — tokenTimes never verifies).
function makeToken(payload: Record<string, unknown>): string {
  const b64 = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return `eyJhbGciOiJIUzI1NiJ9.${b64}.signature`
}

describe('tokenTimes', () => {
  it('returns iat/exp converted from seconds to milliseconds', () => {
    const iat = 1_700_000_000
    const exp = iat + 1800
    expect(tokenTimes(makeToken({ iat, exp }))).toEqual({
      iat: iat * 1000,
      exp: exp * 1000,
    })
  })

  it('ignores extra claims and reads only iat/exp', () => {
    const token = makeToken({ id: 'abc', email: 'a@b.c', iat: 100, exp: 200 })
    expect(tokenTimes(token)).toEqual({ iat: 100_000, exp: 200_000 })
  })

  it('returns null when exp is missing', () => {
    expect(tokenTimes(makeToken({ iat: 100 }))).toBeNull()
  })

  it('returns null when iat is missing', () => {
    expect(tokenTimes(makeToken({ exp: 200 }))).toBeNull()
  })

  it('returns null when claims are non-numeric', () => {
    expect(tokenTimes(makeToken({ iat: '100', exp: '200' }))).toBeNull()
  })

  it('returns null for a malformed token (no payload segment)', () => {
    expect(tokenTimes('not-a-jwt')).toBeNull()
  })

  it('returns null for an empty string', () => {
    expect(tokenTimes('')).toBeNull()
  })

  it('returns null when the payload is not valid base64/JSON', () => {
    expect(tokenTimes('header.!!!notbase64!!!.sig')).toBeNull()
  })
})
