'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, Plus, Trash2 } from 'lucide-react'
import { useOrgUnits, useInnovationCategories, type InnovationOrgNiveau } from '@/hooks/useInnovationOrg'
import { OrgUnitPicker } from '@/components/innovation/org-unit-picker'
import { useFlagGuard } from '@/hooks/useFlagGuard'
import { useAuthStore } from '@/store/auth'

const NIVEAUX: { key: InnovationOrgNiveau; label: string }[] = [
  { key: 'COMEX', label: 'COMEX' },
  { key: 'DIRECTION', label: 'Direction' },
  { key: 'DIVISION', label: 'Division' },
  { key: 'DEPARTEMENT', label: 'Département' },
  { key: 'EQUIPE', label: 'Équipe' },
]

const inputCls = 'w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400'

export default function InnovationOrganisationPage() {
  useFlagGuard('module.innovation')
  const user = useAuthStore((s) => s.user)
  const { units, ldapDegraded, isLoading, createUnit, deleteUnit } = useOrgUnits()
  const { categories, createCategory, deleteCategory } = useInnovationCategories(null)

  const [unitNom, setUnitNom] = useState('')
  const [unitNiveau, setUnitNiveau] = useState<InnovationOrgNiveau>('EQUIPE')
  const [unitParentRef, setUnitParentRef] = useState<string | null>(null)
  const [unitError, setUnitError] = useState<string | null>(null)

  const [catLabel, setCatLabel] = useState('')
  const [catOrgUnitRef, setCatOrgUnitRef] = useState<string | null>(null)
  const [catError, setCatError] = useState<string | null>(null)

  if (!user?.isAdmin) {
    return (
      <div className="text-center py-16">
        <div className="text-5xl mb-4">🔒</div>
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Réservé aux administrateurs</h2>
        <Link href="/innovation" className="text-sm text-amber-600 hover:text-amber-700 mt-3 inline-block">← Retour</Link>
      </div>
    )
  }

  const internalUnits = units.filter((u) => u.source === 'interne')

  async function handleCreateUnit(e: React.FormEvent) {
    e.preventDefault()
    if (!unitNom.trim()) return
    setUnitError(null)
    try {
      // Une unité interne ne peut être rattachée qu'à une autre unité interne (ADR-0012).
      const rawParentId = unitParentRef?.startsWith('int:') ? unitParentRef.slice(4) : null
      await createUnit({ nom: unitNom.trim(), niveau: unitNiveau, parentId: rawParentId })
      setUnitNom('')
      setUnitParentRef(null)
    } catch (err) {
      setUnitError((err as Error).message)
    }
  }

  async function handleDeleteUnit(ref: string) {
    const rawId = ref.slice(4)
    if (!confirm('Supprimer cette unité ?')) return
    try {
      await deleteUnit(rawId)
    } catch (err) {
      alert((err as Error).message)
    }
  }

  async function handleCreateCategory(e: React.FormEvent) {
    e.preventDefault()
    if (!catLabel.trim()) return
    setCatError(null)
    try {
      await createCategory({ label: catLabel.trim(), orgUnitRef: catOrgUnitRef ?? undefined })
      setCatLabel('')
      setCatOrgUnitRef(null)
    } catch (err) {
      setCatError((err as Error).message)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Link href="/innovation" className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors w-fit"><ChevronLeft size={16} />Innovation</Link>

      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">Organisation & catégories</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Hiérarchie interne complémentaire au LDAP, et catégories des fiches innovation.</p>
        {ldapDegraded && (
          <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">⚠️ Le référentiel LDAP externe est indisponible — seules les unités internes sont affichées ci-dessous.</p>
        )}
      </div>

      {/* Unités internes */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-6 flex flex-col gap-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-400">Unités internes</h2>
        {isLoading ? (
          <p className="text-sm text-gray-400">Chargement…</p>
        ) : internalUnits.length === 0 ? (
          <p className="text-sm text-gray-400">Aucune unité interne pour l'instant.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {internalUnits.map((u) => (
              <span key={u.ref} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
                {u.nom} <span className="text-gray-400">({NIVEAUX.find((n) => n.key === u.niveau)?.label})</span>
                <button onClick={() => handleDeleteUnit(u.ref)} className="hover:text-red-500"><Trash2 size={11} /></button>
              </span>
            ))}
          </div>
        )}
        <form onSubmit={handleCreateUnit} className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-gray-100 dark:border-gray-800">
          <input value={unitNom} onChange={(e) => setUnitNom(e.target.value)} placeholder="Nom de l'unité" className={inputCls} />
          <select value={unitNiveau} onChange={(e) => setUnitNiveau(e.target.value as InnovationOrgNiveau)} className={inputCls}>
            {NIVEAUX.map((n) => <option key={n.key} value={n.key}>{n.label}</option>)}
          </select>
          <div className="flex gap-2">
            <OrgUnitPicker units={units} value={unitParentRef} onChange={setUnitParentRef} placeholder="Sans parent" className={inputCls} />
            <button type="submit" className="shrink-0 flex items-center gap-1.5 rounded-xl bg-amber-500 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-600"><Plus size={14} /></button>
          </div>
        </form>
        {unitError && <p className="text-sm text-red-500">{unitError}</p>}
      </div>

      {/* Catégories */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-6 flex flex-col gap-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-400">Catégories</h2>
        {categories.length === 0 ? (
          <p className="text-sm text-gray-400">Aucune catégorie globale pour l'instant.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {categories.map((c) => (
              <span key={c.id} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300">
                {c.label}
                <button onClick={() => deleteCategory(c.id)} className="hover:text-red-500"><Trash2 size={11} /></button>
              </span>
            ))}
          </div>
        )}
        <form onSubmit={handleCreateCategory} className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-gray-100 dark:border-gray-800">
          <input value={catLabel} onChange={(e) => setCatLabel(e.target.value)} placeholder="Nom de la catégorie" className={inputCls} />
          <OrgUnitPicker units={units} value={catOrgUnitRef} onChange={setCatOrgUnitRef} placeholder="Globale (tous périmètres)" className={inputCls} />
          <button type="submit" className="flex items-center justify-center gap-1.5 rounded-xl bg-amber-500 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-600"><Plus size={14} />Ajouter</button>
        </form>
        {catError && <p className="text-sm text-red-500">{catError}</p>}
      </div>
    </div>
  )
}
