import { describe, it, expect } from 'vitest'
import { findKlxActivities, mimeForPath, mediaKey } from './archive.js'

describe('findKlxActivities', () => {
  it('finds a single activity nested under Activity/<id>/', () => {
    const paths = [
      'Board_Retro_ST_MNT_13.2/metadata.json',
      'Board_Retro_ST_MNT_13.2/Activity/29571756/data.json',
      'Board_Retro_ST_MNT_13.2/Activity/29571756/_brainstorm_data.json',
      'Board_Retro_ST_MNT_13.2/Activity/29571756/mediabundle/9bf/abc.svg',
    ]
    const activities = findKlxActivities(paths)
    expect(activities).toHaveLength(1)
    expect(activities[0].brainstormPath).toBe('Board_Retro_ST_MNT_13.2/Activity/29571756/_brainstorm_data.json')
    expect(activities[0].mediaPrefix).toBe('Board_Retro_ST_MNT_13.2/Activity/29571756/mediabundle/')
    expect(activities[0].label).toBe('29571756')
  })

  it('finds several activities bundled in the same archive independently', () => {
    const paths = [
      'Activity/1/_brainstorm_data.json',
      'Activity/1/mediabundle/aa/x.png',
      'Activity/2/_brainstorm_data.json',
      'Activity/2/mediabundle/bb/y.png',
    ]
    const activities = findKlxActivities(paths)
    expect(activities.map((a) => a.label)).toEqual(['1', '2'])
  })

  it('handles _brainstorm_data.json at the archive root', () => {
    const activities = findKlxActivities(['_brainstorm_data.json', 'mediabundle/aa/x.png'])
    expect(activities).toHaveLength(1)
    expect(activities[0].mediaPrefix).toBe('mediabundle/')
    expect(activities[0].label).toBe('Board')
  })

  it('returns an empty array when no _brainstorm_data.json is present', () => {
    expect(findKlxActivities(['metadata.json', 'Activity/1/data.json'])).toEqual([])
  })
})

describe('mimeForPath', () => {
  it('maps known extensions', () => {
    expect(mimeForPath('a/b.png')).toBe('image/png')
    expect(mimeForPath('a/b.SVG')).toBe('image/svg+xml')
    expect(mimeForPath('a/b.jpeg')).toBe('image/jpeg')
  })
  it('falls back to octet-stream for unknown extensions', () => {
    expect(mimeForPath('a/b.weird')).toBe('application/octet-stream')
  })
})

describe('mediaKey', () => {
  it('strips everything before mediabundle/', () => {
    expect(mediaKey('Board/Activity/1/mediabundle/9bf/abc.svg')).toBe('mediabundle/9bf/abc.svg')
  })
  it('returns the path unchanged when there is no mediabundle/ segment', () => {
    expect(mediaKey('foo/bar.png')).toBe('foo/bar.png')
  })
})
