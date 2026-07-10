import { describe, it, expect } from 'vitest'
import { isPrivateIP } from './og-fetch.js'

// Régression (audit sécurité) : fetchOgMeta() fait fetcher n'importe quelle URL
// soumise dans une carte LINK/TEXT par le serveur. Sans ce filtre, un utilisateur
// peut sonder le réseau interne (dont le metadata server cloud 169.254.169.254).
describe('isPrivateIP — anti-SSRF', () => {
  it('IPv4 privées/loopback/link-local → bloquées', () => {
    expect(isPrivateIP('10.0.0.1')).toBe(true)
    expect(isPrivateIP('172.16.0.1')).toBe(true)
    expect(isPrivateIP('172.31.255.255')).toBe(true)
    expect(isPrivateIP('192.168.1.1')).toBe(true)
    expect(isPrivateIP('127.0.0.1')).toBe(true)
    expect(isPrivateIP('169.254.169.254')).toBe(true) // metadata server GCP/AWS
    expect(isPrivateIP('100.64.0.1')).toBe(true) // CGNAT
    expect(isPrivateIP('0.0.0.0')).toBe(true)
    expect(isPrivateIP('224.0.0.1')).toBe(true) // multicast
  })

  it('IPv4 publiques → autorisées', () => {
    expect(isPrivateIP('8.8.8.8')).toBe(false)
    expect(isPrivateIP('1.1.1.1')).toBe(false)
    expect(isPrivateIP('172.15.255.255')).toBe(false) // juste avant 172.16/12
    expect(isPrivateIP('172.32.0.0')).toBe(false) // juste après 172.31/12
  })

  it('IPv6 privées/loopback/link-local → bloquées', () => {
    expect(isPrivateIP('::1')).toBe(true)
    expect(isPrivateIP('::')).toBe(true)
    expect(isPrivateIP('fe80::1')).toBe(true) // link-local
    expect(isPrivateIP('fc00::1')).toBe(true) // unique local
    expect(isPrivateIP('fd12:3456::1')).toBe(true)
  })

  it('IPv4 privée déguisée en IPv6 (mapped / NAT64) → bloquée', () => {
    expect(isPrivateIP('::ffff:127.0.0.1')).toBe(true)
    expect(isPrivateIP('::ffff:10.0.0.1')).toBe(true)
    expect(isPrivateIP('64:ff9b::169.254.169.254')).toBe(true)
  })

  it('IPv6 publique → autorisée', () => {
    expect(isPrivateIP('2001:4860:4860::8888')).toBe(false) // Google DNS
  })

  it('entrée non-IP → bloquée par prudence', () => {
    expect(isPrivateIP('not-an-ip')).toBe(true)
    expect(isPrivateIP('')).toBe(true)
  })
})
