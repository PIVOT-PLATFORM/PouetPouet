export const CHIP_STYLE: Record<string, string> = {
  TEXT:   'bg-blue-50   text-blue-700   border-blue-100',
  NUMBER: 'bg-orange-50 text-orange-700 border-orange-100',
  DATE:   'bg-green-50  text-green-700  border-green-100',
  SELECT: 'bg-violet-50 text-violet-700 border-violet-100',
}

// Plancher de taille des cartes (rendu + redimensionnement). Bas volontairement
// pour ne pas regonfler les petits postits importés de Klaxoon (échelle < 1).
export const MIN_W = 40
export const MIN_H = 32
export const SHAPE_MIN = 80
// Largeur mini d'une étiquette (LABEL) — boîte déterministe pour des poignées alignées (#116)
export const MIN_LABEL_W = 60
