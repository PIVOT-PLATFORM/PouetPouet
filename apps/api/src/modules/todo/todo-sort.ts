// Tri pur des tâches d'une liste — non faites d'abord, puis par priorité
// décroissante, puis par échéance la plus proche, puis par ordre de création.
// Extrait pour être testable unitairement (cf. ranking.ts du module Innovation).

export interface SortableTodoItem {
  id: string
  done: boolean
  priority: 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH'
  dueDate: string | null
  order: number
}

const PRIORITY_RANK: Record<SortableTodoItem['priority'], number> = { HIGH: 3, MEDIUM: 2, LOW: 1, NONE: 0 }

export function sortTodoItems<T extends SortableTodoItem>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1
    const priorityDiff = PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority]
    if (priorityDiff !== 0) return priorityDiff
    const ad = a.dueDate ?? '9999-99-99'
    const bd = b.dueDate ?? '9999-99-99'
    if (ad !== bd) return ad < bd ? -1 : 1
    return a.order - b.order
  })
}
