import { describe, it, expect } from 'vitest'
import { activeOrder, canSignNow, isActingRecipient } from './signdoc.workflow.js'

const S = (routingOrder: number, status: string, role = 'SIGNER') => ({ routingOrder, status, role })

describe('signdoc workflow — routage séquentiel/parallèle', () => {
  it('activeOrder = plus petit ordre non traité ; null quand tout est signé', () => {
    expect(activeOrder([S(1, 'SENT'), S(2, 'PENDING')])).toBe(1)
    expect(activeOrder([S(1, 'SIGNED'), S(2, 'PENDING')])).toBe(2)
    expect(activeOrder([S(1, 'SIGNED'), S(2, 'SIGNED')])).toBeNull()
  })

  it('ignore les destinataires CC (non bloquants)', () => {
    expect(isActingRecipient({ role: 'CC' })).toBe(false)
    expect(activeOrder([S(1, 'PENDING', 'CC'), S(2, 'PENDING', 'SIGNER')])).toBe(2)
  })

  it('séquentiel : seul le destinataire de l’étape active peut signer', () => {
    const all = [S(1, 'SENT'), S(2, 'PENDING')]
    expect(canSignNow({ ordered: true }, all[0], all)).toBe(true)
    expect(canSignNow({ ordered: true }, all[1], all)).toBe(false)
  })

  it('séquentiel : l’étape suivante s’ouvre quand la précédente a signé', () => {
    const all = [S(1, 'SIGNED'), S(2, 'SENT')]
    expect(canSignNow({ ordered: true }, all[1], all)).toBe(true)
  })

  it('parallèle : tout signataire en attente peut signer', () => {
    const all = [S(1, 'SENT'), S(1, 'SENT')]
    expect(canSignNow({ ordered: false }, all[0], all)).toBe(true)
    expect(canSignNow({ ordered: false }, all[1], all)).toBe(true)
  })

  it('un destinataire déjà signé ne peut pas re-signer', () => {
    const all = [S(1, 'SIGNED')]
    expect(canSignNow({ ordered: false }, all[0], all)).toBe(false)
  })
})
