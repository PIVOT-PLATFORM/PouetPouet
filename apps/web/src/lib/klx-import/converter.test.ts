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

  // ── Tailles des postits par scale (géométrie Klaxoon 192px × scale) ─────────

  it('sizes a postit from its Klaxoon scale, not its text length', () => {
    const data = {
      colors: [],
      ideas: [
        makeIdea({ uuid: 'small', scale: { scale_x: 0.5, scale_y: 0.5 } }),
        makeIdea({ uuid: 'big', scale: { scale_x: 3, scale_y: 3 } }),
      ],
      state: [], links: [], groups: [],
    }
    const { cards } = convertKlaxoon(data)
    const small = cards.find((c) => c.klxId === 'small')!
    const big = cards.find((c) => c.klxId === 'big')!
    expect(small.width).toBe(96)  // 192 × 0.5
    expect(big.width).toBe(576)   // 192 × 3
  })

  it('square format keeps height = width; auto follows the content (capped ×3)', () => {
    const longText = 'x'.repeat(2000)
    const data = {
      colors: [],
      ideas: [
        makeIdea({ uuid: 'sq', format: 'square', content_html: `<p>${longText}</p>` }),
        makeIdea({ uuid: 'auto', format: 'auto', content_html: `<p>${longText}</p>` }),
        makeIdea({ uuid: 'short', format: 'auto', content_html: '<p>ok</p>' }),
      ],
      state: [], links: [], groups: [],
    }
    const { cards } = convertKlaxoon(data)
    const sq = cards.find((c) => c.klxId === 'sq')!
    const auto = cards.find((c) => c.klxId === 'auto')!
    const short = cards.find((c) => c.klxId === 'short')!
    expect(sq.height).toBe(sq.width)
    expect(auto.height).toBeGreaterThan(auto.width)
    expect(auto.height).toBeLessThanOrEqual(auto.width * 3)
    expect(short.height).toBeLessThan(short.width) // auto court → rectangle plat, pas un carré
  })

  it('auto postit height = base content height × scale (Klaxoon wraps before scaling)', () => {
    // 37 caractères → 2 lignes à la largeur de base (21 chars/ligne)
    // hauteur = (40 + 2×23) × 2.51 = 216
    const data = {
      colors: [],
      ideas: [makeIdea({
        format: 'auto',
        content_html: '<p>Situation backup PO / Appui PO / inno</p>',
        scale: { scale_x: 2.51, scale_y: 2.51 },
      })],
      state: [], links: [], groups: [],
    }
    const { cards } = convertKlaxoon(data)
    expect(cards[0].width).toBe(482) // 192 × 2.51
    expect(cards[0].height).toBe(216)
  })

  it('anchors a shape drawn bottom-right → top-left at coords + local bbox min', () => {
    // Rectangle dessiné à rebours : path local x -100..0, y -50..0,
    // coords = coin bas-droit → coin haut-gauche board = coords + min local.
    const path = JSON.stringify([
      { type: 2, x: 0, y: 0 }, { type: 16, x: -100, y: 0 },
      { type: 16, x: -100, y: -50 }, { type: 16, x: 0, y: -50 },
      { type: 16, x: 0, y: 0 }, { type: 1 },
    ])
    const data = {
      colors: [], ideas: [],
      state: [{
        uuid: 'reverse-rect', is_active: true, board_object_type: 'pen',
        path_commands: path, coords: { left: 500, top: 800 }, stroke_width: 4, z_index: 0,
      }],
      links: [], groups: [],
    }
    const { cards } = convertKlaxoon(data)
    expect(cards[0].type).toBe('SHAPE')
    // offset global : minX board = 500-100 = 400… le scan n'inspecte que coords
    // (500), donc ox = 460 → posX = (500-100) - 460 = -60 + … vérifions la
    // position RELATIVE plutôt : largeur/hauteur exactes et pas à coords brut.
    expect(cards[0].width).toBe(100)
    expect(cards[0].height).toBe(50)
    // posX = coords.left + rect.x - ox = 500 - 100 - (500-40) = -60
    expect(cards[0].posX).toBe(-60)
    // posY = coords.top + rect.y - oy = 800 - 50 - (800-40) = -10
    expect(cards[0].posY).toBe(-10)
  })

  it('converts an IMAGE postit to an IMAGE card via the mediabundle', () => {
    const imageMap = new Map([['mediabundle/e3/pic.png', 'data:image/png;base64,AAA']])
    const data = {
      colors: [],
      ideas: [makeIdea({
        uuid: 'img-idea',
        type: { type: 'IMAGE' },
        image: { path: 'mediabundle/e3/pic.png', width: 400, height: 200 },
        scale: { scale_x: 1, scale_y: 1 },
      })],
      state: [], links: [], groups: [],
    }
    const { cards, stats } = convertKlaxoon(data, imageMap)
    expect(cards).toHaveLength(1)
    expect(cards[0].type).toBe('IMAGE')
    expect(cards[0].content).toBe('data:image/png;base64,AAA')
    expect(cards[0].width).toBe(192)
    expect(cards[0].height).toBe(96) // ratio 200/400 conservé
    expect(stats.images).toBe(1)
    expect(stats.postits).toBe(0)
  })

  // ── Zones → Frames ──────────────────────────────────────────────────────────

  it('converts zones to frames and includes them in the global offset', () => {
    const data = {
      colors: [],
      ideas: [makeIdea({ coords: { left: 500, top: 500 } })],
      state: [{
        uuid: 'z1', is_active: true, board_object_type: 'zone',
        title: 'RETRO', coords: { left: 100, top: 200 }, width: 3000, height: 2000, rank: 1,
      }],
      links: [], groups: [],
    }
    const { frames, stats, cards } = convertKlaxoon(data)
    expect(frames).toHaveLength(1)
    expect(frames[0].title).toBe('RETRO')
    // La zone définit le coin haut-gauche → posX = 100 - (100-40) = 40
    expect(frames[0].posX).toBe(40)
    expect(frames[0].posY).toBe(40)
    expect(frames[0].width).toBe(3000)
    // Le postit est décalé du même offset
    expect(cards[0].posX).toBe(500 - 60)
    expect(stats.zones).toBe(1)
  })

  // ── Images sans cap ─────────────────────────────────────────────────────────

  it('keeps the true display size of huge images (no 800px cap)', () => {
    const imageMap = new Map([['mediabundle/aa/big.png', 'data:image/png;base64,BBB']])
    const data = {
      colors: [], ideas: [],
      state: [{
        uuid: 'big-img', is_active: true, board_object_type: 'imageboard',
        path: 'mediabundle/aa/big.png', width: 2583, height: 2990,
        scale: { scale_x: 2, scale_y: 2 }, coords: { left: 0, top: 0 }, z_index: 0,
      }],
      links: [], groups: [],
    }
    const { cards } = convertKlaxoon(data, imageMap)
    expect(cards[0].width).toBe(5166)  // 2583 × 2
    expect(cards[0].height).toBe(5980) // 2990 × 2
  })

  // ── Textes : font-size html × scale, gras, couleur ─────────────────────────

  it('derives label size from the content_html font-size times the scale, uncapped', () => {
    const data = {
      colors: [], ideas: [],
      state: [makeTextItem({
        content_html: '<span style="color: var(--c3); font-size: 16px">Titre</span>',
        scale: { scale_x: 9 },
      })],
      links: [], groups: [],
    }
    const { cards } = convertKlaxoon(data)
    const fmt = JSON.parse(cards[0].content)
    expect(fmt.size).toBe(144) // 16 × 9, au-delà de l'ancien cap de 64
    expect(fmt.color).toBe('#ef4444') // var(--c3)
  })

  it('detects bold from <strong> in content_html', () => {
    const data = {
      colors: [], ideas: [],
      state: [makeTextItem({ content_html: '<span><strong>Gras</strong></span>' })],
      links: [], groups: [],
    }
    const { cards } = convertKlaxoon(data)
    expect(JSON.parse(cards[0].content).bold).toBe(true)
  })

  // ── Pens : flèches end_shapes, brush ────────────────────────────────────────

  it('appends an arrowhead to pen paths whose end_shapes contain "a"', () => {
    const path = JSON.stringify([{ type: 2, x: 0, y: 0 }, { type: 16, x: 100, y: 0 }])
    const base = {
      is_active: true, board_object_type: 'pen', coords: { left: 0, top: 0 },
      stroke_width: 4, z_index: 0,
    }
    const data = {
      colors: [], ideas: [],
      state: [
        { ...base, uuid: 'arrow', path_commands: path, end_shapes: ['l', 'a'] },
        { ...base, uuid: 'plain', path_commands: path, end_shapes: ['l', 'l'] },
      ],
      links: [], groups: [],
    }
    const { cards } = convertKlaxoon(data)
    const arrow = cards.find((c) => c.klxId === 'arrow')!
    const plain = cards.find((c) => c.klxId === 'plain')!
    // La pointe ajoute deux segments supplémentaires au path
    expect(arrow.content.length).toBeGreaterThan(plain.content.length)
    expect((arrow.content.match(/M/g) ?? []).length).toBe(2)
    expect((plain.content.match(/M/g) ?? []).length).toBe(1)
  })

  it('converts a brush stroke (center-relative points) to a DRAW card', () => {
    const data = {
      colors: [], ideas: [],
      state: [{
        uuid: 'brush-1', is_active: true, board_object_type: 'brush',
        color: 'c16', thickness: 15, coords: { left: 100, top: 200 },
        scale: { scale_x: 1, scale_y: 1 },
        path: ['simple', [100, 60], [[-50, -30], [0, 0], [50, 30]]],
        z_index: 0,
      }],
      links: [], groups: [],
    }
    const { cards, stats } = convertKlaxoon(data)
    expect(cards).toHaveLength(1)
    expect(cards[0].type).toBe('DRAW')
    // Premier point = coin haut-gauche du bbox (+ padding)
    expect(cards[0].content.startsWith('M8.0,8.0')).toBe(true)
    expect(stats.draws).toBe(1)
  })

  it('treats a pen flagged shape_type=rectangle as a SHAPE even without exact geometry', () => {
    // Path bezier quelconque (detectRect échoue) mais shape_type explicite
    const path = JSON.stringify([
      { type: 2, x: 0, y: 0 },
      { type: 32, x: 100, y: 0, x1: 30, y1: 2, x2: 70, y2: -2 },
      { type: 16, x: 100, y: 50 }, { type: 16, x: 0, y: 50 }, { type: 1 },
    ])
    const data = {
      colors: [], ideas: [],
      state: [{
        uuid: 'st-rect', is_active: true, board_object_type: 'pen',
        path_commands: path, shape_type: 'rectangle', coords: { left: 0, top: 0 },
        stroke_width: 4, z_index: 0,
      }],
      links: [], groups: [],
    }
    const { cards, stats } = convertKlaxoon(data)
    expect(cards[0].type).toBe('SHAPE')
    expect(stats.shapes).toBe(1)
  })

  // ── Liaisons vers des objets manquants ──────────────────────────────────────

  it('skips links whose endpoints were not imported', () => {
    const data = {
      colors: [],
      ideas: [makeIdea({ uuid: 'only' })],
      state: [],
      links: [
        { uuid: 'l', is_active: true, object_ids: ['only', 'deleted-uuid'], link_shape: 'curve', shapes: [], color: null, stroke_width: 2, stroke_style: 'solid' },
      ],
      groups: [],
    }
    const { connections, stats } = convertKlaxoon(data)
    expect(connections).toHaveLength(0)
    expect(stats.links).toBe(0)
    expect(stats.skipped).toBe(1)
  })
})
