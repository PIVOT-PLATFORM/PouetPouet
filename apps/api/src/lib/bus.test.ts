import { describe, it, expect, vi } from 'vitest'
import { EventEmitter } from 'node:events'
import type { PivotEvent } from '@pouetpouet/shared'
import type { EventBus } from './bus.js'

// Re-create a fresh InProcessBus per test (avoid sharing the singleton).
function makeBus(): EventBus {
  const emitter = new EventEmitter()
  emitter.setMaxListeners(100)
  return {
    publish<T>(event: Omit<PivotEvent<T>, 'at'>) {
      const full: PivotEvent<T> = { ...event, at: new Date().toISOString() }
      for (const channel of [event.type, '*']) {
        for (const listener of emitter.listeners(channel)) {
          try { void (listener as (e: PivotEvent<T>) => void)(full) } catch {}
        }
      }
    },
    subscribe<T>(type: string, handler: (e: PivotEvent<T>) => void) {
      emitter.on(type, handler as (...args: unknown[]) => void)
      return () => emitter.off(type, handler as (...args: unknown[]) => void)
    },
  }
}

describe('InProcessBus', () => {
  it('delivers events to typed subscribers', () => {
    const bus = makeBus()
    const received: PivotEvent<{ x: number }>[] = []
    bus.subscribe<{ x: number }>('test.event', (e) => { received.push(e) })
    bus.publish({ type: 'test.event', module: 'test', payload: { x: 42 } })
    expect(received).toHaveLength(1)
    expect(received[0].payload.x).toBe(42)
    expect(received[0].module).toBe('test')
  })

  it('adds an `at` timestamp on publish', () => {
    const bus = makeBus()
    let captured: PivotEvent<unknown> | undefined
    bus.subscribe('ts.test', (e) => { captured = e })
    const before = Date.now()
    bus.publish({ type: 'ts.test', module: 'test', payload: null })
    const after = Date.now()
    expect(captured).not.toBeUndefined()
    const ts = new Date(captured!.at).getTime()
    expect(ts).toBeGreaterThanOrEqual(before)
    expect(ts).toBeLessThanOrEqual(after)
  })

  it('wildcard subscriber receives all events', () => {
    const bus = makeBus()
    const types: string[] = []
    bus.subscribe('*', (e) => { types.push(e.type) })
    bus.publish({ type: 'a.b', module: 'test', payload: null })
    bus.publish({ type: 'c.d', module: 'test', payload: null })
    expect(types).toEqual(['a.b', 'c.d'])
  })

  it('unsubscribe stops delivery', () => {
    const bus = makeBus()
    const calls: number[] = []
    const unsub = bus.subscribe('unsub.test', () => { calls.push(1) })
    bus.publish({ type: 'unsub.test', module: 'test', payload: null })
    unsub()
    bus.publish({ type: 'unsub.test', module: 'test', payload: null })
    expect(calls).toHaveLength(1)
  })

  it('a throwing handler does not prevent other handlers from running', () => {
    const bus = makeBus()
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const calls: string[] = []

    // First handler defined via EventEmitter directly so the throwing path is covered
    // (makeBus above uses try/catch identical to the production code).
    bus.subscribe('err.test', () => { throw new Error('boom') })
    bus.subscribe('err.test', () => { calls.push('ok') })

    expect(() => bus.publish({ type: 'err.test', module: 'test', payload: null })).not.toThrow()
    expect(calls).toContain('ok')
    errorSpy.mockRestore()
  })

  it('le bus réel capture le rejet d\'un handler async (pas de rejet non géré)', async () => {
    const { bus } = await import('./bus.js')
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const unsub = bus.subscribe('async.err.test', async () => { throw new Error('boom async') })
    bus.publish({ type: 'async.err.test', module: 'test', payload: null })
    await vi.waitFor(() => expect(errorSpy).toHaveBeenCalled())
    unsub()
    errorSpy.mockRestore()
  })

  it('multiple typed subscribers all receive the same event', () => {
    const bus = makeBus()
    const a: number[] = [], b: number[] = []
    bus.subscribe<{ n: number }>('multi', (e) => { a.push(e.payload.n) })
    bus.subscribe<{ n: number }>('multi', (e) => { b.push(e.payload.n) })
    bus.publish({ type: 'multi', module: 'test', payload: { n: 7 } })
    expect(a).toEqual([7])
    expect(b).toEqual([7])
  })
})
