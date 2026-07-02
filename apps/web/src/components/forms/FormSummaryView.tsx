'use client'

import type { FormFieldDef, FormResponseEntry } from '@pouetpouet/shared'

interface Props {
  fields: FormFieldDef[]
  responses: FormResponseEntry[]
}

// Barres horizontales simples (sans lib de charts) : largeur = part du max.
function BarChart({ entries, total }: { entries: { label: string; count: number }[]; total: number }) {
  const max = Math.max(1, ...entries.map((e) => e.count))
  return (
    <div className="flex flex-col gap-2">
      {entries.map((e) => (
        <div key={e.label} className="flex items-center gap-3">
          <span className="text-xs text-gray-600 dark:text-gray-300 w-32 truncate shrink-0" title={e.label}>{e.label || '—'}</span>
          <div className="flex-1 h-5 rounded-md bg-gray-100 dark:bg-gray-800 overflow-hidden">
            <div className="h-full bg-violet-400 dark:bg-violet-500 rounded-md transition-all" style={{ width: `${(e.count / max) * 100}%` }} />
          </div>
          <span className="text-xs text-gray-500 dark:text-gray-400 w-16 text-right shrink-0">
            {e.count} · {total > 0 ? Math.round((e.count / total) * 100) : 0}%
          </span>
        </div>
      ))}
    </div>
  )
}

function FieldSummary({ field, responses }: { field: FormFieldDef; responses: FormResponseEntry[] }) {
  const values = responses.map((r) => (r.data as Record<string, unknown>)?.[field.id]).filter((v) => v !== undefined && v !== null && v !== '')
  const answered = values.length

  let body: React.ReactNode

  if (field.type === 'dropdown' || field.type === 'radio' || field.type === 'checkboxes') {
    // Comptage par valeur (les cases à cocher aplatissent les tableaux).
    const counts = new Map<string, number>()
    for (const v of values) {
      const items = Array.isArray(v) ? (v as string[]) : [String(v)]
      for (const item of items) counts.set(item, (counts.get(item) ?? 0) + 1)
    }
    // Ordonne par options déclarées d'abord, puis le reste (réponses « Autre »).
    const ordered = [
      ...(field.options ?? []).map((o) => ({ label: o, count: counts.get(o) ?? 0 })),
      ...[...counts.keys()].filter((k) => !(field.options ?? []).includes(k)).map((k) => ({ label: k, count: counts.get(k)! })),
    ]
    body = <BarChart entries={ordered} total={answered} />
  } else if (field.type === 'scale') {
    const min = field.scaleMin ?? 1
    const max = field.scaleMax ?? 5
    const nums = values.map(Number).filter((n) => !Number.isNaN(n))
    const avg = nums.length ? (nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(2) : '—'
    const range = Array.from({ length: Math.max(0, max - min + 1) }, (_, i) => min + i)
    const entries = range.map((n) => ({ label: String(n), count: nums.filter((x) => x === n).length }))
    body = (
      <div className="flex flex-col gap-2">
        <p className="text-xs text-gray-500 dark:text-gray-400">Moyenne : <strong className="text-gray-700 dark:text-gray-200">{avg}</strong></p>
        <BarChart entries={entries} total={nums.length} />
      </div>
    )
  } else if (field.type === 'grid') {
    const rows = field.gridRows ?? []
    const cols = field.gridCols ?? []
    // Compte par (ligne, colonne).
    const count = (row: string, col: string) => values.filter((v) => {
      const cell = (v as Record<string, unknown>)?.[row]
      return Array.isArray(cell) ? (cell as string[]).includes(col) : cell === col
    }).length
    body = (
      <div className="overflow-x-auto">
        <table className="text-sm border-collapse">
          <thead>
            <tr>
              <th />
              {cols.map((c) => <th key={c} className="px-3 py-1 text-xs font-medium text-gray-500 dark:text-gray-400 text-center">{c}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r} className="border-t border-gray-100 dark:border-gray-800">
                <td className="pr-3 py-1 text-xs text-gray-600 dark:text-gray-300 whitespace-nowrap">{r}</td>
                {cols.map((c) => <td key={c} className="px-3 py-1 text-center text-sm dark:text-gray-200">{count(r, c)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  } else if (field.type === 'file') {
    body = <p className="text-sm text-gray-600 dark:text-gray-300">{answered} fichier{answered > 1 ? 's' : ''} envoyé{answered > 1 ? 's' : ''} (voir le tableau pour les télécharger).</p>
  } else if (field.type === 'number') {
    const nums = values.map(Number).filter((n) => !Number.isNaN(n))
    if (nums.length === 0) body = <p className="text-sm text-gray-400 italic">Aucune réponse.</p>
    else {
      const avg = (nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(2)
      body = (
        <div className="flex gap-6 text-sm">
          <div><span className="text-gray-400 text-xs block">Moyenne</span><strong className="dark:text-gray-200">{avg}</strong></div>
          <div><span className="text-gray-400 text-xs block">Min</span><strong className="dark:text-gray-200">{Math.min(...nums)}</strong></div>
          <div><span className="text-gray-400 text-xs block">Max</span><strong className="dark:text-gray-200">{Math.max(...nums)}</strong></div>
        </div>
      )
    }
  } else {
    // Texte / date / email : liste des réponses (jusqu'à 50).
    const shown = values.slice(0, 50)
    body = answered === 0 ? (
      <p className="text-sm text-gray-400 italic">Aucune réponse.</p>
    ) : (
      <div className="flex flex-col gap-1 max-h-60 overflow-y-auto">
        {shown.map((v, i) => (
          <p key={i} className="text-sm text-gray-700 dark:text-gray-300 px-3 py-1.5 rounded-lg bg-gray-50 dark:bg-gray-800 truncate">{String(v)}</p>
        ))}
        {values.length > shown.length && <p className="text-xs text-gray-400">+ {values.length - shown.length} autres</p>}
      </div>
    )
  }

  return (
    <div className="p-5 rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 flex flex-col gap-3">
      <div>
        <h3 className="font-semibold text-sm dark:text-white">{field.label || 'Sans titre'}</h3>
        <p className="text-xs text-gray-400">{answered} réponse{answered > 1 ? 's' : ''}</p>
      </div>
      {body}
    </div>
  )
}

export function FormSummaryView({ fields, responses }: Props) {
  const dataFields = fields.filter((f) => f.type !== 'section')
  if (dataFields.length === 0) return <p className="text-sm text-gray-400 italic">Aucun champ.</p>
  return (
    <div className="flex flex-col gap-4">
      {dataFields.map((f) => <FieldSummary key={f.id} field={f} responses={responses} />)}
    </div>
  )
}
