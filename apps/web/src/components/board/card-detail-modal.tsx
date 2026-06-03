'use client'

import { useState, useEffect } from 'react'
import type { Card, BoardField } from '@/hooks/useBoard'
import { ColorPicker } from '@/components/ui/color-picker'
import { parseTextFmt, serializeTextFmt, type TextFmt, type TextAlign } from '@/lib/card-format'
import { FmtBtn } from './board-card-parts'

const FIELD_TYPE_ICONS: Record<string, string> = {
  TEXT: '✏️', NUMBER: '#', DATE: '📅', SELECT: '▾',
}

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
  const isText = card.type === 'TEXT'
  const [content, setContent] = useState(() => isText ? parseTextFmt(card.content).text : card.content)
  const [textFmt, setTextFmt] = useState<Omit<TextFmt, 'text'>>(() => {
    const f = parseTextFmt(card.content)
    return { size: f.size, bold: f.bold, italic: f.italic, underline: f.underline, strike: f.strike, color: f.color, align: f.align }
  })

  useEffect(() => {
    if (isText) {
      const f = parseTextFmt(card.content)
      setContent(f.text)
      setTextFmt({ size: f.size, bold: f.bold, italic: f.italic, underline: f.underline, strike: f.strike, color: f.color, align: f.align })
    } else {
      setContent(card.content)
    }
  }, [card.content, isText])

  // Persist a formatting change immediately, keeping the current (possibly unsaved) text.
  function updateTextFmt(changes: Partial<Omit<TextFmt, 'text'>>) {
    const next = { ...textFmt, ...changes }
    setTextFmt(next)
    onUpdateCard(card.id, serializeTextFmt({ ...next, text: content }))
  }

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
            <ColorPicker value={card.color} onChange={(c) => onRecolorCard(card.id, c)} columns={7} />
          </div>

          {/* Content */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Contenu</label>

            {/* Formatting toolbar (TEXT cards only) */}
            {isText && (
              <div className="flex items-center flex-wrap gap-1 mb-2 bg-gray-50 border border-gray-200 rounded-xl px-2 py-1.5">
                {/* Font size */}
                <button
                  className="w-6 h-6 rounded flex items-center justify-center text-gray-500 hover:bg-gray-200 text-sm font-bold leading-none"
                  onClick={() => updateTextFmt({ size: Math.max(10, textFmt.size - 2) })}
                  title="Diminuer la taille"
                >−</button>
                <span className="text-[11px] font-mono text-gray-600 w-6 text-center select-none">{textFmt.size}</span>
                <button
                  className="w-6 h-6 rounded flex items-center justify-center text-gray-500 hover:bg-gray-200 text-sm font-bold leading-none"
                  onClick={() => updateTextFmt({ size: Math.min(48, textFmt.size + 2) })}
                  title="Augmenter la taille"
                >+</button>

                <div className="w-px h-5 bg-gray-200 mx-0.5" />

                <FmtBtn active={textFmt.bold}      onClick={() => updateTextFmt({ bold:      !textFmt.bold      })} title="Gras">
                  <span className="font-bold text-xs">B</span>
                </FmtBtn>
                <FmtBtn active={textFmt.italic}    onClick={() => updateTextFmt({ italic:    !textFmt.italic    })} title="Italique">
                  <span className="italic text-xs">I</span>
                </FmtBtn>
                <FmtBtn active={textFmt.underline} onClick={() => updateTextFmt({ underline: !textFmt.underline })} title="Souligné">
                  <span className="underline text-xs">U</span>
                </FmtBtn>
                <FmtBtn active={textFmt.strike}    onClick={() => updateTextFmt({ strike:    !textFmt.strike    })} title="Barré">
                  <span className="line-through text-xs">S</span>
                </FmtBtn>

                <div className="w-px h-5 bg-gray-200 mx-0.5" />

                {/* Alignment */}
                {([
                  ['left',   'Aligner à gauche', 'M4 6h16M4 12h10M4 18h13'],
                  ['center', 'Centrer',          'M4 6h16M7 12h10M5 18h14'],
                  ['right',  'Aligner à droite', 'M4 6h16M10 12h10M7 18h13'],
                ] as [TextAlign, string, string][]).map(([al, title, d]) => (
                  <FmtBtn key={al} active={textFmt.align === al} onClick={() => updateTextFmt({ align: al })} title={title}>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={d} />
                    </svg>
                  </FmtBtn>
                ))}

                <div className="w-px h-5 bg-gray-200 mx-0.5" />

                {/* Text color */}
                <ColorPicker value={textFmt.color} onChange={(c) => updateTextFmt({ color: c })} columns={8} />
              </div>
            )}

            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onBlur={() => onUpdateCard(card.id, isText ? serializeTextFmt({ ...textFmt, text: content }) : content)}
              rows={4}
              placeholder="Votre idée…"
              className="w-full rounded-xl border border-gray-200 px-4 py-3 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent leading-relaxed"
              style={isText ? {
                fontSize: textFmt.size,
                fontWeight: textFmt.bold ? 700 : 400,
                fontStyle: textFmt.italic ? 'italic' : 'normal',
                textDecoration: [textFmt.underline ? 'underline' : '', textFmt.strike ? 'line-through' : ''].filter(Boolean).join(' ') || 'none',
                color: textFmt.color,
                textAlign: textFmt.align,
              } : { fontSize: 14, color: '#1f2937' }}
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
