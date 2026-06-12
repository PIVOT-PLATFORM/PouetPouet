'use client'

import { useState, useRef, useEffect } from 'react'
import type { BoardField } from '@/hooks/useBoard'

const FIELD_TYPES = [
  { value: 'TEXT', label: 'Texte' },
  { value: 'NUMBER', label: 'Nombre' },
  { value: 'DATE', label: 'Date' },
  { value: 'SELECT', label: 'Liste' },
]

const TYPE_LABELS: Record<string, string> = { TEXT: 'Texte', NUMBER: 'Nombre', DATE: 'Date', SELECT: 'Liste' }

const EMOJI_GROUPS = [
  { label: 'Personnes', emojis: ['👤', '👥', '👩‍💼', '👨‍💼', '🧑‍💻', '👩‍🎨', '🤝', '🧑‍🏫', '🙋', '🧑‍🔬'] },
  { label: 'Temps', emojis: ['📅', '⏰', '⏱️', '🗓️', '⌚', '🔔', '⚡', '🕐', '🗒️', '📆'] },
  { label: 'Statut', emojis: ['✅', '❌', '🔄', '⚠️', '🚩', '🔴', '🟡', '🟢', '🔵', '⭕'] },
  { label: 'Priorité', emojis: ['🔥', '⬆️', '➡️', '⬇️', '💯', '⭐', '🏆', '🥇', '🎖️', '🚀'] },
  { label: 'Travail', emojis: ['📝', '✏️', '🔧', '💡', '🎯', '📊', '📈', '💼', '🗃️', '📋'] },
  { label: 'Tags', emojis: ['🏷️', '📌', '📎', '🔗', '🗂️', '📁', '🔖', '📦', '🧩', '🔑'] },
  { label: 'Créativité', emojis: ['🎨', '🖌️', '💭', '🌟', '🎭', '🎲', '🔮', '🧠', '💎', '🌈'] },
  { label: 'Données', emojis: ['#️⃣', '💪', '📏', '🔢', '💰', '📉', '⚖️', '🧮', '🔬', '📐'] },
]

interface Preset {
  emoji: string
  name: string
  type: string
  options?: string[]
}

const PRESET_GROUPS: { label: string; presets: Preset[] }[] = [
  {
    label: 'Gestion de projet',
    presets: [
      { emoji: '👤', name: 'Porteur', type: 'TEXT' },
      { emoji: '🚩', name: 'Priorité', type: 'SELECT', options: ['🔴 Critique', '🟠 Haute', '🟡 Moyenne', '🟢 Basse'] },
      { emoji: '📊', name: 'Statut', type: 'SELECT', options: ['À faire', 'En cours', 'En révision', 'Terminé', 'Bloqué'] },
      { emoji: '📅', name: 'Échéance', type: 'DATE' },
      { emoji: '⏱️', name: 'Durée (j)', type: 'NUMBER' },
      { emoji: '💪', name: 'Effort (pts)', type: 'NUMBER' },
      { emoji: '🏷️', name: 'Étiquette', type: 'SELECT', options: ['Bug', 'Feature', 'Amélioration', 'Documentation'] },
      { emoji: '🔁', name: 'Sprint', type: 'NUMBER' },
    ],
  },
  {
    label: 'Créativité & Design',
    presets: [
      { emoji: '⚡', name: 'Impact', type: 'SELECT', options: ['Fort', 'Moyen', 'Faible'] },
      { emoji: '🔧', name: 'Faisabilité', type: 'SELECT', options: ['Facile', 'Modérée', 'Difficile'] },
      { emoji: '🔄', name: 'Phase', type: 'SELECT', options: ['Empathie', 'Définition', 'Idéation', 'Prototype', 'Test'] },
      { emoji: '🎭', name: 'Persona', type: 'TEXT' },
      { emoji: '📌', name: 'Catégorie', type: 'SELECT', options: ['Problème', 'Solution', 'Opportunité', 'Risque', 'Idée'] },
      { emoji: '⭐', name: 'Vote', type: 'NUMBER' },
      { emoji: '💡', name: 'Source', type: 'TEXT' },
      { emoji: '🎯', name: 'Objectif', type: 'TEXT' },
    ],
  },
]

// ── Emoji picker ─────────────────────────────────────────────────────────────
function EmojiPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="Choisir un emoji"
        className="w-10 h-10 rounded-lg border border-gray-200 flex items-center justify-center text-xl hover:border-primary-300 hover:bg-primary-50 transition-colors select-none"
      >
        {value || <span className="text-gray-300 text-sm">+</span>}
      </button>

      {open && (
        <div className="absolute z-20 left-0 top-12 bg-white rounded-2xl shadow-2xl border border-gray-100 p-3 w-72">
          <div className="max-h-60 overflow-y-auto space-y-3 pr-1">
            {EMOJI_GROUPS.map((group) => (
              <div key={group.label}>
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">{group.label}</p>
                <div className="grid grid-cols-10 gap-0.5">
                  {group.emojis.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => { onChange(emoji); setOpen(false) }}
                      className={`w-6 h-6 flex items-center justify-center text-base rounded hover:bg-primary-50 transition-colors ${value === emoji ? 'bg-primary-100 ring-1 ring-primary-400' : ''}`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          {value && (
            <button
              type="button"
              onClick={() => { onChange(''); setOpen(false) }}
              className="mt-2 w-full text-[11px] text-gray-400 hover:text-red-400 transition-colors text-center"
            >
              Effacer l'emoji
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main panel ────────────────────────────────────────────────────────────────
interface Props {
  fields: BoardField[]
  onCreate: (name: string, type: string, options?: string[], emoji?: string) => void
  onUpdate: (id: string, name: string, options?: string[], emoji?: string) => void
  onDelete: (id: string) => void
  onClose: () => void
}

export function BoardFieldsPanel({ fields, onCreate, onUpdate, onDelete, onClose }: Props) {
  const [newEmoji, setNewEmoji] = useState('')
  const [newName, setNewName] = useState('')
  const [newType, setNewType] = useState('TEXT')
  const [newOptions, setNewOptions] = useState('')

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editEmoji, setEditEmoji] = useState('')
  const [editName, setEditName] = useState('')
  const [editOptions, setEditOptions] = useState('')

  function applyPreset(preset: Preset) {
    setNewEmoji(preset.emoji)
    setNewName(preset.name)
    setNewType(preset.type)
    setNewOptions(preset.options?.join(', ') ?? '')
  }

  function handleCreate() {
    if (!newName.trim()) return
    const options = newType === 'SELECT' ? newOptions.split(',').map((o) => o.trim()).filter(Boolean) : undefined
    onCreate(newName.trim(), newType, options, newEmoji || undefined)
    setNewEmoji(''); setNewName(''); setNewOptions(''); setNewType('TEXT')
  }

  function startEdit(field: BoardField) {
    setEditingId(field.id)
    setEditEmoji(field.emoji ?? '')
    setEditName(field.name)
    setEditOptions(field.options?.join(', ') ?? '')
  }

  function handleUpdate(field: BoardField) {
    const options = field.type === 'SELECT' ? editOptions.split(',').map((o) => o.trim()).filter(Boolean) : undefined
    onUpdate(field.id, editName, options, editEmoji || undefined)
    setEditingId(null)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[88vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <div>
            <h2 className="font-semibold text-gray-900">Champs personnalisés</h2>
            <p className="text-xs text-gray-400 mt-0.5">Ajoutez des informations structurées à vos cartes</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Presets */}
          <div className="px-6 pt-5 pb-4 border-b border-gray-100">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Suggestions rapides</p>
            {PRESET_GROUPS.map((group) => (
              <div key={group.label} className="mb-4 last:mb-0">
                <p className="text-[11px] text-gray-400 mb-2">{group.label}</p>
                <div className="flex flex-wrap gap-1.5">
                  {group.presets.map((preset) => (
                    <button
                      key={preset.name}
                      onClick={() => applyPreset(preset)}
                      className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-medium text-gray-700 hover:border-primary-300 hover:bg-primary-50 hover:text-primary-700 transition-colors"
                    >
                      <span>{preset.emoji}</span>
                      <span>{preset.name}</span>
                      <span className="text-gray-400 text-[10px]">· {TYPE_LABELS[preset.type]}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Existing fields */}
          {fields.length > 0 && (
            <div className="px-6 py-4 border-b border-gray-100">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                Champs actifs ({fields.length})
              </p>
              <div className="space-y-2">
                {fields.map((field) => (
                  <div key={field.id} className="flex items-start gap-3 rounded-xl border border-gray-100 p-3 bg-gray-50">
                    {editingId === field.id ? (
                      <div className="flex-1 space-y-2">
                        <div className="flex gap-2 items-center">
                          <EmojiPicker value={editEmoji} onChange={setEditEmoji} />
                          <input
                            autoFocus
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') handleUpdate(field); if (e.key === 'Escape') setEditingId(null) }}
                            className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                          />
                        </div>
                        {field.type === 'SELECT' && (
                          <input
                            value={editOptions}
                            onChange={(e) => setEditOptions(e.target.value)}
                            placeholder="Option A, Option B, Option C"
                            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-500"
                          />
                        )}
                        <div className="flex gap-2">
                          <button onClick={() => handleUpdate(field)} className="text-xs bg-primary-600 text-white rounded-lg px-3 py-1 hover:bg-primary-700">Enregistrer</button>
                          <button onClick={() => setEditingId(null)} className="text-xs text-gray-500 hover:text-gray-700">Annuler</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <span className="text-xl shrink-0 mt-0.5">{field.emoji || '•'}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium text-gray-800 truncate">{field.name}</span>
                            <span className="text-[10px] font-medium text-gray-400 bg-gray-200 rounded-full px-2 py-0.5 shrink-0">{TYPE_LABELS[field.type]}</span>
                          </div>
                          {field.options && (
                            <p className="text-xs text-gray-400 mt-0.5 truncate">{field.options.join(' · ')}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button onClick={() => startEdit(field)} className="text-gray-400 hover:text-primary-600 transition-colors p-1">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                          </button>
                          <button onClick={() => onDelete(field.id)} className="text-gray-400 hover:text-red-500 transition-colors p-1">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Create form */}
          <div className="px-6 py-5">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Champ personnalisé</p>
            <div className="flex gap-2 items-center mb-2">
              <EmojiPicker value={newEmoji} onChange={setNewEmoji} />
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleCreate() }}
                placeholder="Nom du champ…"
                className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              <select
                value={newType}
                onChange={(e) => setNewType(e.target.value)}
                className="text-sm border border-gray-200 rounded-lg px-2 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
              >
                {FIELD_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            {newType === 'SELECT' && (
              <input
                value={newOptions}
                onChange={(e) => setNewOptions(e.target.value)}
                placeholder="Option A, Option B, Option C"
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 mb-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            )}
            <button
              onClick={handleCreate}
              disabled={!newName.trim()}
              className="w-full rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-40 transition-colors"
            >
              Ajouter le champ
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
