import type { Category, Risk, Prio } from '@/hooks/useRoadmap'

// Catégories de domaine — couleur unique par catégorie.
export const CATEGORIES: Record<Category, { label: string; color: string; text: string }> = {
  infra: { label: 'Infra', color: '#3b6fd4', text: '#fff' },
  dev: { label: 'Dev', color: '#2a9d5c', text: '#fff' },
  cyber: { label: 'Cyber', color: '#b04a2e', text: '#fff' },
}
export const CATEGORY_KEYS: Category[] = ['infra', 'dev', 'cyber']

// Risque.
export const RISKS: Record<Risk, { label: string; color: string }> = {
  low: { label: 'Faible', color: '#22c78a' },
  med: { label: 'Moyen', color: '#f59e0b' },
  high: { label: 'Élevé', color: '#ef4444' },
}
export const RISK_KEYS: Risk[] = ['low', 'med', 'high']

export const PRIOS: Record<Prio, string> = { should: 'Should', must: 'Must' }

// Couleur de texte lisible sur un fond hexa donné.
export function textOn(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.55 ? '#1a1d2e' : '#fff'
}

// Fond d'une barre selon ses catégories (solide ou dégradé en segments égaux).
export function barBackground(categories: Category[]): string {
  const cats = categories.length ? categories : (['dev'] as Category[])
  if (cats.length === 1) return CATEGORIES[cats[0]].color
  const stops: string[] = []
  cats.forEach((k, i) => {
    const c = CATEGORIES[k].color
    stops.push(`${c} ${Math.round((i / cats.length) * 100)}%`, `${c} ${Math.round(((i + 1) / cats.length) * 100)}%`)
  })
  return `linear-gradient(90deg,${stops.join(',')})`
}
