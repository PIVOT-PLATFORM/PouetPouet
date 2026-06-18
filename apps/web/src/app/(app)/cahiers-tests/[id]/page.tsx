'use client'

import { use, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTestBook } from '@/hooks/useTestBooks'
import type { TestSection, TestCase, TestCaseStatus, TestBookStatus } from '@/hooks/useTestBooks'

const STATUS_LABELS: Record<TestBookStatus, string> = {
  DRAFT: 'Brouillon',
  REVIEW: 'En revue',
  APPROVED: 'Approuvé',
  ARCHIVED: 'Archivé',
}
const BOOK_STATUSES: TestBookStatus[] = ['DRAFT', 'REVIEW', 'APPROVED', 'ARCHIVED']

const CASE_STATUS_LABELS: Record<TestCaseStatus, string> = {
  TODO: 'À faire',
  PASS: 'OK',
  FAIL: 'KO',
  BLOCKED: 'Bloqué',
  SKIP: 'Ignoré',
}
const CASE_STATUS_COLORS: Record<TestCaseStatus, string> = {
  TODO: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
  PASS: 'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-400',
  FAIL: 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400',
  BLOCKED: 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400',
  SKIP: 'bg-gray-50 text-gray-400 dark:bg-gray-900 dark:text-gray-500',
}
const CASE_STATUSES: TestCaseStatus[] = ['TODO', 'PASS', 'FAIL', 'BLOCKED', 'SKIP']

// ── Cas de test (ligne éditable) ────────────────────────────────────────────────

function CaseRow({ tc, onUpdate, onDelete }: {
  tc: TestCase
  onUpdate: (patch: Partial<TestCase>) => Promise<unknown>
  onDelete: () => Promise<unknown>
}) {
  const [expanded, setExpanded] = useState(false)
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(tc.title)
  const [precondition, setPrecondition] = useState(tc.precondition ?? '')
  const [steps, setSteps] = useState(tc.steps ?? '')
  const [expected, setExpected] = useState(tc.expected ?? '')
  const [saving, setSaving] = useState(false)

  async function saveDetails() {
    setSaving(true)
    try {
      await onUpdate({ title: title.trim() || tc.title, precondition: precondition.trim() || null, steps: steps.trim() || null, expected: expected.trim() || null })
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  const ta = 'border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 w-full resize-none'

  return (
    <div className="border border-gray-100 dark:border-gray-800 rounded-xl overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2.5 bg-white dark:bg-gray-900">
        {/* Status badge */}
        <select
          value={tc.status}
          onChange={(e) => onUpdate({ status: e.target.value as TestCaseStatus })}
          className={`shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded-full border-0 cursor-pointer focus:ring-2 focus:ring-primary-400 focus:outline-none ${CASE_STATUS_COLORS[tc.status]}`}
        >
          {CASE_STATUSES.map((s) => <option key={s} value={s}>{CASE_STATUS_LABELS[s]}</option>)}
        </select>

        {/* Title */}
        <span className="flex-1 text-sm text-gray-800 dark:text-gray-200 font-medium truncate">{tc.title}</span>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => { setEditing((v) => !v); setExpanded(true) }}
            className="text-xs text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 px-1.5 py-1 rounded transition-colors"
            title="Modifier"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </button>
          <button
            onClick={() => setExpanded((v) => !v)}
            className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 px-1.5 py-1 rounded transition-colors"
            title={expanded ? 'Réduire' : 'Développer'}
          >
            <svg className={`w-3.5 h-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          <button
            onClick={() => { if (confirm(`Supprimer le cas « ${tc.title} » ?`)) onDelete() }}
            className="text-xs text-gray-300 hover:text-red-500 px-1.5 py-1 rounded transition-colors"
            title="Supprimer"
          >✕</button>
        </div>
      </div>

      {expanded && (
        <div className="px-3 pb-3 bg-gray-50 dark:bg-gray-950 border-t border-gray-100 dark:border-gray-800">
          {editing ? (
            <div className="flex flex-col gap-2 pt-3">
              <div>
                <label className="block text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Titre</label>
                <input value={title} onChange={(e) => setTitle(e.target.value)} className="border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 w-full" />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Précondition</label>
                <textarea value={precondition} onChange={(e) => setPrecondition(e.target.value)} rows={2} placeholder="État initial requis…" className={ta} />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Étapes</label>
                <textarea value={steps} onChange={(e) => setSteps(e.target.value)} rows={3} placeholder="1. Aller sur la page…&#10;2. Cliquer sur…" className={ta} />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Résultat attendu</label>
                <textarea value={expected} onChange={(e) => setExpected(e.target.value)} rows={2} placeholder="La page affiche…" className={ta} />
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={saveDetails} disabled={saving} className="px-3 py-1.5 text-xs font-semibold text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50 rounded-lg">
                  {saving ? 'Enreg…' : 'Enregistrer'}
                </button>
                <button onClick={() => { setEditing(false); setTitle(tc.title); setPrecondition(tc.precondition ?? ''); setSteps(tc.steps ?? ''); setExpected(tc.expected ?? '') }}
                  className="px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
                  Annuler
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2 pt-3 text-sm text-gray-600 dark:text-gray-300">
              {tc.precondition && (
                <div>
                  <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wide mb-0.5">Précondition</p>
                  <p className="whitespace-pre-wrap">{tc.precondition}</p>
                </div>
              )}
              {tc.steps && (
                <div>
                  <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wide mb-0.5">Étapes</p>
                  <p className="whitespace-pre-wrap">{tc.steps}</p>
                </div>
              )}
              {tc.expected && (
                <div>
                  <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wide mb-0.5">Résultat attendu</p>
                  <p className="whitespace-pre-wrap">{tc.expected}</p>
                </div>
              )}
              {!tc.precondition && !tc.steps && !tc.expected && (
                <p className="text-gray-400 dark:text-gray-500 italic text-xs">Aucun détail. Cliquez sur le crayon pour en ajouter.</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Section ──────────────────────────────────────────────────────────────────────

function SectionBlock({ section, onUpdateSection, onDeleteSection, onAddCase, onUpdateCase, onDeleteCase }: {
  section: TestSection
  onUpdateSection: (patch: Partial<TestSection>) => Promise<unknown>
  onDeleteSection: () => Promise<void>
  onAddCase: (input: { title: string }) => Promise<unknown>
  onUpdateCase: (caseId: string, patch: Partial<{ title: string; precondition: string | null; steps: string | null; expected: string | null; status: TestCaseStatus; order: number }>) => Promise<unknown>
  onDeleteCase: (caseId: string) => Promise<void>
}) {
  const [collapsed, setCollapsed] = useState(false)
  const [editingTitle, setEditingTitle] = useState(false)
  const [title, setTitle] = useState(section.title)
  const [addingCase, setAddingCase] = useState(false)
  const [newCaseTitle, setNewCaseTitle] = useState('')

  async function saveTitle() {
    if (title.trim()) await onUpdateSection({ title: title.trim() })
    setEditingTitle(false)
  }

  async function submitCase(e: React.FormEvent) {
    e.preventDefault()
    if (!newCaseTitle.trim()) return
    await onAddCase({ title: newCaseTitle.trim() })
    setNewCaseTitle('')
    setAddingCase(false)
  }

  const passCount = section.cases.filter((c) => c.status === 'PASS').length
  const failCount = section.cases.filter((c) => c.status === 'FAIL').length
  const total = section.cases.length

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden">
      {/* Header section */}
      <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 dark:bg-gray-950 border-b border-gray-100 dark:border-gray-800">
        <button onClick={() => setCollapsed((v) => !v)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
          <svg className={`w-4 h-4 transition-transform ${collapsed ? '-rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {editingTitle ? (
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={saveTitle}
            onKeyDown={(e) => { if (e.key === 'Enter') saveTitle(); if (e.key === 'Escape') { setTitle(section.title); setEditingTitle(false) } }}
            className="flex-1 text-sm font-semibold bg-transparent border-b border-primary-400 focus:outline-none text-gray-900 dark:text-white"
          />
        ) : (
          <button onClick={() => setEditingTitle(true)} className="flex-1 text-left text-sm font-semibold text-gray-900 dark:text-white hover:text-primary-600 dark:hover:text-primary-400 transition-colors">
            {section.title}
          </button>
        )}

        <div className="flex items-center gap-2 shrink-0 ml-auto">
          {total > 0 && (
            <span className="text-xs text-gray-400">
              {passCount > 0 && <span className="text-green-600 dark:text-green-400 font-medium">{passCount} OK</span>}
              {failCount > 0 && <><span className="text-gray-300 dark:text-gray-600 mx-1">·</span><span className="text-red-600 dark:text-red-400 font-medium">{failCount} KO</span></>}
              {total > 0 && <><span className="text-gray-300 dark:text-gray-600 mx-1">·</span>{total} cas</>}
            </span>
          )}
          <button onClick={() => setAddingCase(true)} className="text-xs text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-950 px-2 py-1 rounded-lg font-medium transition-colors">
            + Cas
          </button>
          <button
            onClick={() => { if (confirm(`Supprimer la section « ${section.title} » et tous ses cas ?`)) onDeleteSection() }}
            className="text-gray-300 hover:text-red-500 text-sm px-1 transition-colors"
            title="Supprimer la section"
          >✕</button>
        </div>
      </div>

      {!collapsed && (
        <div className="p-3 flex flex-col gap-2">
          {section.cases.map((tc) => (
            <CaseRow
              key={tc.id}
              tc={tc}
              onUpdate={(patch) => onUpdateCase(tc.id, patch)}
              onDelete={() => onDeleteCase(tc.id)}
            />
          ))}

          {section.cases.length === 0 && !addingCase && (
            <p className="text-xs text-gray-400 dark:text-gray-500 italic text-center py-3">
              Aucun cas. <button onClick={() => setAddingCase(true)} className="text-primary-600 hover:underline">Ajouter le premier</button>
            </p>
          )}

          {addingCase && (
            <form onSubmit={submitCase} className="flex gap-2 pt-1">
              <input
                autoFocus
                value={newCaseTitle}
                onChange={(e) => setNewCaseTitle(e.target.value)}
                placeholder="Titre du cas de test…"
                className="flex-1 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
                onKeyDown={(e) => { if (e.key === 'Escape') { setAddingCase(false); setNewCaseTitle('') } }}
              />
              <button type="submit" disabled={!newCaseTitle.trim()} className="px-3 py-1.5 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50 rounded-lg">Ajouter</button>
              <button type="button" onClick={() => { setAddingCase(false); setNewCaseTitle('') }} className="px-3 py-1.5 text-sm text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">Annuler</button>
            </form>
          )}
        </div>
      )}
    </div>
  )
}

// ── Page principale ──────────────────────────────────────────────────────────────

export default function TestBookDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const { book, isLoading, error, updateBook, deleteBook, addSection, updateSection, deleteSection, addCase, updateCase, deleteCase } = useTestBook(id)

  const [editingTitle, setEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState('')
  const [addingSect, setAddingSect] = useState(false)
  const [newSectTitle, setNewSectTitle] = useState('')

  async function saveTitle() {
    if (titleDraft.trim() && book) await updateBook({ title: titleDraft.trim() })
    setEditingTitle(false)
  }

  async function submitSection(e: React.FormEvent) {
    e.preventDefault()
    if (!newSectTitle.trim()) return
    await addSection(newSectTitle.trim())
    setNewSectTitle('')
    setAddingSect(false)
  }

  if (isLoading) return <div className="text-sm text-gray-400 py-8 text-center">Chargement…</div>
  if (error || !book) return (
    <div className="text-center py-8">
      <p className="text-red-500 mb-4">{error ?? 'Cahier introuvable'}</p>
      <Link href="/cahiers-tests" className="text-primary-600 hover:underline text-sm">← Retour à la liste</Link>
    </div>
  )

  const totalCases = book.sections.reduce((sum, s) => sum + s.cases.length, 0)
  const passCases = book.sections.reduce((sum, s) => sum + s.cases.filter((c) => c.status === 'PASS').length, 0)
  const failCases = book.sections.reduce((sum, s) => sum + s.cases.filter((c) => c.status === 'FAIL').length, 0)

  return (
    <div className="flex flex-col gap-6 max-w-4xl">
      {/* Breadcrumb */}
      <Link href="/cahiers-tests" className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Cahiers de tests
      </Link>

      {/* En-tête */}
      <div className="flex flex-wrap items-start gap-4">
        <div className="flex-1 min-w-0">
          {editingTitle ? (
            <input
              autoFocus
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onBlur={saveTitle}
              onKeyDown={(e) => { if (e.key === 'Enter') saveTitle(); if (e.key === 'Escape') setEditingTitle(false) }}
              className="text-3xl font-bold bg-transparent border-b-2 border-primary-400 focus:outline-none text-gray-900 dark:text-white w-full"
            />
          ) : (
            <button
              onClick={() => { setTitleDraft(book.title); setEditingTitle(true) }}
              className="text-left group"
            >
              <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 tracking-tight group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                {book.title}
              </h1>
            </button>
          )}
          {book.description && <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{book.description}</p>}
        </div>

        {/* Statut + version */}
        <div className="flex items-center gap-3 shrink-0">
          {book.version && (
            <span className="text-sm font-mono bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 px-2 py-1 rounded-lg">
              {book.version}
            </span>
          )}
          <select
            value={book.status}
            onChange={(e) => updateBook({ status: e.target.value as TestBookStatus })}
            className="text-sm border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-400"
          >
            {BOOK_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
          </select>
          <button
            onClick={() => { if (confirm(`Supprimer le cahier « ${book.title} » ?`)) { void (async () => { await deleteBook(); router.push('/cahiers-tests') })() } }}
            className="text-sm text-gray-400 hover:text-red-500 transition-colors px-2 py-1 rounded-lg"
            title="Supprimer le cahier"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>

      {/* Stats globales */}
      {totalCases > 0 && (
        <div className="flex items-center gap-4 px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl text-sm">
          <span className="text-gray-500 dark:text-gray-400">{book.sections.length} section{book.sections.length !== 1 ? 's' : ''}</span>
          <span className="text-gray-300 dark:text-gray-700">·</span>
          <span className="text-gray-500 dark:text-gray-400">{totalCases} cas</span>
          {passCases > 0 && <><span className="text-gray-300 dark:text-gray-700">·</span><span className="text-green-600 dark:text-green-400 font-medium">{passCases} OK</span></>}
          {failCases > 0 && <><span className="text-gray-300 dark:text-gray-700">·</span><span className="text-red-600 dark:text-red-400 font-medium">{failCases} KO</span></>}
          {totalCases > 0 && (
            <div className="ml-auto flex items-center gap-2">
              <div className="w-32 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div className="h-full bg-green-500 rounded-full" style={{ width: `${(passCases / totalCases) * 100}%` }} />
              </div>
              <span className="text-gray-400 text-xs">{Math.round((passCases / totalCases) * 100)}%</span>
            </div>
          )}
        </div>
      )}

      {/* Sections */}
      <div className="flex flex-col gap-4">
        {book.sections.map((section) => (
          <SectionBlock
            key={section.id}
            section={section}
            onUpdateSection={(patch) => updateSection(section.id, patch)}
            onDeleteSection={() => deleteSection(section.id)}
            onAddCase={(input) => addCase(section.id, input)}
            onUpdateCase={updateCase}
            onDeleteCase={deleteCase}
          />
        ))}

        {book.sections.length === 0 && !addingSect && (
          <div className="text-center py-16 border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-2xl">
            <p className="text-3xl mb-2">📋</p>
            <p className="font-medium text-gray-700 dark:text-gray-300 mb-1">Aucune section</p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">Commencez par créer une section (ex. Authentification, Tableau de bord…)</p>
            <button onClick={() => setAddingSect(true)} className="px-4 py-2 text-sm font-semibold text-white bg-primary-600 hover:bg-primary-700 rounded-xl">
              Ajouter une section
            </button>
          </div>
        )}

        {/* Ajout section */}
        {addingSect ? (
          <form onSubmit={submitSection} className="flex gap-2">
            <input
              autoFocus
              value={newSectTitle}
              onChange={(e) => setNewSectTitle(e.target.value)}
              placeholder="Nom de la section…"
              className="flex-1 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
              onKeyDown={(e) => { if (e.key === 'Escape') { setAddingSect(false); setNewSectTitle('') } }}
            />
            <button type="submit" disabled={!newSectTitle.trim()} className="px-4 py-2 text-sm font-semibold text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50 rounded-xl">Ajouter</button>
            <button type="button" onClick={() => { setAddingSect(false); setNewSectTitle('') }} className="px-4 py-2 text-sm text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl">Annuler</button>
          </form>
        ) : book.sections.length > 0 && (
          <button
            onClick={() => setAddingSect(true)}
            className="flex items-center gap-2 text-sm font-medium text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-950 px-4 py-2.5 rounded-xl border-2 border-dashed border-primary-200 dark:border-primary-900 transition-colors w-full justify-center"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
            Ajouter une section
          </button>
        )}
      </div>
    </div>
  )
}
