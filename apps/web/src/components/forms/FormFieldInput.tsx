'use client'

import { useState } from 'react'
import { Upload, Loader2, X, FileText } from 'lucide-react'
import type { FormFieldDef, FormFileValue } from '@pouetpouet/shared'

interface Props {
  field: FormFieldDef
  value: unknown
  onChange: (value: unknown) => void
  error?: string
  disabled?: boolean
  uploadFile?: (file: File) => Promise<FormFileValue>
}

const inputCls = (err?: string) =>
  `w-full px-3 py-2 rounded-xl border bg-white dark:bg-gray-800 text-sm dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500/50 ${
    err ? 'border-red-300 dark:border-red-700' : 'border-gray-200 dark:border-gray-700'
  }`

export function FormFieldInput({ field, value, onChange, error, disabled, uploadFile }: Props) {
  const options = field.options ?? []
  const [fileState, setFileState] = useState<'idle' | 'uploading' | 'error'>('idle')

  // Hooks pour l'option « Autre » — doivent être avant tout return conditionnel.
  const initialOther = (() => {
    if (!field.allowOther) return { active: false, text: '' }
    if (field.type === 'radio') {
      const isOther = typeof value === 'string' && value !== '' && !options.includes(value)
      return { active: isOther, text: isOther ? (value as string) : '' }
    }
    if (field.type === 'checkboxes' && Array.isArray(value)) {
      const other = (value as string[]).find((x) => !options.includes(x))
      return { active: other != null, text: other ?? '' }
    }
    return { active: false, text: '' }
  })()
  const [otherActive, setOtherActive] = useState(initialOther.active)
  const [otherText, setOtherText] = useState(initialOther.text)

  // Une section est un en-tête de page, pas un champ de saisie.
  if (field.type === 'section') {
    return (
      <div className="flex flex-col gap-1 border-l-4 border-violet-400 pl-3">
        <h3 className="text-lg font-semibold dark:text-white">{field.label || 'Section'}</h3>
        {field.description && <p className="text-sm text-gray-500 dark:text-gray-400 whitespace-pre-wrap">{field.description}</p>}
      </div>
    )
  }

  function renderInner() {
    switch (field.type) {
      case 'long_text':
        return (
          <textarea value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)} disabled={disabled} rows={3} className={`${inputCls(error)} resize-none`} />
        )
      case 'dropdown':
        return (
          <select value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)} disabled={disabled} className={inputCls(error)}>
            <option value="">Choisir…</option>
            {options.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        )
      case 'scale': {
        const min = field.scaleMin ?? 1
        const max = field.scaleMax ?? 5
        const range = Array.from({ length: Math.max(0, max - min + 1) }, (_, i) => min + i)
        return (
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2 flex-wrap">
              {range.map((n) => (
                <button
                  key={n}
                  type="button"
                  disabled={disabled}
                  onClick={() => onChange(n)}
                  className={`w-9 h-9 rounded-full border text-sm font-medium transition-colors ${
                    Number(value) === n
                      ? 'bg-violet-500 border-violet-500 text-white'
                      : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-violet-300'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
            {(field.scaleMinLabel || field.scaleMaxLabel) && (
              <div className="flex justify-between text-xs text-gray-400">
                <span>{field.scaleMinLabel}</span>
                <span>{field.scaleMaxLabel}</span>
              </div>
            )}
          </div>
        )
      }
      case 'radio':
        return (
          <div className="flex flex-col gap-1.5">
            {options.map((o) => (
              <label key={o} className="flex items-center gap-2 cursor-pointer text-sm text-gray-700 dark:text-gray-300">
                <input type="radio" checked={!otherActive && value === o} onChange={() => { setOtherActive(false); onChange(o) }} disabled={disabled} className="w-4 h-4 text-violet-500" />
                {o}
              </label>
            ))}
            {field.allowOther && (
              <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700 dark:text-gray-300">
                <input type="radio" checked={otherActive} onChange={() => { setOtherActive(true); onChange(otherText) }} disabled={disabled} className="w-4 h-4 text-violet-500" />
                Autre :
                <input
                  type="text" value={otherText} disabled={disabled}
                  onChange={(e) => { setOtherText(e.target.value); setOtherActive(true); onChange(e.target.value) }}
                  onFocus={() => { setOtherActive(true); onChange(otherText) }}
                  className="flex-1 px-2 py-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm dark:text-white focus:outline-none"
                />
              </label>
            )}
          </div>
        )
      case 'checkboxes': {
        const arr = Array.isArray(value) ? (value as string[]) : []
        const setArr = (next: string[]) => onChange(next)
        return (
          <div className="flex flex-col gap-1.5">
            {options.map((o) => (
              <label key={o} className="flex items-center gap-2 cursor-pointer text-sm text-gray-700 dark:text-gray-300">
                <input
                  type="checkbox" checked={arr.includes(o)} disabled={disabled}
                  onChange={(e) => setArr(e.target.checked ? [...arr, o] : arr.filter((x) => x !== o))}
                  className="w-4 h-4 rounded text-violet-500"
                />
                {o}
              </label>
            ))}
            {field.allowOther && (
              <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700 dark:text-gray-300">
                <input
                  type="checkbox" checked={otherActive} disabled={disabled}
                  onChange={(e) => {
                    if (e.target.checked) { setOtherActive(true); if (otherText) setArr([...arr.filter((x) => options.includes(x)), otherText]) }
                    else { setOtherActive(false); setArr(arr.filter((x) => options.includes(x))) }
                  }}
                  className="w-4 h-4 rounded text-violet-500"
                />
                Autre :
                <input
                  type="text" value={otherText} disabled={disabled}
                  onChange={(e) => {
                    const t = e.target.value
                    setOtherText(t); setOtherActive(true)
                    setArr([...arr.filter((x) => options.includes(x)), ...(t ? [t] : [])])
                  }}
                  className="flex-1 px-2 py-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm dark:text-white focus:outline-none"
                />
              </label>
            )}
          </div>
        )
      }
      case 'grid': {
        const rows = field.gridRows ?? []
        const cols = field.gridCols ?? []
        const ans = (value && typeof value === 'object' ? value : {}) as Record<string, string | string[]>
        const setCell = (row: string, col: string) => {
          if (field.gridMultiple) {
            const cur = Array.isArray(ans[row]) ? (ans[row] as string[]) : []
            const next = cur.includes(col) ? cur.filter((c) => c !== col) : [...cur, col]
            onChange({ ...ans, [row]: next })
          } else {
            onChange({ ...ans, [row]: col })
          }
        }
        const checked = (row: string, col: string) =>
          field.gridMultiple ? Array.isArray(ans[row]) && (ans[row] as string[]).includes(col) : ans[row] === col
        return (
          <div className="overflow-x-auto">
            <table className="text-sm border-collapse">
              <thead>
                <tr>
                  <th />
                  {cols.map((c) => <th key={c} className="px-3 py-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 text-center">{c}</th>)}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r} className="border-t border-gray-100 dark:border-gray-800">
                    <td className="pr-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">{r}</td>
                    {cols.map((c) => (
                      <td key={c} className="px-3 py-1.5 text-center">
                        <input
                          type={field.gridMultiple ? 'checkbox' : 'radio'}
                          name={`${field.id}-${r}`}
                          checked={checked(r, c)}
                          disabled={disabled}
                          onChange={() => setCell(r, c)}
                          className={`w-4 h-4 text-violet-500 ${field.gridMultiple ? 'rounded' : ''}`}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      }
      case 'file': {
        const file = value as FormFileValue | undefined
        if (file?.key) {
          return (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
              <FileText className="w-4 h-4 text-violet-500 flex-shrink-0" />
              <span className="flex-1 text-sm dark:text-white truncate">{file.filename}</span>
              {!disabled && (
                <button type="button" onClick={() => onChange(undefined)} className="text-gray-400 hover:text-red-500 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          )
        }
        return (
          <div>
            <label className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border-2 border-dashed text-sm cursor-pointer transition-colors ${error ? 'border-red-300' : 'border-gray-200 dark:border-gray-700 hover:border-violet-300'} ${disabled || !uploadFile ? 'opacity-50 cursor-not-allowed' : 'text-gray-500 dark:text-gray-400'}`}>
              {fileState === 'uploading' ? <><Loader2 className="w-4 h-4 animate-spin" /> Chargement…</> : <><Upload className="w-4 h-4" /> Choisir un fichier</>}
              <input
                type="file" className="hidden" disabled={disabled || !uploadFile || fileState === 'uploading'}
                onChange={async (e) => {
                  const f = e.target.files?.[0]
                  if (!f || !uploadFile) return
                  setFileState('uploading')
                  try { onChange(await uploadFile(f)); setFileState('idle') } catch { setFileState('error') }
                }}
              />
            </label>
            {fileState === 'error' && <p className="text-xs text-red-500 mt-1">Échec de l'envoi. Réessayez.</p>}
          </div>
        )
      }
      default:
        return (
          <input
            type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : field.type === 'email' ? 'email' : 'text'}
            value={(value as string) ?? ''}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            min={field.type === 'number' ? field.min : undefined}
            max={field.type === 'number' ? field.max : undefined}
            maxLength={field.maxLength}
            className={inputCls(error)}
          />
        )
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label className="block text-sm font-medium text-gray-800 dark:text-gray-200">
        {field.label || <span className="italic text-gray-400">Sans titre</span>}
        {field.required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {field.description && <p className="text-xs text-gray-500 dark:text-gray-400">{field.description}</p>}
      {renderInner()}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}
