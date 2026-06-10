import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { PATCH_NOTES } from './patch-notes.js'

const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')) as {
  version: string
}

function semverParts(v: string): number[] {
  return v.split('.').map(Number)
}

function semverGt(a: string, b: string): boolean {
  const pa = semverParts(a)
  const pb = semverParts(b)
  for (let i = 0; i < 3; i++) {
    if (pa[i] !== pb[i]) return pa[i] > pb[i]
  }
  return false
}

describe('PATCH_NOTES', () => {
  it('has at least one entry', () => {
    expect(PATCH_NOTES.length).toBeGreaterThan(0)
  })

  it('first entry matches the package version (release checklist: bump + patch note together)', () => {
    expect(PATCH_NOTES[0].version).toBe(pkg.version)
  })

  it('versions are valid semver, unique and in descending order', () => {
    const versions = PATCH_NOTES.map((n) => n.version)
    for (const v of versions) expect(v).toMatch(/^\d+\.\d+\.\d+$/)
    expect(new Set(versions).size).toBe(versions.length)
    for (let i = 0; i < versions.length - 1; i++) {
      expect(semverGt(versions[i], versions[i + 1]), `${versions[i]} > ${versions[i + 1]}`).toBe(true)
    }
  })

  it('dates are valid ISO dates (YYYY-MM-DD) and never decrease going up', () => {
    for (const note of PATCH_NOTES) {
      expect(note.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(Number.isNaN(Date.parse(note.date))).toBe(false)
    }
    for (let i = 0; i < PATCH_NOTES.length - 1; i++) {
      expect(Date.parse(PATCH_NOTES[i].date)).toBeGreaterThanOrEqual(Date.parse(PATCH_NOTES[i + 1].date))
    }
  })

  it('every entry has a title, a summary and non-empty sections', () => {
    for (const note of PATCH_NOTES) {
      expect(note.title.trim()).not.toBe('')
      expect(note.summary.trim()).not.toBe('')
      expect(note.sections.length).toBeGreaterThan(0)
      for (const section of note.sections) {
        expect(section.heading.trim()).not.toBe('')
        expect(section.items.length).toBeGreaterThan(0)
        for (const item of section.items) expect(item.trim()).not.toBe('')
      }
    }
  })
})
