import type { Card, Connection, Frame } from '@/hooks/useBoard'
import { cardDisplayText } from './card-format'

export async function exportBoardExcel(
  boardName: string,
  cards: Card[],
  connections: Connection[],
  frames: Frame[],
) {
  const { utils, writeFile } = await import('xlsx')

  const cardsRows = cards.map((c) => ({
    Type: c.type,
    Contenu: c.type === 'IMAGE' ? '[Image]' : cardDisplayText(c).slice(0, 1000),
    Couleur: c.color,
    'Position X': c.posX,
    'Position Y': c.posY,
    Largeur: c.width,
    Hauteur: c.height,
    Verrouillé: c.locked ? 'Oui' : 'Non',
    Groupe: c.groupId ?? '',
  }))

  const connRows = connections.map((c) => ({
    De: c.fromId,
    Vers: c.toId,
    Forme: c.shape,
    Couleur: c.color ?? '',
    Flèche: c.arrow,
    Tirets: c.dashed ? 'Oui' : 'Non',
    Épaisseur: c.width,
    Libellé: c.label ?? '',
  }))

  const frameRows = frames.map((f) => ({
    Titre: f.title,
    Couleur: f.color,
    'Position X': f.posX,
    'Position Y': f.posY,
    Largeur: f.width,
    Hauteur: f.height,
  }))

  const wb = utils.book_new()
  utils.book_append_sheet(wb, utils.json_to_sheet(cardsRows), 'Cartes')
  utils.book_append_sheet(wb, utils.json_to_sheet(connRows), 'Liaisons')
  utils.book_append_sheet(wb, utils.json_to_sheet(frameRows), 'Cadres')

  writeFile(wb, `${(boardName || 'board').replace(/[^\w-]+/g, '_')}.xlsx`)
}
