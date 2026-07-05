import { describe, it, expect } from 'vitest'
import { sortTodoItems, type SortableTodoItem } from './todo-sort.js'

function item(overrides: Partial<SortableTodoItem> & { id: string }): SortableTodoItem {
  return { done: false, priority: 'NONE', dueDate: null, order: 0, ...overrides }
}

describe('sortTodoItems', () => {
  it('place les tâches non faites avant les tâches faites', () => {
    const items = [item({ id: 'a', done: true }), item({ id: 'b', done: false })]
    expect(sortTodoItems(items).map((i) => i.id)).toEqual(['b', 'a'])
  })

  it('trie par priorité décroissante à statut égal', () => {
    const items = [item({ id: 'low', priority: 'LOW' }), item({ id: 'high', priority: 'HIGH' }), item({ id: 'medium', priority: 'MEDIUM' })]
    expect(sortTodoItems(items).map((i) => i.id)).toEqual(['high', 'medium', 'low'])
  })

  it('à priorité égale, trie par échéance la plus proche', () => {
    const items = [
      item({ id: 'late', dueDate: '2026-08-01' }),
      item({ id: 'soon', dueDate: '2026-07-10' }),
      item({ id: 'none', dueDate: null }),
    ]
    expect(sortTodoItems(items).map((i) => i.id)).toEqual(['soon', 'late', 'none'])
  })

  it('à égalité totale, conserve l\'ordre de création', () => {
    const items = [item({ id: 'b', order: 2 }), item({ id: 'a', order: 1 })]
    expect(sortTodoItems(items).map((i) => i.id)).toEqual(['a', 'b'])
  })

  it('ne mute pas le tableau d\'origine', () => {
    const items = [item({ id: 'b', order: 2 }), item({ id: 'a', order: 1 })]
    const original = [...items]
    sortTodoItems(items)
    expect(items).toEqual(original)
  })
})
