// Tri pur des tâches d'une liste — à faire d'abord, puis faites, puis annulées
// en dernier ; au sein d'un même statut, par priorité décroissante, puis par
// échéance la plus proche, puis par ordre de création.
// Extrait pour être testable unitairement (cf. ranking.ts du module Innovation).

export interface SortableTodoItem {
  id: string
  status: 'TODO' | 'IN_PROGRESS' | 'BLOCKED' | 'DONE' | 'CANCELLED'
  priority: 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH'
  dueDate: string | null
  order: number
}

// TODO/IN_PROGRESS/BLOCKED forment un seul palier « ouvert » (la distinction
// visuelle se fait dans la vue Kanban, pas dans le tri de la vue liste).
const STATUS_RANK: Record<SortableTodoItem['status'], number> = { TODO: 0, IN_PROGRESS: 0, BLOCKED: 0, DONE: 1, CANCELLED: 2 }
const PRIORITY_RANK: Record<SortableTodoItem['priority'], number> = { HIGH: 3, MEDIUM: 2, LOW: 1, NONE: 0 }

export function sortTodoItems<T extends SortableTodoItem>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const statusDiff = STATUS_RANK[a.status] - STATUS_RANK[b.status]
    if (statusDiff !== 0) return statusDiff
    const priorityDiff = PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority]
    if (priorityDiff !== 0) return priorityDiff
    const ad = a.dueDate ?? '9999-99-99'
    const bd = b.dueDate ?? '9999-99-99'
    if (ad !== bd) return ad < bd ? -1 : 1
    return a.order - b.order
  })
}
