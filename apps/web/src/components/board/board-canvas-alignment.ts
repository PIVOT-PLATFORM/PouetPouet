import type { Card } from '@/hooks/useBoard'

export interface Guide { axis: 'v' | 'h'; pos: number; from: number; to: number }

// Aligne la carte déplacée (position proposée x,y) sur les bords/centres des autres
// cartes, dans une tolérance (coords canvas). Renvoie la position aimantée + les
// lignes-guides à dessiner (au plus une verticale + une horizontale).
export function computeAlignment(
  card: { width: number; height: number }, x: number, y: number,
  others: Card[], threshold: number,
): { x: number; y: number; guides: Guide[] } {
  const w = card.width, h = card.height
  const vSelf = [x, x + w / 2, x + w] // gauche, centre, droite
  const hSelf = [y, y + h / 2, y + h] // haut, milieu, bas
  let bestV: { d: number; pos: number; shift: number } | null = null
  let bestH: { d: number; pos: number; shift: number } | null = null
  let vTarget: Card | null = null, hTarget: Card | null = null

  for (const o of others) {
    const vO = [o.posX, o.posX + o.width / 2, o.posX + o.width]
    const hO = [o.posY, o.posY + o.height / 2, o.posY + o.height]
    for (let i = 0; i < 3; i++) {
      for (const ov of vO) {
        const d = Math.abs(vSelf[i] - ov)
        if (d <= threshold && (!bestV || d < bestV.d)) { bestV = { d, pos: ov, shift: ov - vSelf[i] }; vTarget = o }
      }
      for (const oh of hO) {
        const d = Math.abs(hSelf[i] - oh)
        if (d <= threshold && (!bestH || d < bestH.d)) { bestH = { d, pos: oh, shift: oh - hSelf[i] }; hTarget = o }
      }
    }
  }

  const nx = bestV ? x + bestV.shift : x
  const ny = bestH ? y + bestH.shift : y
  const guides: Guide[] = []
  if (bestV && vTarget) guides.push({ axis: 'v', pos: bestV.pos, from: Math.min(ny, vTarget.posY), to: Math.max(ny + h, vTarget.posY + vTarget.height) })
  if (bestH && hTarget) guides.push({ axis: 'h', pos: bestH.pos, from: Math.min(nx, hTarget.posX), to: Math.max(nx + w, hTarget.posX + hTarget.width) })
  return { x: nx, y: ny, guides }
}
