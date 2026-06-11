import { describe, it, expect } from 'vitest'
import { FORGE_MODULES } from '@pouetpouet/shared'

describe('FORGE_MODULES manifest', () => {
  it('has at least one module', () => {
    expect(FORGE_MODULES.length).toBeGreaterThan(0)
  })

  it('all module ids are unique kebab-case strings', () => {
    const ids = FORGE_MODULES.map((m) => m.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) {
      expect(id).toMatch(/^[a-z][a-z0-9-]*$/)
    }
  })

  it('all modules have a non-empty name, icon, color and description', () => {
    for (const m of FORGE_MODULES) {
      expect(m.name.trim()).not.toBe('')
      expect(m.icon.trim()).not.toBe('')
      expect(m.color.trim()).not.toBe('')
      expect(m.description.trim()).not.toBe('')
    }
  })

  it('all nav links have non-empty href and label', () => {
    for (const m of FORGE_MODULES) {
      expect(m.nav.length).toBeGreaterThan(0)
      for (const link of m.nav) {
        expect(link.href.trim()).not.toBe('')
        expect(link.label.trim()).not.toBe('')
        expect(link.match.trim()).not.toBe('')
      }
    }
  })

  it('nav hrefs start with / and contain no spaces', () => {
    for (const m of FORGE_MODULES) {
      for (const link of m.nav) {
        expect(link.href).toMatch(/^\/\S*$/)
      }
    }
  })

  it('nav hrefs are unique across all modules', () => {
    const hrefs = FORGE_MODULES.flatMap((m) => m.nav.map((l) => l.href))
    expect(new Set(hrefs).size).toBe(hrefs.length)
  })

  it('event names follow the <module>.<entity>.<action> convention', () => {
    const pattern = /^[a-z][a-z0-9-]*\.[a-z][a-z0-9-]*\.[a-z][a-z0-9-]*$/
    for (const m of FORGE_MODULES) {
      for (const e of m.emits) {
        expect(e, `${m.id} emits "${e}"`).toMatch(pattern)
      }
      for (const e of m.listensTo) {
        expect(e, `${m.id} listensTo "${e}"`).toMatch(pattern)
      }
    }
  })

  it('every event in listensTo is emitted by exactly one other module', () => {
    const allEmitted = new Set(FORGE_MODULES.flatMap((m) => m.emits))
    for (const m of FORGE_MODULES) {
      for (const event of m.listensTo) {
        expect(allEmitted.has(event), `"${event}" listened by "${m.id}" but not emitted by any module`).toBe(true)
      }
    }
  })

  it('no module listens to its own events', () => {
    for (const m of FORGE_MODULES) {
      for (const event of m.listensTo) {
        expect(m.emits.includes(event), `"${m.id}" both emits and listens to "${event}"`).toBe(false)
      }
    }
  })

  it('ownedEntities are PascalCase and unique across all modules', () => {
    const allOwned: string[] = []
    for (const m of FORGE_MODULES) {
      for (const entity of m.ownedEntities) {
        expect(entity).toMatch(/^[A-Z][A-Za-z0-9]+$/)
        expect(allOwned.includes(entity), `"${entity}" owned by multiple modules`).toBe(false)
        allOwned.push(entity)
      }
    }
  })

  it('referencedPivots are PascalCase', () => {
    for (const m of FORGE_MODULES) {
      for (const pivot of m.referencedPivots) {
        expect(pivot).toMatch(/^[A-Z][A-Za-z0-9]+$/)
      }
    }
  })
})
