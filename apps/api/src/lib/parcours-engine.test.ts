import { describe, it, expect, vi, afterEach } from 'vitest'
import { evalCondition, interpolate, resolveNextStep, executeHttpStep } from './parcours-engine.js'
import type { ModuleStepDef, FlowEdgeDef } from './parcours-engine.js'

afterEach(() => {
  vi.unstubAllGlobals()
})

// ── evalCondition ────────────────────────────────────────────────────────────

describe('evalCondition', () => {
  it('eq : correspond', () => {
    expect(evalCondition({ field: 'status', operator: 'eq', value: 'done' }, { status: 'done' })).toBe(true)
  })

  it('eq : ne correspond pas', () => {
    expect(evalCondition({ field: 'status', operator: 'eq', value: 'done' }, { status: 'pending' })).toBe(false)
  })

  it('neq : correspond (valeur différente)', () => {
    expect(evalCondition({ field: 'status', operator: 'neq', value: 'done' }, { status: 'pending' })).toBe(true)
  })

  it('neq : ne correspond pas (même valeur)', () => {
    expect(evalCondition({ field: 'status', operator: 'neq', value: 'done' }, { status: 'done' })).toBe(false)
  })

  it('contains : substring présent', () => {
    expect(evalCondition({ field: 'msg', operator: 'contains', value: 'hello' }, { msg: 'say hello world' })).toBe(true)
  })

  it('contains : substring absent', () => {
    expect(evalCondition({ field: 'msg', operator: 'contains', value: 'bye' }, { msg: 'say hello world' })).toBe(false)
  })

  it('champ absent traité comme chaîne vide', () => {
    expect(evalCondition({ field: 'missing', operator: 'eq', value: '' }, {})).toBe(true)
    expect(evalCondition({ field: 'missing', operator: 'eq', value: 'something' }, {})).toBe(false)
  })

  it('gt / lt / gte / lte sur valeurs numériques réelles', () => {
    expect(evalCondition({ field: 'm', operator: 'gt', value: '100' }, { m: '150' })).toBe(true)
    expect(evalCondition({ field: 'm', operator: 'lt', value: '100' }, { m: '150' })).toBe(false)
    expect(evalCondition({ field: 'm', operator: 'gte', value: '100' }, { m: '100' })).toBe(true)
    expect(evalCondition({ field: 'm', operator: 'lte', value: '100' }, { m: '100' })).toBe(true)
  })

  // Régression (code review) : Number('') === 0 coerçait une réponse vide en 0,
  // ce qui satisfaisait à tort les comparaisons numériques (ex : montant vide < 100).
  it('champ vide n\'est PAS coercé en 0 pour les comparaisons numériques', () => {
    expect(evalCondition({ field: 'montant', operator: 'lt', value: '100' }, { montant: '' })).toBe(false)
    expect(evalCondition({ field: 'montant', operator: 'gt', value: '-1' }, { montant: '' })).toBe(false)
  })

  it('champ absent n\'est PAS coercé en 0 pour les comparaisons numériques', () => {
    expect(evalCondition({ field: 'montant', operator: 'lt', value: '100' }, {})).toBe(false)
  })
})

// ── interpolate ──────────────────────────────────────────────────────────────

describe('interpolate', () => {
  it('substitution simple', () => {
    expect(interpolate('Hello {{name}}', { name: 'world' })).toBe('Hello world')
  })

  it('substitutions multiples', () => {
    expect(interpolate('{{a}} + {{b}} = {{c}}', { a: '1', b: '2', c: '3' })).toBe('1 + 2 = 3')
  })

  it('variable absente → chaîne vide', () => {
    expect(interpolate('{{missing}}', {})).toBe('')
  })

  it('pas de balise → chaîne inchangée', () => {
    expect(interpolate('no template here', { foo: 'bar' })).toBe('no template here')
  })
})

// ── resolveNextStep ───────────────────────────────────────────────────────────

const mkSteps = (n: number): ModuleStepDef[] => Array.from({ length: n }, () => ({}))

describe('resolveNextStep — sans arêtes (comportement linéaire)', () => {
  it('avance à currentIdx+1', () => {
    const steps = mkSteps(3)
    const statuses = new Map([[0, 'COMPLETED'], [1, 'PENDING'], [2, 'PENDING']])
    expect(resolveNextStep(0, steps, [], statuses, {})).toBe(1)
  })

  it('saute les étapes COMPLETED', () => {
    const steps = mkSteps(3)
    const statuses = new Map([[0, 'COMPLETED'], [1, 'COMPLETED'], [2, 'PENDING']])
    expect(resolveNextStep(0, steps, [], statuses, {})).toBe(2)
  })

  it('saute les étapes SKIPPED', () => {
    const steps = mkSteps(3)
    const statuses = new Map([[0, 'COMPLETED'], [1, 'SKIPPED'], [2, 'PENDING']])
    expect(resolveNextStep(0, steps, [], statuses, {})).toBe(2)
  })

  it('retourne steps.length quand tout est terminé', () => {
    const steps = mkSteps(2)
    const statuses = new Map([[0, 'COMPLETED'], [1, 'COMPLETED']])
    expect(resolveNextStep(1, steps, [], statuses, {})).toBe(2)
  })
})

describe('resolveNextStep — avec arêtes', () => {
  it('arête inconditionnelle : va directement vers target', () => {
    const steps = mkSteps(3)
    const statuses = new Map([[0, 'COMPLETED'], [1, 'PENDING'], [2, 'PENDING']])
    const edges: FlowEdgeDef[] = [{ id: 'e1', source: '0', target: '2' }]
    expect(resolveNextStep(0, steps, edges, statuses, {})).toBe(2)
  })

  it('arête conditionnelle qui correspond : prend l\'arête', () => {
    const steps = mkSteps(3)
    const statuses = new Map([[0, 'COMPLETED'], [1, 'PENDING'], [2, 'PENDING']])
    const edges: FlowEdgeDef[] = [
      { id: 'e1', source: '0', target: '2', condition: { field: 'branch', operator: 'eq', value: 'fast' } },
    ]
    expect(resolveNextStep(0, steps, edges, statuses, { branch: 'fast' })).toBe(2)
  })

  it('arête conditionnelle qui ne correspond pas + arête inconditionnelle de fallback : prend le fallback', () => {
    const steps = mkSteps(3)
    const statuses = new Map([[0, 'COMPLETED'], [1, 'PENDING'], [2, 'PENDING']])
    const edges: FlowEdgeDef[] = [
      { id: 'e1', source: '0', target: '2', condition: { field: 'branch', operator: 'eq', value: 'fast' } },
      { id: 'e2', source: '0', target: '1' },
    ]
    expect(resolveNextStep(0, steps, edges, statuses, { branch: 'slow' })).toBe(1)
  })

  it('arête conditionnelle qui ne correspond pas sans fallback : retourne steps.length', () => {
    const steps = mkSteps(3)
    const statuses = new Map([[0, 'COMPLETED'], [1, 'PENDING'], [2, 'PENDING']])
    const edges: FlowEdgeDef[] = [
      { id: 'e1', source: '0', target: '2', condition: { field: 'branch', operator: 'eq', value: 'fast' } },
    ]
    expect(resolveNextStep(0, steps, edges, statuses, { branch: 'slow' })).toBe(3)
  })

  // Régression (code review) : parseInt('end') === NaN était écrit tel quel dans
  // currentStep → PrismaClientValidationError. Une cible non numérique (nœud
  // « End » du canvas FlowBuilder) doit signifier « fin de workflow » = steps.length.
  it('arête inconditionnelle vers le nœud "end" → steps.length (fin de workflow)', () => {
    const steps = mkSteps(3)
    const statuses = new Map([[0, 'COMPLETED'], [1, 'PENDING'], [2, 'PENDING']])
    const edges: FlowEdgeDef[] = [{ id: 'e1', source: '0', target: 'end' }]
    expect(resolveNextStep(0, steps, edges, statuses, {})).toBe(3)
  })

  it('arête conditionnelle vers "end" qui correspond → steps.length', () => {
    const steps = mkSteps(3)
    const statuses = new Map([[0, 'COMPLETED'], [1, 'PENDING'], [2, 'PENDING']])
    const edges: FlowEdgeDef[] = [
      { id: 'e1', source: '0', target: 'end', condition: { field: 'done', operator: 'eq', value: 'yes' } },
    ]
    expect(resolveNextStep(0, steps, edges, statuses, { done: 'yes' })).toBe(3)
  })
})

// ── executeHttpStep ───────────────────────────────────────────────────────────

describe('executeHttpStep', () => {
  it('URL vide → { outputKey: null, output: null }', async () => {
    const result = await executeHttpStep({ httpUrl: '' }, {})
    expect(result).toEqual({ outputKey: null, output: null })
  })

  it('URL vide après interpolation → { outputKey: null, output: null }', async () => {
    const result = await executeHttpStep({ httpUrl: '{{missing}}' }, {})
    expect(result).toEqual({ outputKey: null, output: null })
  })

  it('appel GET réussi → output parsé comme JSON', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ result: 'ok' }),
      text: async () => '',
    })
    vi.stubGlobal('fetch', mockFetch)

    const result = await executeHttpStep({ httpUrl: 'https://example.com/api', httpMethod: 'GET' }, {})
    expect(result.output).toEqual({ result: 'ok' })
    expect(result.outputKey).toBeNull()
    expect(mockFetch).toHaveBeenCalledWith('https://example.com/api', expect.objectContaining({ method: 'GET' }))
  })

  it('appel POST avec body interpolé → body envoyé correctement', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: '42' }),
      text: async () => '',
    })
    vi.stubGlobal('fetch', mockFetch)

    await executeHttpStep(
      { httpUrl: 'https://example.com/api', httpMethod: 'POST', httpBody: '{"name":"{{title}}"}' },
      { title: 'Test' },
    )

    const callArgs = mockFetch.mock.calls[0]
    expect(callArgs[1].body).toBe('{"name":"Test"}')
    expect(callArgs[1].method).toBe('POST')
  })

  it('outputKey propagé dans le résultat', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: '42' }),
      text: async () => '',
    })
    vi.stubGlobal('fetch', mockFetch)

    const result = await executeHttpStep(
      { httpUrl: 'https://example.com/api', httpOutputKey: 'myResult' },
      {},
    )
    expect(result.outputKey).toBe('myResult')
    expect(result.output).toEqual({ id: '42' })
  })
})
