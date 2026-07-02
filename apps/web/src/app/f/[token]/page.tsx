'use client'

import { useState, useEffect, useMemo } from 'react'
import { useParams } from 'next/navigation'
import { CheckCircle2, AlertCircle } from 'lucide-react'
import { api, ApiError } from '@/lib/api'
import { FormFieldInput } from '@/components/forms/FormFieldInput'
import { FORM_SUBMIT_TARGET } from '@pouetpouet/shared'
import type { PublicForm, FormFieldDef, FormFileValue } from '@pouetpouet/shared'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'

interface Page { section: FormFieldDef | null; fields: FormFieldDef[] }

function buildPages(fields: FormFieldDef[]): Page[] {
  const pages: Page[] = []
  let cur: Page = { section: null, fields: [] }
  for (const f of fields) {
    if (f.type === 'section') { pages.push(cur); cur = { section: f, fields: [] } }
    else cur.fields.push(f)
  }
  pages.push(cur)
  // Retire une page d'intro vide si des sections suivent.
  if (pages.length > 1 && pages[0].section === null && pages[0].fields.length === 0) pages.shift()
  return pages
}

function fieldError(f: FormFieldDef, v: unknown): string | null {
  const empty = v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0)
  if (empty) return f.required ? 'Ce champ est requis' : null
  if (f.type === 'number') {
    const n = Number(v)
    if (Number.isNaN(n)) return 'Nombre invalide'
    if (f.min != null && n < f.min) return `Doit être ≥ ${f.min}`
    if (f.max != null && n > f.max) return `Doit être ≤ ${f.max}`
  }
  if ((f.type === 'short_text' || f.type === 'long_text') && typeof v === 'string' && f.maxLength != null && v.length > f.maxLength) {
    return `Maximum ${f.maxLength} caractères`
  }
  if (f.type === 'short_text' && f.pattern && typeof v === 'string') {
    try { if (!new RegExp(f.pattern).test(v)) return 'Format invalide' } catch { /* regex invalide ignorée */ }
  }
  if (f.type === 'grid' && f.required) {
    const ans = (v ?? {}) as Record<string, unknown>
    for (const row of f.gridRows ?? []) {
      const rv = ans[row]
      if (rv == null || rv === '' || (Array.isArray(rv) && rv.length === 0)) return 'Répondez à toutes les lignes'
    }
  }
  return null
}

const CLOSED_MESSAGE: Record<string, string> = {
  date: 'La date limite de ce formulaire est dépassée.',
  max: 'Ce formulaire a atteint son nombre maximum de réponses.',
  manual: 'Ce formulaire n\'accepte plus de réponses.',
}

export default function PublicFormPage() {
  const { token } = useParams<{ token: string }>()
  const [form, setForm] = useState<PublicForm | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [data, setData] = useState<Record<string, unknown>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [pageStack, setPageStack] = useState<number[]>([0])
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [alreadyDone, setAlreadyDone] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const doneKey = `pivot_form_done_${token}`
  const pages = useMemo(() => (form ? buildPages(form.fields) : []), [form])

  useEffect(() => {
    api.get<PublicForm>(`/api/forms/public/${token}`)
      .then((f) => {
        setForm(f)
        if (f.limitOneResponse && typeof window !== 'undefined' && localStorage.getItem(doneKey)) setAlreadyDone(true)
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false))
  }, [token, doneKey])

  function setField(id: string, value: unknown) {
    setData((p) => ({ ...p, [id]: value }))
    setErrors((e) => { if (!e[id]) return e; const n = { ...e }; delete n[id]; return n })
  }

  function validatePage(page: Page): boolean {
    const errs: Record<string, string> = {}
    for (const f of page.fields) {
      const err = fieldError(f, data[f.id])
      if (err) errs[f.id] = err
    }
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  // Détermine la page suivante (logique conditionnelle) ou 'submit'.
  function resolveNext(idx: number): number | 'submit' {
    let target: string | undefined
    for (const f of pages[idx].fields) {
      if (f.optionRouting) {
        const v = data[f.id]
        if (typeof v === 'string' && f.optionRouting[v]) target = f.optionRouting[v]
      }
    }
    if (target === FORM_SUBMIT_TARGET) return 'submit'
    if (target) { const i = pages.findIndex((p) => p.section?.id === target); if (i >= 0) return i }
    return idx + 1 < pages.length ? idx + 1 : 'submit'
  }

  async function uploadFile(file: File): Promise<FormFileValue> {
    const res = await fetch(`${API_URL}/api/forms/public/${token}/upload`, {
      method: 'POST',
      headers: { 'X-Filename': encodeURIComponent(file.name) },
      body: file,
    })
    if (!res.ok) throw new Error('upload failed')
    return res.json() as Promise<FormFileValue>
  }

  async function submit() {
    setSubmitting(true)
    setSubmitError(null)
    try {
      await api.post(`/api/forms/public/${token}/responses`, { data })
      if (form?.limitOneResponse && typeof window !== 'undefined') localStorage.setItem(doneKey, '1')
      setSubmitted(true)
      if (form?.redirectUrl && typeof window !== 'undefined') setTimeout(() => { window.location.href = form.redirectUrl! }, 1500)
    } catch (e) {
      setSubmitError(e instanceof ApiError ? e.message : 'Une erreur est survenue. Réessayez.')
    } finally {
      setSubmitting(false)
    }
  }

  const currentIdx = pageStack[pageStack.length - 1]
  function goNext() {
    const page = pages[currentIdx]
    if (!validatePage(page)) return
    const next = resolveNext(currentIdx)
    if (next === 'submit') submit()
    else setPageStack((s) => [...s, next])
  }
  function goBack() { setPageStack((s) => s.slice(0, -1)) }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
      <div className="w-7 h-7 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )
  if (notFound || !form) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-gray-50 dark:bg-gray-950 px-4 text-center">
      <AlertCircle className="w-10 h-10 text-gray-300" />
      <p className="text-gray-500 dark:text-gray-400">Ce formulaire est introuvable ou n'est plus disponible.</p>
    </div>
  )
  if (submitted) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-gray-50 dark:bg-gray-950 px-4 text-center">
      <CheckCircle2 className="w-12 h-12 text-green-500" />
      <h1 className="text-xl font-semibold dark:text-white">Merci !</h1>
      <p className="text-gray-500 dark:text-gray-400 max-w-md whitespace-pre-wrap">{form.confirmationMessage || 'Votre réponse a bien été enregistrée.'}</p>
      {form.redirectUrl && <p className="text-xs text-gray-400">Redirection en cours…</p>}
    </div>
  )
  if (alreadyDone) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-gray-50 dark:bg-gray-950 px-4 text-center">
      <CheckCircle2 className="w-12 h-12 text-green-500" />
      <h1 className="text-xl font-semibold dark:text-white">Vous avez déjà répondu</h1>
      <p className="text-gray-500 dark:text-gray-400">Ce formulaire n'accepte qu'une réponse par personne.</p>
    </div>
  )

  const multiPage = pages.length > 1
  const page = pages[currentIdx]
  const next = resolveNext(currentIdx)
  const isTerminal = next === 'submit'

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 py-10 px-4">
      <div className="max-w-2xl mx-auto flex flex-col gap-5">
        <div className="p-6 rounded-2xl border-t-4 border-violet-500 border-x border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900">
          <h1 className="text-2xl font-bold dark:text-white">{form.title}</h1>
          {form.description && <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 whitespace-pre-wrap">{form.description}</p>}
          {multiPage && (
            <div className="mt-4">
              <div className="h-1.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                <div className="h-full bg-violet-400 rounded-full transition-all" style={{ width: `${((pageStack.length) / pages.length) * 100}%` }} />
              </div>
              <p className="text-[11px] text-gray-400 mt-1">Étape {pageStack.length} sur {pages.length}</p>
            </div>
          )}
        </div>

        {!form.acceptingResponses ? (
          <div className="p-6 rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 text-center text-gray-500 dark:text-gray-400">
            {CLOSED_MESSAGE[form.closedReason ?? 'manual']}
          </div>
        ) : (
          <>
            {page.section && (
              <div className="px-2">
                <h2 className="text-lg font-semibold dark:text-white">{page.section.label || 'Section'}</h2>
                {page.section.description && <p className="text-sm text-gray-500 dark:text-gray-400 whitespace-pre-wrap">{page.section.description}</p>}
              </div>
            )}

            {page.fields.map((f) => (
              <div key={f.id} className="p-5 rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900">
                <FormFieldInput field={f} value={data[f.id]} onChange={(v) => setField(f.id, v)} error={errors[f.id]} disabled={submitting} uploadFile={uploadFile} />
              </div>
            ))}

            {submitError && (
              <div className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" /> {submitError}
              </div>
            )}

            <div className="flex items-center gap-3">
              {pageStack.length > 1 && (
                <button onClick={goBack} disabled={submitting} className="px-5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 transition-colors">
                  Retour
                </button>
              )}
              <button onClick={goNext} disabled={submitting} className="px-6 py-2.5 rounded-xl bg-violet-500 hover:bg-violet-600 disabled:opacity-50 text-white text-sm font-medium transition-colors">
                {submitting ? 'Envoi…' : isTerminal ? 'Envoyer' : 'Suivant'}
              </button>
            </div>
          </>
        )}

        <p className="text-center text-xs text-gray-400 mt-2">Propulsé par Pivot</p>
      </div>
    </div>
  )
}
