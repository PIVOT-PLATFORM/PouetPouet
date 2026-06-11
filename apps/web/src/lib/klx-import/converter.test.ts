import { describe, it, expect } from 'vitest'
import { convertKlaxoon } from './converter.js'

// Minimal Klaxoon data factory helpers
function makeIdea(overrides: Record<string, unknown> = {}) {
  return {
    uuid: 'idea-1',
    is_active: true,
    color: { id: 'col-1' },
    content_html: '<p>Hello</p>',
    coords: { left: 100, top: 200 },
    z_index: 0,
    is_locked: false,
    ...overrides,
  }
}

function makeTextItem(overrides: Record<string, unknown> = {}) {
  return {
    uuid: 'text-1',
    is_active: true,
    board_object_type: 'text',
    text: 'Title',
    coords: { left: 50, top: 60 },
    z_index: 1,
    is_locked: false,
    content_width: 200,
    scale: { scale_x: 1 },
    ...overrides,
  }
}

const SAMPLE_COLOR = { id: 'col-1', hexa: '#FF0000' }

describe('convertKlaxoon', () => {
  it('converts a single postit to a TEXT card', () => {
    const data = {
      colors: [SAMPLE_COLOR],
      ideas: [makeIdea()],
      state: [],
      links: [],
      groups: [],
    }
    const { cards, stats } = convertKlaxoon(data)
    expect(cards).toHaveLength(1)
    expect(cards[0].type).toBe('TEXT')
    expect(cards[0].content).toBe('Hello')
    expect(cards[0].color).toBe('#FF0000')
    expect(stats.postits).toBe(1)
  })

  it('strips HTML tags from idea content', () => {
    const data = {
      colors: [],
      ideas: [makeIdea({ content_html: '<b>Bold</b><br/>Line2', color: null })],
      state: [],
      links: [],
      groups: [],
    }
    const { cards } = convertKlaxoon(data)
    expect(cards[0].content).toBe('Bold\nLine2')
  })

  it('skips inactive ideas', () => {
    const data = {
      colors: [],
      ideas: [makeIdea({ is_active: false })],
      state: [],
      links: [],
      groups: [],
    }
    const { cards, stats } = convertKlaxoon(data)
    expect(cards).toHaveLength(0)
    expect(stats.skipped).toBe(1)
  })

  it('converts a text state item to a LABEL card', () => {
    const data = {
      colors: [],
      ideas: [],
      state: [makeTextItem()],
      links: [],
      groups: [],
    }
    const { cards, stats } = convertKlaxoon(data)
    expect(cards).toHaveLength(1)
    expect(cards[0].type).toBe('LABEL')
    const parsed = JSON.parse(cards[0].content)
    expect(parsed.text).toBe('Title')
    expect(stats.texts).toBe(1)
  })

  it('applies global offset so top-left is near (40, 40)', () => {
    const data = {
      colors: [],
      ideas: [
        makeIdea({ uuid: 'a', coords: { left: 500, top: 300 } }),
        makeIdea({ uuid: 'b', coords: { left: 700, top: 300 } }),
      ],
      state: [],
      links: [],
      groups: [],
    }
    const { cards } = convertKlaxoon(data)
    // min left = 500, offset = 500-40 = 460 → card a.posX = 500-460 = 40
    expect(cards[0].posX).toBe(40)
    expect(cards[0].posY).toBe(40)
    // card b.posX = 700-460 = 240
    expect(cards[1].posX).toBe(240)
  })

  it('assigns groupKey from data.groups; already-grouped cards are excluded from other groups', () => {
    // card-b is in both grp-1 and grp-2; first group wins (first-wins).
    // grp-2 only has card-c and card-d as ungrouped members → still 2, so it materializes.
    const data = {
      colors: [],
      ideas: [
        makeIdea({ uuid: 'card-a' }),
        makeIdea({ uuid: 'card-b' }),
        makeIdea({ uuid: 'card-c' }),
        makeIdea({ uuid: 'card-d' }),
      ],
      state: [],
      links: [],
      groups: [
        { uuid: 'grp-1', object_ids: ['card-a', 'card-b'] },
        { uuid: 'grp-2', object_ids: ['card-b', 'card-c', 'card-d'] },
      ],
    }
    const { cards, stats } = convertKlaxoon(data)
    const a = cards.find((c) => c.klxId === 'card-a')
    const b = cards.find((c) => c.klxId === 'card-b')
    const c = cards.find((c) => c.klxId === 'card-c')
    const d = cards.find((c) => c.klxId === 'card-d')
    expect(a?.groupKey).toBe('grp-1')
    expect(b?.groupKey).toBe('grp-1') // first group wins; b excluded from grp-2
    expect(c?.groupKey).toBe('grp-2') // grp-2 has c+d as ungrouped members
    expect(d?.groupKey).toBe('grp-2')
    expect(stats.groups).toBe(2)
  })

  it('ignores groups with fewer than 2 imported members', () => {
    const data = {
      colors: [],
      ideas: [makeIdea({ uuid: 'solo' })],
      state: [],
      links: [],
      groups: [{ uuid: 'lone-group', object_ids: ['solo', 'missing-card'] }],
    }
    const { cards, stats } = convertKlaxoon(data)
    // only 1 card imported, so group is skipped
    expect(cards[0].groupKey).toBeNull()
    expect(stats.groups).toBe(0)
  })

  it('converts a link between two ideas to a connection', () => {
    const data = {
      colors: [],
      ideas: [makeIdea({ uuid: 'from' }), makeIdea({ uuid: 'to' })],
      state: [],
      links: [
        {
          uuid: 'link-1',
          is_active: true,
          object_ids: ['from', 'to'],
          link_shape: 'curve',
          shapes: ['a', null],
          color: null,
          stroke_width: 4,
          stroke_style: 'solid',
        },
      ],
      groups: [],
    }
    const { connections, stats } = convertKlaxoon(data)
    expect(connections).toHaveLength(1)
    expect(connections[0].fromKlxId).toBe('from')
    expect(connections[0].toKlxId).toBe('to')
    expect(connections[0].shape).toBe('curved')
    expect(connections[0].arrow).toBe('start')
    expect(stats.links).toBe(1)
  })

  it('arrow = both when both shapes are "a"', () => {
    const data = {
      colors: [],
      ideas: [makeIdea({ uuid: 'x' }), makeIdea({ uuid: 'y' })],
      state: [],
      links: [
        { uuid: 'l', is_active: true, object_ids: ['x', 'y'], link_shape: 'straight', shapes: ['a', 'a'], color: null, stroke_width: 2, stroke_style: 'solid' },
      ],
      groups: [],
    }
    const { connections } = convertKlaxoon(data)
    expect(connections[0].arrow).toBe('both')
    expect(connections[0].shape).toBe('straight')
  })

  it('arrow = none when neither shape is "a"', () => {
    const data = {
      colors: [],
      ideas: [makeIdea({ uuid: 'p' }), makeIdea({ uuid: 'q' })],
      state: [],
      links: [
        { uuid: 'l2', is_active: true, object_ids: ['p', 'q'], link_shape: 'orthogonal', shapes: [null, null], color: null, stroke_width: 2, stroke_style: 'solid' },
      ],
      groups: [],
    }
    const { connections } = convertKlaxoon(data)
    expect(connections[0].arrow).toBe('none')
    expect(connections[0].dashed).toBe(false)
  })

  it('dashed link is parsed correctly', () => {
    const data = {
      colors: [],
      ideas: [makeIdea({ uuid: 'm' }), makeIdea({ uuid: 'n' })],
      state: [],
      links: [
        { uuid: 'l3', is_active: true, object_ids: ['m', 'n'], link_shape: 'curve', shapes: [null, null], color: null, stroke_width: 2, stroke_style: 'dashed' },
      ],
      groups: [],
    }
    const { connections } = convertKlaxoon(data)
    expect(connections[0].dashed).toBe(true)
  })

  it('sorts cards by z_index ascending', () => {
    const data = {
      colors: [],
      ideas: [
        makeIdea({ uuid: 'high', z_index: 10 }),
        makeIdea({ uuid: 'low', z_index: 1 }),
      ],
      state: [],
      links: [],
      groups: [],
    }
    const { cards } = convertKlaxoon(data)
    expect(cards[0].klxId).toBe('low')
    expect(cards[1].klxId).toBe('high')
  })

  it('skips inactive links', () => {
    const data = {
      colors: [],
      ideas: [makeIdea({ uuid: 'a' }), makeIdea({ uuid: 'b' })],
      state: [],
      links: [
        { uuid: 'l', is_active: false, object_ids: ['a', 'b'], link_shape: 'curve', shapes: [], color: null, stroke_width: 2, stroke_style: 'solid' },
      ],
      groups: [],
    }
    const { connections, stats } = convertKlaxoon(data)
    expect(connections).toHaveLength(0)
    expect(stats.skipped).toBe(1)
  })

  it('handles empty data gracefully', () => {
    const { cards, connections, stats } = convertKlaxoon({})
    expect(cards).toHaveLength(0)
    expect(connections).toHaveLength(0)
    expect(stats.postits).toBe(0)
    expect(stats.skipped).toBe(0)
  })

  it('debug mode populates unknownTypes', () => {
    const data = {
      colors: [],
      ideas: [],
      state: [{ uuid: 'x', is_active: true, board_object_type: 'mysterytype', z_index: 0 }],
      links: [],
      groups: [],
    }
    const result = convertKlaxoon(data, undefined, true)
    expect(result.unknownTypes).toBeDefined()
    expect('mysterytype' in result.unknownTypes!).toBe(true)
    expect(result.stats.skipped).toBe(1)
  })
})
