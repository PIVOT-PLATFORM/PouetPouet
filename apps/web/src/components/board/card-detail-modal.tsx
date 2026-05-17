'use client'

import { useState, useEffect } from 'react'
import type { Card, BoardField } from '@/hooks/useBoard'

const FIELD_TYPE_ICONS: Record<string, string> = {
  TEXT: '✏️', NUMBER: '#', DATE: '📅', SELECT: '▾',
}

const CARD_COLORS = [
  '#FEF08A', '#86EFAC', '#93C5FD', '#F9A8D4', '#FCA5A5', '#C4B5FD', '#FED7AA',
  '#A7F3D0', '#BAE6FD', '#F5D0FE', '#FECDD3', '#E0E7FF', '#FFFFFF', '#F3F4F6',
]

function fieldIcon(field: { emoji: string | null; type: string }): string {
  return field.emoji || FIELD_TYPE_ICONS[field.type] || '•'
}

interface Props {
  card: Card
  fields: BoardField[]
  onUpdateCard: (id: string, content: string) => void
  onRecolorCard: (id: string, color: string) => void
  onSetFieldValue: (cardId: string, fieldId: string, value: string) => void
  onClearFieldValue: (cardId: string, fieldId: string) => void
  onClose: () => void
}

export function CardDetailModal({ card, fields, onUpdateCard, onRecolorCard, onSetFieldValue, onClearFieldValue, onClose }: Props) {
  const [content, setContent] = useState(card.content)

  useEffect(() => { setContent(card.content) }, [card.content])

  function getFieldValue(fieldId: string): string {
    return (card.fieldValues ?? []).find((v) => v.fieldId === fieldId)?.value ?? ''
  }

  function handleFieldChange(field: BoardField, value: string) {
    if (value === '') {
      onClearFieldValue(card.id, field.id)
    } else {
      onSetFieldValue(card.id, field.id, value)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      {/* overflow-hidden clips the color strip to the container's rounded corners */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[85vh] overflow-hidden">
        {/* Color strip — no rounded corners needed, clipped by parent overflow-hidden */}
        <div className="h-3 shrink-0" style={{ background: card.color }} />

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-4 pb-2 shrink-0">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Détail de la carte</span>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-5">
          {/* Color picker */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Couleur</label>
            <div className="flex flex-wrap gap-2">
              {CARD_COLORS.map((c) => (
                <button
                  key={c}
                  title={c}
                  onClick={() => onRecolorCard(card.id, c)}
                  className={`w-7 h-7 rounded-full border-2 transition-all hover:scale-110 ${
                    card.color === c ? 'border-gray-700 scale-110 shadow-md' : 'border-white shadow-sm ring-1 ring-gray-200'
                  }`}
                  style={{ background: c }}
                />
              ))}
            </div>
          </div>

          {/* Content */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Contenu</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onBlur={() => onUpdateCard(card.id, content)}
              rows={4}
              placeholder="Votre idée…"
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-800 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent leading-relaxed"
            />
          </div>

          {/* Fields */}
          {fields.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Informations</label>
              <div className="space-y-3">
                {fields.map((field) => {
                  const value = getFieldValue(field.id)
                  return (
                    <div key={field.id} className="flex items-center gap-3">
                      <div className="flex items-center gap-2 w-36 shrink-0">
                        <span className="text-sm">{fieldIcon(field)}</span>
                        <span className="text-sm font-medium text-gray-700 truncate">{field.name}</span>
                      </div>

                      <div className="flex-1 flex items-center gap-1">
                        {field.type === 'TEXT' && (
                          <input
                            type="text"
                            value={value}
                            onChange={(e) => handleFieldChange(field, e.target.value)}
                            placeholder="—"
                            className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        )}
                        {field.type === 'NUMBER' && (
                          <input
                            type="number"
                            value={value}
                            onChange={(e) => handleFieldChange(field, e.target.value)}
                            placeholder="—"
                            className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        )}
                        {field.type === 'DATE' && (
                          <input
                            type="date"
                            value={value}
                            onChange={(e) => handleFieldChange(field, e.target.value)}
                            className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        )}
                        {field.type === 'SELECT' && (
                          <select
                            value={value}
                            onChange={(e) => handleFieldChange(field, e.target.value)}
                            className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                          >
                            <option value="">—</option>
                            {(field.options ?? []).map((opt) => (
                              <option key={opt} value={opt}>{opt}</option>
                            ))}
                          </select>
                        )}

                        {value && (
                          <button
                            onClick={() => onClearFieldValue(card.id, field.id)}
                            className="text-gray-300 hover:text-red-400 transition-colors shrink-0"
                            title="Effacer"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {fields.length === 0 && (
            <p className="text-xs text-gray-400 text-center py-2">
              Aucun champ configuré pour ce board. Ajoutez-en via le bouton <strong>Champs</strong> dans la barre d'outils.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
