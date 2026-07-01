import { describe, it, expect } from 'vitest'
import {
  initApprovalChain,
  currentApprover,
  canDecide,
  recordDecision,
} from './approval-chain.js'

describe('initApprovalChain', () => {
  it('retourne un état initial avec index 0 et approvals vide', () => {
    const data = initApprovalChain()
    expect(data.currentApproverIndex).toBe(0)
    expect(data.approvals).toEqual([])
  })
})

describe('currentApprover', () => {
  it('retourne le premier approbateur quand index=0', () => {
    const data = initApprovalChain()
    expect(currentApprover(['alice', 'bob'], data)).toBe('alice')
  })

  it('retourne null si index hors du tableau', () => {
    const data = { approvals: [], currentApproverIndex: 5 }
    expect(currentApprover(['alice', 'bob'], data)).toBeNull()
  })

  it('retourne null pour une liste vide', () => {
    const data = initApprovalChain()
    expect(currentApprover([], data)).toBeNull()
  })
})

describe('canDecide', () => {
  it('retourne true pour l\'approbateur courant', () => {
    const data = initApprovalChain()
    expect(canDecide('alice', ['alice', 'bob'], data)).toBe(true)
  })

  it('retourne false pour un autre utilisateur', () => {
    const data = initApprovalChain()
    expect(canDecide('bob', ['alice', 'bob'], data)).toBe(false)
  })

  it('retourne false pour un utilisateur absent de la liste', () => {
    const data = initApprovalChain()
    expect(canDecide('charlie', ['alice', 'bob'], data)).toBe(false)
  })
})

describe('recordDecision — rejet', () => {
  it('rejet → résolu:rejected peu importe requireAll=true', () => {
    const data = initApprovalChain()
    const decision = { userId: 'alice', decision: 'rejected' as const, at: '2026-01-01T00:00:00.000Z' }
    const result = recordDecision(['alice', 'bob'], data, decision, true)
    expect(result.resolved).toBe(true)
    expect(result.outcome).toBe('rejected')
    expect(result.next.approvals).toHaveLength(1)
  })

  it('rejet → résolu:rejected même avec requireAll=false', () => {
    const data = initApprovalChain()
    const decision = { userId: 'alice', decision: 'rejected' as const, at: '2026-01-01T00:00:00.000Z' }
    const result = recordDecision(['alice', 'bob'], data, decision, false)
    expect(result.resolved).toBe(true)
    expect(result.outcome).toBe('rejected')
  })

  it('le rejet ne fait pas avancer l\'index', () => {
    const data = initApprovalChain()
    const decision = { userId: 'alice', decision: 'rejected' as const, at: '2026-01-01T00:00:00.000Z' }
    const result = recordDecision(['alice', 'bob'], data, decision, true)
    expect(result.next.currentApproverIndex).toBe(0)
  })
})

describe('recordDecision — approbation requireAll=false', () => {
  it('premier approbateur positif suffit → résolu:approved', () => {
    const data = initApprovalChain()
    const decision = { userId: 'alice', decision: 'approved' as const, at: '2026-01-01T00:00:00.000Z' }
    const result = recordDecision(['alice', 'bob', 'charlie'], data, decision, false)
    expect(result.resolved).toBe(true)
    expect(result.outcome).toBe('approved')
  })
})

describe('recordDecision — approbation requireAll=true avec 1 approbateur', () => {
  it('seul approbateur → résolu:approved', () => {
    const data = initApprovalChain()
    const decision = { userId: 'alice', decision: 'approved' as const, at: '2026-01-01T00:00:00.000Z' }
    const result = recordDecision(['alice'], data, decision, true)
    expect(result.resolved).toBe(true)
    expect(result.outcome).toBe('approved')
    expect(result.next.currentApproverIndex).toBe(1)
  })
})

describe('recordDecision — approbation requireAll=true avec 3 approbateurs', () => {
  it('progression : pending → pending → approved', () => {
    const approvers = ['alice', 'bob', 'charlie']
    let data = initApprovalChain()

    // alice approuve
    const r1 = recordDecision(approvers, data, { userId: 'alice', decision: 'approved', at: '2026-01-01T00:00:00.000Z' }, true)
    expect(r1.resolved).toBe(false)
    expect(r1.outcome).toBe('pending')
    expect(r1.next.currentApproverIndex).toBe(1)
    data = r1.next

    // bob approuve
    const r2 = recordDecision(approvers, data, { userId: 'bob', decision: 'approved', at: '2026-01-01T00:00:00.000Z' }, true)
    expect(r2.resolved).toBe(false)
    expect(r2.outcome).toBe('pending')
    expect(r2.next.currentApproverIndex).toBe(2)
    data = r2.next

    // charlie approuve
    const r3 = recordDecision(approvers, data, { userId: 'charlie', decision: 'approved', at: '2026-01-01T00:00:00.000Z' }, true)
    expect(r3.resolved).toBe(true)
    expect(r3.outcome).toBe('approved')
    expect(r3.next.currentApproverIndex).toBe(3)
    expect(r3.next.approvals).toHaveLength(3)
  })
})
