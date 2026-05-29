// Reads the `iat`/`exp` claims (epoch ms) from a JWT without verifying the signature.
// Returns null for malformed tokens or when either claim is missing/non-numeric.
export function tokenTimes(token: string): { iat: number; exp: number } | null {
  try {
    const payload = token.split('.')[1]
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'))
    const { iat, exp } = JSON.parse(json) as { iat?: number; exp?: number }
    if (typeof iat !== 'number' || typeof exp !== 'number') return null
    return { iat: iat * 1000, exp: exp * 1000 }
  } catch {
    return null
  }
}
