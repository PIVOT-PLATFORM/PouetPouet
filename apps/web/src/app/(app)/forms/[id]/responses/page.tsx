'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Download, Inbox, Table, BarChart3, Eye, Trash2, X, FileText, ChevronLeft, ChevronRight, User } from 'lucide-react'
import { useForm, useFormResponses } from '@/hooks/useForms'
import { useFlagGuard } from '@/hooks/useFlagGuard'
import { FormSummaryView } from '@/components/forms/FormSummaryView'
import type { FormFieldDef, FormResponseEntry, FormFileValue } from '@pouetpouet/shared'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'

function isFileValue(v: unknown): v is FormFileValue {
  return !!v && typeof v === 'object' && 'key' in (v as object)
}

async function authedDownload(url: string, filename: string) {
  const token = localStorage.getItem('token')
  const res = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
  if (!res.ok) return
  const blob = await res.blob()
  const objUrl = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = objUrl
  a.download = filename
  a.click()
  URL.revokeObjectURL(objUrl)
}

function CellValue({ field, value, formId }: { field: FormFieldDef; value: unknown; formId: string }) {
  if (isFileValue(value)) {
    return (
      <button
        onClick={() => authedDownload(`${API_URL}/api/forms/${formId}/files/${value.key}`, value.filename)}
        className="inline-flex items-center gap-1 text-violet-600 dark:text-violet-400 hover:underline"
      >
        <FileText className="w-3.5 h-3.5" /> {value.filename}
      </button>
    )
  }
  if (field.type === 'grid' && value && typeof value === 'object' && !Array.isArray(value)) {
    const entries = Object.entries(value as Record<string, unknown>)
    if (entries.length === 0) return <span className="text-gray-300">—</span>
    return <>{entries.map(([row, col]) => `${row}: ${Array.isArray(col) ? col.join('/') : String(col)}`).join(' · ')}</>
  }
  if (Array.isArray(value)) return <>{value.join(', ')}</>
  if (value == null || value === '') return <span className="text-gray-300">—</span>
  return <>{String(value)}</>
}

export default function FormResponsesPage() {
  useFlagGuard('module.forms')
  const { id } = useParams<{ id: string }>()
  const { form, isLoading: formLoading } = useForm(id)
  const { responses, isLoading, deleteResponse } = useFormResponses(id)
  const [view, setView] = useState<'individual' | 'summary' | 'table'>('individual')
  const [individualIdx, setIndividualIdx] = useState(0)
  const [detail, setDetail] = useState<FormResponseEntry | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  // Colonnes = champs de saisie (les sections ne stockent pas de donnée).
  const dataFields = (form?.fields ?? []).filter((f) => f.type !== 'section')

  async function exportCsv() {
    await authedDownload(`${API_URL}/api/forms/${id}/responses.csv`, `reponses-${form?.title ?? id}.csv`)
  }

  async function handleDelete(responseId: string) {
    if (!confirm('Supprimer cette réponse ?')) return
    setDeleting(responseId)
    try {
      await deleteResponse(responseId)
      if (detail?.id === responseId) setDetail(null)
      if (individualIdx >= responses.length - 1) setIndividualIdx(Math.max(0, individualIdx - 1))
    } finally { setDeleting(null) }
  }

  if (formLoading || isLoading) return (
    <div className="flex justify-center py-20"><div className="w-7 h-7 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" /></div>
  )
  if (!form) return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <p className="text-gray-500 dark:text-gray-400">Formulaire introuvable.</p>
      <Link href="/forms" className="text-violet-500 hover:underline text-sm">← Mes formulaires</Link>
    </div>
  )

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <Link href={`/forms/${id}/edit`} className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 mb-1 inline-block">← {form.title}</Link>
          <h1 className="text-2xl font-bold dark:text-white">Réponses <span className="text-gray-400 font-normal">({responses.length})</span></h1>
        </div>
        {responses.length > 0 && (
          <div className="flex items-center gap-2">
            <div className="flex rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
              <button onClick={() => setView('individual')} className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors ${view === 'individual' ? 'bg-violet-500 text-white' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
                <User className="w-4 h-4" /> Individuel
              </button>
              <button onClick={() => setView('summary')} className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors ${view === 'summary' ? 'bg-violet-500 text-white' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
                <BarChart3 className="w-4 h-4" /> Résumé
              </button>
              <button onClick={() => setView('table')} className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors ${view === 'table' ? 'bg-violet-500 text-white' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
                <Table className="w-4 h-4" /> Tableau
              </button>
            </div>
            <button onClick={exportCsv} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-500 hover:bg-violet-600 text-white text-sm font-medium transition-colors">
              <Download className="w-4 h-4" /> CSV
            </button>
          </div>
        )}
      </div>

      {responses.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
          <Inbox className="w-12 h-12 text-gray-300 dark:text-gray-600" />
          <p className="text-gray-500 dark:text-gray-400">Aucune réponse pour l'instant.</p>
        </div>
      ) : view === 'individual' ? (() => {
        const idx = Math.min(individualIdx, responses.length - 1)
        const r = responses[idx]
        const data = (r.data ?? {}) as Record<string, unknown>
        const isEmpty = (v: unknown) => v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0)
        return (
          <div className="flex flex-col gap-4 max-w-2xl mx-auto w-full">
            {/* Barre de navigation */}
            <div className="flex items-center justify-between gap-4">
              <button
                onClick={() => setIndividualIdx(Math.max(0, idx - 1))}
                disabled={idx === 0}
                className="p-2 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div className="flex-1 text-center">
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  Réponse <span className="text-gray-900 dark:text-white font-semibold">{idx + 1}</span> sur {responses.length}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">{new Date(r.createdAt).toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' })}</p>
              </div>
              <button
                onClick={() => setIndividualIdx(Math.min(responses.length - 1, idx + 1))}
                disabled={idx === responses.length - 1}
                className="p-2 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            {/* Corps — formulaire rempli */}
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 divide-y divide-gray-100 dark:divide-gray-800">
              {form.fields.map((f) => {
                if (f.type === 'section') return (
                  <div key={f.id} className="px-6 py-5 bg-violet-50/60 dark:bg-violet-950/20">
                    <p className="text-sm font-semibold text-violet-700 dark:text-violet-300">{f.label}</p>
                    {f.description && <p className="text-xs text-violet-500 dark:text-violet-400 mt-0.5">{f.description}</p>}
                  </div>
                )
                const val = data[f.id]
                const unanswered = isEmpty(val)
                return (
                  <div key={f.id} className="px-6 py-5">
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-2.5">
                      {f.label || 'Sans titre'}
                      {f.required && <span className="text-red-400 ml-0.5">*</span>}
                    </p>
                    {unanswered ? (
                      <p className="text-sm text-gray-300 dark:text-gray-600 italic">Sans réponse</p>
                    ) : (
                      <div className="text-sm text-violet-700 dark:text-violet-300 font-medium">
                        <CellValue field={f} value={val} formId={id} />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Supprimer */}
            <div className="flex justify-end">
              <button
                onClick={() => handleDelete(r.id)}
                disabled={deleting === r.id}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 text-xs font-medium hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" /> Supprimer cette réponse
              </button>
            </div>
          </div>
        )
      })() : view === 'summary' ? (
        <FormSummaryView fields={form.fields} responses={responses} />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-gray-100 dark:border-gray-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-800/50 text-left">
                <th className="px-4 py-3 font-medium text-gray-400 whitespace-nowrap">Date</th>
                {dataFields.map((f) => (
                  <th key={f.id} className="px-4 py-3 font-medium text-gray-500 dark:text-gray-300 whitespace-nowrap">{f.label || 'Sans titre'}</th>
                ))}
                <th className="px-4 py-3 w-20" />
              </tr>
            </thead>
            <tbody>
              {responses.map((r) => {
                const data = (r.data ?? {}) as Record<string, unknown>
                return (
                  <tr key={r.id} className="border-t border-gray-100 dark:border-gray-800 hover:bg-gray-50/50 dark:hover:bg-gray-800/30">
                    <td className="px-4 py-3 text-gray-400 whitespace-nowrap">{new Date(r.createdAt).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}</td>
                    {dataFields.map((f) => (
                      <td key={f.id} className="px-4 py-3 dark:text-gray-200 max-w-xs truncate"><CellValue field={f} value={data[f.id]} formId={id} /></td>
                    ))}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <button onClick={() => setDetail(r)} title="Voir" className="p-1.5 rounded-lg text-gray-400 hover:text-violet-500 hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-colors"><Eye className="w-3.5 h-3.5" /></button>
                        <button onClick={() => handleDelete(r.id)} disabled={deleting === r.id} title="Supprimer" className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-40 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modale détail réponse */}
      {detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setDetail(null)}>
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto p-6 flex flex-col gap-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold dark:text-white">Réponse</h2>
              <button onClick={() => setDetail(null)} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"><X className="w-4 h-4" /></button>
            </div>
            <p className="text-xs text-gray-400 -mt-2">{new Date(detail.createdAt).toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' })}</p>
            <div className="flex flex-col gap-3">
              {dataFields.map((f) => (
                <div key={f.id}>
                  <p className="text-xs font-medium text-gray-400">{f.label || 'Sans titre'}</p>
                  <div className="text-sm dark:text-gray-200 mt-0.5">
                    <CellValue field={f} value={(detail.data as Record<string, unknown>)[f.id]} formId={id} />
                  </div>
                </div>
              ))}
            </div>
            <button onClick={() => handleDelete(detail.id)} disabled={deleting === detail.id} className="self-start flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 text-xs font-medium hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 transition-colors">
              <Trash2 className="w-3.5 h-3.5" /> Supprimer cette réponse
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
