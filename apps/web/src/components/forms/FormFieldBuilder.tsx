'use client'

import { useState } from 'react'
import { Plus, Trash2, ChevronUp, ChevronDown, GripVertical, X, Settings2 } from 'lucide-react'
import { FORM_SUBMIT_TARGET } from '@pouetpouet/shared'
import type { FormFieldDef, FormFieldType } from '@pouetpouet/shared'

const FIELD_TYPES: { value: FormFieldType; label: string }[] = [
  { value: 'short_text', label: 'Texte court' },
  { value: 'long_text',  label: 'Texte long' },
  { value: 'number',     label: 'Nombre' },
  { value: 'date',       label: 'Date' },
  { value: 'email',      label: 'Email' },
  { value: 'dropdown',   label: 'Liste déroulante' },
  { value: 'radio',      label: 'Choix unique' },
  { value: 'checkboxes', label: 'Choix multiples' },
  { value: 'scale',      label: 'Échelle linéaire' },
  { value: 'file',       label: 'Fichier' },
  { value: 'grid',       label: 'Grille / matrice' },
  { value: 'section',    label: 'Section / saut de page' },
]

const TYPE_LABEL: Record<FormFieldType, string> = {
  short_text: 'Texte court', long_text: 'Texte long', number: 'Nombre',
  date: 'Date', email: 'Email', dropdown: 'Liste', radio: 'Choix unique',
  checkboxes: 'Choix multiples', scale: 'Échelle', file: 'Fichier',
  grid: 'Grille', section: 'Section',
}

const HAS_OPTIONS: FormFieldType[] = ['dropdown', 'radio', 'checkboxes']
const HAS_OTHER: FormFieldType[] = ['radio', 'checkboxes']
const CAN_ROUTE: FormFieldType[] = ['radio', 'dropdown']
const HAS_ADVANCED: FormFieldType[] = ['short_text', 'long_text']
const HAS_REGEX: FormFieldType[] = ['short_text']

const REGEX_PRESETS: { label: string; value: string; hint: string }[] = [
  { label: 'Code postal (France)',  value: '^[0-9]{5}$',                           hint: 'Ex. 75001' },
  { label: 'Numéro de téléphone',  value: '^(\\+33|0)[1-9]([ .-]?\\d{2}){4}$',   hint: 'Ex. 06 12 34 56 78' },
  { label: 'SIRET',                value: '^[0-9]{14}$',                           hint: '14 chiffres sans espace' },
  { label: 'URL',                  value: '^https?:\\/\\/.+',                      hint: 'Ex. https://exemple.fr' },
]
const PRESET_VALUES = REGEX_PRESETS.map((p) => p.value)

const inputCls = 'w-full text-sm bg-gray-50 dark:bg-gray-800/80 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-400/40 dark:text-white placeholder:text-gray-300 dark:placeholder:text-gray-600 border border-transparent focus:border-violet-300 dark:focus:border-violet-700 transition-colors'
const numCls = 'w-24 text-sm bg-gray-50 dark:bg-gray-800/80 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-400/40 dark:text-white border border-transparent focus:border-violet-300 dark:focus:border-violet-700 transition-colors'

interface Props {
  field: FormFieldDef
  index: number
  total: number
  sections: { id: string; label: string }[]
  dragHandleProps?: React.HTMLAttributes<HTMLSpanElement>
  onChange: (patch: Partial<FormFieldDef>) => void
  onDelete: () => void
  onMove: (dir: -1 | 1) => void
}

export function FormFieldBuilder({ field, index, total, sections, dragHandleProps, onChange, onDelete, onMove }: Props) {
  const [expanded, setExpanded] = useState(true)
  const [showAdvanced, setShowAdvanced] = useState(false)

  const isSection = field.type === 'section'
  const hasOptions = HAS_OPTIONS.includes(field.type)
  const options = field.options ?? []

  function setRouting(option: string, target: string) {
    const next = { ...(field.optionRouting ?? {}) }
    if (target === '') delete next[option]
    else next[option] = target
    onChange({ optionRouting: Object.keys(next).length ? next : undefined })
  }

  function updateOption(i: number, value: string) {
    const next = [...options]; next[i] = value; onChange({ options: next })
  }
  function addOption() { onChange({ options: [...options, `Option ${options.length + 1}`] }) }
  function removeOption(i: number) { onChange({ options: options.filter((_, idx) => idx !== i) }) }

  function changeType(type: FormFieldType) {
    const patch: Partial<FormFieldDef> = { type }
    if (HAS_OPTIONS.includes(type) && options.length === 0) patch.options = ['Option 1']
    if (type === 'grid') {
      if (!field.gridRows?.length) patch.gridRows = ['Ligne 1', 'Ligne 2']
      if (!field.gridCols?.length) patch.gridCols = ['Colonne 1', 'Colonne 2']
    }
    onChange(patch)
  }

  function editArr(key: 'gridRows' | 'gridCols', list: string[]) {
    onChange({ [key]: list } as Partial<FormFieldDef>)
  }

  const hasAdvancedSet = !!(field.maxLength || field.pattern)

  return (
    <div className={`rounded-2xl border bg-white dark:bg-gray-900 overflow-hidden transition-shadow hover:shadow-sm ${isSection ? 'border-violet-200 dark:border-violet-900/50' : 'border-gray-100 dark:border-gray-800'}`}>

      {/* Header — toujours visible */}
      <div className={`flex items-center gap-2 px-4 py-3 ${isSection ? 'bg-violet-50/60 dark:bg-violet-950/30' : 'bg-white dark:bg-gray-900'}`}>
        <span {...dragHandleProps} className="cursor-grab active:cursor-grabbing flex-shrink-0 text-gray-300 hover:text-gray-400 transition-colors" title="Glisser pour réordonner">
          <GripVertical className="w-4 h-4" />
        </span>
        <span className="text-[11px] font-semibold text-gray-300 dark:text-gray-600 w-4 flex-shrink-0 select-none">{index + 1}</span>

        {expanded ? (
          <input
            value={field.label}
            onChange={(e) => onChange({ label: e.target.value })}
            placeholder={isSection ? 'Titre de la section' : 'Votre question…'}
            className="flex-1 text-sm font-medium bg-transparent focus:outline-none dark:text-white placeholder:text-gray-300 dark:placeholder:text-gray-600 min-w-0"
          />
        ) : (
          <span className="flex-1 text-sm font-medium text-gray-700 dark:text-gray-200 truncate min-w-0">
            {field.label || <span className="text-gray-300 italic">Sans titre</span>}
          </span>
        )}

        {/* Badge type (replié) ou select (déplié) */}
        {expanded ? (
          <select
            value={field.type}
            onChange={(e) => changeType(e.target.value as FormFieldType)}
            className="text-xs bg-gray-100 dark:bg-gray-800 rounded-lg px-2 py-1.5 text-gray-600 dark:text-gray-300 focus:outline-none flex-shrink-0 cursor-pointer"
          >
            {FIELD_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        ) : (
          <span className="text-[11px] px-2 py-1 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 flex-shrink-0 whitespace-nowrap">
            {TYPE_LABEL[field.type]}
            {field.required && <span className="text-violet-400 ml-1">•</span>}
          </span>
        )}

        <div className="flex items-center gap-0.5 flex-shrink-0">
          <button disabled={index === 0} onClick={() => onMove(-1)} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-20 transition-colors" title="Monter">
            <ChevronUp className="w-3.5 h-3.5 text-gray-400" />
          </button>
          <button disabled={index === total - 1} onClick={() => onMove(1)} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-20 transition-colors" title="Descendre">
            <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
          </button>
          <button onClick={onDelete} className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-300 hover:text-red-500 transition-colors" title="Supprimer">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => setExpanded((v) => !v)} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-300 hover:text-gray-500 transition-colors ml-1" title={expanded ? 'Réduire' : 'Développer'}>
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Corps — masqué si replié */}
      {expanded && (
        <div className="px-4 pb-4 pt-1 flex flex-col gap-4 border-t border-gray-50 dark:border-gray-800/50">

          {/* Description / aide */}
          <input
            value={field.description ?? ''}
            onChange={(e) => onChange({ description: e.target.value || undefined })}
            placeholder="Texte d'aide (optionnel)"
            className="text-xs bg-transparent focus:outline-none text-gray-500 dark:text-gray-400 placeholder:text-gray-300 dark:placeholder:text-gray-600 ml-5"
          />

          {/* Options (radio / dropdown / checkboxes) */}
          {hasOptions && (
            <div className="flex flex-col gap-1.5 ml-5">
              {options.map((opt, i) => (
                <div key={i} className="flex items-center gap-2 group">
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-200 dark:bg-gray-700 flex-shrink-0 mt-0.5" />
                  <input
                    value={opt}
                    onChange={(e) => updateOption(i, e.target.value)}
                    className="flex-1 text-sm bg-gray-50 dark:bg-gray-800/80 rounded-lg px-2.5 py-1.5 focus:outline-none dark:text-white border border-transparent focus:border-violet-300 dark:focus:border-violet-700 transition-colors"
                  />
                  <button onClick={() => removeOption(i)} disabled={options.length <= 1} className="text-gray-200 dark:text-gray-700 hover:text-red-400 disabled:opacity-0 transition-colors opacity-0 group-hover:opacity-100">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              <button onClick={addOption} className="self-start text-xs text-violet-500 hover:text-violet-600 flex items-center gap-1 mt-1 ml-3.5">
                <Plus className="w-3 h-3" /> Ajouter une option
              </button>
            </div>
          )}

          {/* Échelle */}
          {field.type === 'scale' && (
            <div className="flex flex-col gap-3 ml-5">
              <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
                <span>De</span>
                <input type="number" value={field.scaleMin ?? 1} onChange={(e) => onChange({ scaleMin: Number(e.target.value) })} className={numCls} />
                <span>à</span>
                <input type="number" value={field.scaleMax ?? 5} onChange={(e) => onChange({ scaleMax: Number(e.target.value) })} className={numCls} />
              </div>
              <div className="flex gap-2">
                <input value={field.scaleMinLabel ?? ''} onChange={(e) => onChange({ scaleMinLabel: e.target.value || undefined })} placeholder="Libellé du minimum (ex. Pas du tout)" className={inputCls} />
                <input value={field.scaleMaxLabel ?? ''} onChange={(e) => onChange({ scaleMaxLabel: e.target.value || undefined })} placeholder="Libellé du maximum (ex. Tout à fait)" className={inputCls} />
              </div>
            </div>
          )}

          {/* Nombre — min / max */}
          {field.type === 'number' && (
            <div className="flex items-center gap-3 ml-5 text-sm text-gray-500 dark:text-gray-400">
              <span>Entre</span>
              <input type="number" value={field.min ?? ''} placeholder="—" onChange={(e) => onChange({ min: e.target.value === '' ? undefined : Number(e.target.value) })} className={numCls} />
              <span>et</span>
              <input type="number" value={field.max ?? ''} placeholder="—" onChange={(e) => onChange({ max: e.target.value === '' ? undefined : Number(e.target.value) })} className={numCls} />
            </div>
          )}

          {/* Grille */}
          {field.type === 'grid' && (
            <div className="flex flex-col gap-3 ml-5">
              <div className="grid grid-cols-2 gap-4">
                {(['gridRows', 'gridCols'] as const).map((key) => {
                  const list = field[key] ?? []
                  const title = key === 'gridRows' ? 'Lignes' : 'Colonnes'
                  return (
                    <div key={key} className="flex flex-col gap-1.5">
                      <span className="text-xs font-medium text-gray-400 dark:text-gray-500">{title}</span>
                      {list.map((val, i) => (
                        <div key={i} className="flex items-center gap-1.5 group">
                          <input
                            value={val}
                            onChange={(e) => editArr(key, list.map((x, idx) => (idx === i ? e.target.value : x)))}
                            className="flex-1 text-sm bg-gray-50 dark:bg-gray-800/80 rounded-lg px-2.5 py-1.5 focus:outline-none dark:text-white border border-transparent focus:border-violet-300 dark:focus:border-violet-700 transition-colors"
                          />
                          <button onClick={() => editArr(key, list.filter((_, idx) => idx !== i))} disabled={list.length <= 1} className="text-gray-200 dark:text-gray-700 hover:text-red-400 disabled:opacity-0 transition-colors opacity-0 group-hover:opacity-100">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                      <button onClick={() => editArr(key, [...list, `${title === 'Lignes' ? 'Ligne' : 'Colonne'} ${list.length + 1}`])} className="self-start text-xs text-violet-500 hover:text-violet-600 flex items-center gap-1">
                        <Plus className="w-3 h-3" /> Ajouter
                      </button>
                    </div>
                  )
                })}
              </div>
              <label className="flex items-center gap-2 cursor-pointer text-xs text-gray-500 dark:text-gray-400">
                <input type="checkbox" checked={field.gridMultiple ?? false} onChange={(e) => onChange({ gridMultiple: e.target.checked || undefined })} className="w-3.5 h-3.5 rounded text-violet-500" />
                Permettre plusieurs réponses par ligne
              </label>
            </div>
          )}

          {/* Option "Autre" */}
          {HAS_OTHER.includes(field.type) && (
            <label className="flex items-center gap-2 cursor-pointer text-xs text-gray-500 dark:text-gray-400 ml-5">
              <input type="checkbox" checked={field.allowOther ?? false} onChange={(e) => onChange({ allowOther: e.target.checked || undefined })} className="w-3.5 h-3.5 rounded text-violet-500" />
              Ajouter une option « Autre » (saisie libre)
            </label>
          )}

          {/* Logique conditionnelle */}
          {CAN_ROUTE.includes(field.type) && sections.length > 0 && options.length > 0 && (
            <div className="flex flex-col gap-1.5 ml-5 pt-3 border-t border-gray-100 dark:border-gray-800">
              <span className="text-xs font-medium text-gray-400 dark:text-gray-500">Navigation conditionnelle</span>
              {options.map((opt) => (
                <div key={opt} className="flex items-center gap-2 text-xs">
                  <span className="text-gray-500 dark:text-gray-400 min-w-0 w-32 truncate" title={opt}>{opt || '—'}</span>
                  <span className="text-gray-300 flex-shrink-0">→</span>
                  <select
                    value={field.optionRouting?.[opt] ?? ''}
                    onChange={(e) => setRouting(opt, e.target.value)}
                    className="flex-1 text-xs bg-gray-50 dark:bg-gray-800 rounded-lg px-2 py-1.5 focus:outline-none dark:text-white border border-transparent focus:border-violet-300 dark:focus:border-violet-700 transition-colors"
                  >
                    <option value="">Continuer (par défaut)</option>
                    {sections.filter((s) => s.id !== field.id).map((s) => (
                      <option key={s.id} value={s.id}>{s.label || 'Section sans titre'}</option>
                    ))}
                    <option value={FORM_SUBMIT_TARGET}>Envoyer le formulaire</option>
                  </select>
                </div>
              ))}
            </div>
          )}

          {/* Pied de carte : Obligatoire + Avancé */}
          {!isSection && (
            <div className="flex items-center justify-between pt-1 ml-5">
              <label className="flex items-center gap-2 cursor-pointer text-xs text-gray-500 dark:text-gray-400">
                <input
                  type="checkbox"
                  checked={field.required}
                  onChange={(e) => onChange({ required: e.target.checked })}
                  className="w-3.5 h-3.5 rounded text-violet-500"
                />
                Réponse obligatoire
              </label>

              {HAS_ADVANCED.includes(field.type) && (
                <button
                  onClick={() => setShowAdvanced((v) => !v)}
                  className={`flex items-center gap-1 text-xs transition-colors ${hasAdvancedSet ? 'text-violet-500' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}
                >
                  <Settings2 className="w-3.5 h-3.5" />
                  Avancé{hasAdvancedSet ? ' ●' : ''}
                </button>
              )}
            </div>
          )}

          {/* Options avancées (texte court / long) */}
          {showAdvanced && HAS_ADVANCED.includes(field.type) && (
            <div className="ml-5 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800 flex flex-col gap-2.5">
              <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                <span className="w-36 shrink-0">Limite de caractères</span>
                <input
                  type="number"
                  value={field.maxLength ?? ''}
                  placeholder="aucune"
                  onChange={(e) => onChange({ maxLength: e.target.value === '' ? undefined : Number(e.target.value) })}
                  className="w-24 text-sm bg-white dark:bg-gray-800 rounded-lg px-2.5 py-1.5 focus:outline-none dark:text-white border border-gray-200 dark:border-gray-700 focus:border-violet-300 dark:focus:border-violet-700 transition-colors"
                />
              </div>
              {HAS_REGEX.includes(field.type) && (() => {
                const isPreset = field.pattern ? PRESET_VALUES.includes(field.pattern) : false
                const isCustom = !!field.pattern && !isPreset
                const selectVal = !field.pattern ? '' : isPreset ? field.pattern : '__custom__'
                const activePreset = REGEX_PRESETS.find((p) => p.value === field.pattern)

                function handleSelect(v: string) {
                  if (v === '') onChange({ pattern: undefined })
                  else if (v === '__custom__') onChange({ pattern: '' })
                  else onChange({ pattern: v })
                }

                return (
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                      <span className="w-36 shrink-0">Format attendu</span>
                      <select
                        value={selectVal}
                        onChange={(e) => handleSelect(e.target.value)}
                        className="flex-1 text-sm bg-white dark:bg-gray-800 rounded-lg px-2.5 py-1.5 focus:outline-none dark:text-white border border-gray-200 dark:border-gray-700 focus:border-violet-300 dark:focus:border-violet-700 transition-colors"
                      >
                        <option value="">Aucune restriction</option>
                        {REGEX_PRESETS.map((p) => (
                          <option key={p.value} value={p.value}>{p.label}</option>
                        ))}
                        <option value="__custom__">Personnalisée…</option>
                      </select>
                    </div>
                    {activePreset && (
                      <p className="text-[11px] text-gray-400 dark:text-gray-500 ml-36 pl-3">{activePreset.hint}</p>
                    )}
                    {isCustom && (
                      <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                        <span className="w-36 shrink-0 text-gray-300 dark:text-gray-600">Regex</span>
                        <input
                          value={field.pattern ?? ''}
                          placeholder="ex. ^[A-Z]{2}[0-9]{4}$"
                          onChange={(e) => onChange({ pattern: e.target.value || undefined })}
                          className="flex-1 text-sm bg-white dark:bg-gray-800 rounded-lg px-2.5 py-1.5 focus:outline-none dark:text-white border border-gray-200 dark:border-gray-700 focus:border-violet-300 dark:focus:border-violet-700 transition-colors font-mono"
                        />
                      </div>
                    )}
                  </div>
                )
              })()}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
