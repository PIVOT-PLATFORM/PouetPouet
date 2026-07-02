'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { useOrgUnits, useProfils, useMesProfils, useGovernanceEtat } from '@/hooks/useProcurement'
import type { OrgUnit, RoleAchat, ChampConfigurable, GovernanceValue } from '@/hooks/useProcurement'
import { ORG_UNIT_NIVEAU_LABELS, ROLE_ACHAT_LABELS, TYPE_LIGNE_BUDGET_LABELS, JALON_TYPE_LABELS, TYPE_ACTIVITE_LABELS } from '@/lib/procurement'
import { useFlagGuard } from '@/hooks/useFlagGuard'
import { useAuthStore } from '@/store/auth'

const ROLES: RoleAchat[] = ['CHEF_DE_PROJET', 'VALIDEUR', 'FINANCE', 'CONTRACT_MANAGER']

const CHAMPS: { champ: ChampConfigurable; label: string; labels: Record<string, string> }[] = [
  { champ: 'TYPE_LIGNE_BUDGET', label: 'Types de ligne budgétaire', labels: TYPE_LIGNE_BUDGET_LABELS },
  { champ: 'JALON_TYPE', label: 'Jalons', labels: JALON_TYPE_LABELS },
  { champ: 'TYPE_ACTIVITE', label: "Types d'activité", labels: TYPE_ACTIVITE_LABELS },
]

// Référentiels de gouvernance configurables par périmètre (OrgUnit), avec héritage vers
// le bas de l'arbre : quels types de ligne budgétaire / quels jalons sont obligatoires
// (auto-créés) vs libres / quels types d'activité sont proposés. Accessible aux
// administrateurs (tout périmètre) et aux valideurs (leurs périmètres uniquement).
function GovernanceConfigPanel({ orgUnits }: { orgUnits: OrgUnit[] }) {
  const [selectedOrgUnitId, setSelectedOrgUnitId] = useState(orgUnits[0]?.id ?? '')
  const [champ, setChamp] = useState<ChampConfigurable>('TYPE_LIGNE_BUDGET')
  const { etat, isLoading, save, resetToInherited } = useGovernanceEtat(selectedOrgUnitId || null)
  const [draft, setDraft] = useState<Record<string, GovernanceValue> | null>(null)
  const [saving, setSaving] = useState(false)

  const champDef = CHAMPS.find((c) => c.champ === champ)!
  const valeursEtat = etat?.[champ] ?? []
  const valeurs: GovernanceValue[] = Object.keys(champDef.labels).map((valeur) => {
    const edited = draft?.[valeur]
    if (edited) return edited
    const found = valeursEtat.find((v) => v.valeur === valeur)
    return found ?? { valeur, actif: true, obligatoire: false }
  })

  function toggle(valeur: string, patch: Partial<GovernanceValue>) {
    const current = valeurs.find((v) => v.valeur === valeur)!
    setDraft({ ...Object.fromEntries(valeurs.map((v) => [v.valeur, v])), [valeur]: { ...current, ...patch } })
  }

  async function handleSave() {
    setSaving(true)
    try {
      await save(champ, valeurs)
      setDraft(null)
    } catch (err) {
      alert((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  async function handleReset() {
    setSaving(true)
    try {
      await resetToInherited(champ)
      setDraft(null)
    } catch (err) {
      alert((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const source = valeursEtat[0]?.source
  const sourceOrgUnitNom = valeursEtat[0]?.sourceOrgUnitNom

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <select value={selectedOrgUnitId} onChange={(e) => { setSelectedOrgUnitId(e.target.value); setDraft(null) }}
          className="border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-lg px-2 py-1.5 text-sm bg-white">
          {orgUnits.map((u) => <option key={u.id} value={u.id}>{ORG_UNIT_NIVEAU_LABELS[u.niveau]} · {u.nom}</option>)}
        </select>
        <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1">
          {CHAMPS.map((c) => (
            <button key={c.champ} onClick={() => { setChamp(c.champ); setDraft(null) }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${champ === c.champ ? 'bg-primary-600 text-white' : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'}`}>
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {!selectedOrgUnitId ? (
        <p className="text-gray-400 text-sm">Aucun périmètre disponible.</p>
      ) : isLoading ? (
        <div className="h-24 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />
      ) : (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-4 flex flex-col gap-3">
          <p className="text-xs text-gray-400">
            {source === 'local' && 'Configuration définie sur ce périmètre.'}
            {source === 'herite' && `Hérité de ${sourceOrgUnitNom ?? 'un périmètre parent'} — modifier ici crée une surcharge locale.`}
            {source === 'defaut' && 'Par défaut (aucune configuration sur la branche) — modifier ici crée une surcharge locale.'}
          </p>
          <div className="flex flex-col gap-1.5">
            {valeurs.map((v) => (
              <div key={v.valeur} className="flex items-center gap-3 text-sm">
                <label className="flex items-center gap-1.5 w-56 shrink-0">
                  <input type="checkbox" checked={v.actif} onChange={(e) => toggle(v.valeur, { actif: e.target.checked })} className="accent-primary-600" />
                  <span className="text-gray-700 dark:text-gray-200">{champDef.labels[v.valeur]}</span>
                </label>
                {champ === 'JALON_TYPE' && (
                  <label className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 cursor-pointer">
                    <input type="checkbox" checked={v.obligatoire} disabled={!v.actif} onChange={(e) => toggle(v.valeur, { obligatoire: e.target.checked })} className="accent-primary-600" />
                    Obligatoire (auto-créé)
                  </label>
                )}
              </div>
            ))}
          </div>
          <div className="flex gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
            <button onClick={handleSave} disabled={saving} className="rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-700 disabled:opacity-50">
              {saving ? '…' : 'Enregistrer pour ce périmètre'}
            </button>
            {source === 'local' && (
              <button onClick={handleReset} disabled={saving} className="rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50">
                Revenir à l&apos;héritage
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function ProfilForm({ orgUnits, onAdd }: { orgUnits: OrgUnit[]; onAdd: (input: { email: string; role: RoleAchat; orgUnitId?: string | null }) => Promise<void> }) {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<RoleAchat>('CHEF_DE_PROJET')
  const [orgUnitId, setOrgUnitId] = useState('')
  const [saving, setSaving] = useState(false)
  const needsOrgUnit = role === 'CHEF_DE_PROJET' || role === 'VALIDEUR'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setSaving(true)
    try {
      await onAdd({ email: email.trim(), role, orgUnitId: needsOrgUnit ? (orgUnitId || null) : null })
      setEmail('')
    } catch (err) {
      alert((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-2 bg-gray-50 dark:bg-gray-800/50 rounded-xl p-3">
      <div>
        <label className="block text-[11px] text-gray-500 mb-1">Email</label>
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="utilisateur@exemple.fr"
          className="border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-lg px-2 py-1.5 text-sm w-52" />
      </div>
      <div>
        <label className="block text-[11px] text-gray-500 mb-1">Profil</label>
        <select value={role} onChange={(e) => setRole(e.target.value as RoleAchat)}
          className="border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-lg px-2 py-1.5 text-sm bg-white">
          {ROLES.map((r) => <option key={r} value={r}>{ROLE_ACHAT_LABELS[r]}</option>)}
        </select>
      </div>
      {needsOrgUnit && (
        <div>
          <label className="block text-[11px] text-gray-500 mb-1">Périmètre</label>
          <select value={orgUnitId} onChange={(e) => setOrgUnitId(e.target.value)}
            className="border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-lg px-2 py-1.5 text-sm bg-white">
            <option value="">— Sélectionner —</option>
            {orgUnits.map((u) => <option key={u.id} value={u.id}>{ORG_UNIT_NIVEAU_LABELS[u.niveau]} · {u.nom}</option>)}
          </select>
        </div>
      )}
      <button type="submit" disabled={saving || !email.trim()} className="rounded-lg bg-primary-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50">
        {saving ? '…' : 'Ajouter'}
      </button>
    </form>
  )
}

export default function OrganisationPage() {
  useFlagGuard('module.procurement')
  const user = useAuthStore((s) => s.user)
  const { orgUnits, isLoading, error, updateOrgUnit } = useOrgUnits()
  const { profils: profilsAdmin, addProfil, deleteProfil } = useProfils('all')
  const { profils: mesProfils } = useMesProfils()

  // L'organigramme et les profils restent réservés aux administrateurs ; la configuration
  // des référentiels de gouvernance (cf. GovernanceConfigPanel) est aussi ouverte aux
  // valideurs, mais seulement sur leurs propres périmètres.
  const mesOrgUnitsValideur = orgUnits.filter((u) => mesProfils.some((p) => p.role === 'VALIDEUR' && p.orgUnitId === u.id))
  const orgUnitsGouvernance = user?.isAdmin ? orgUnits : mesOrgUnitsValideur

  if (!user?.isAdmin && mesOrgUnitsValideur.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="text-5xl mb-4">🔒</div>
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Réservé aux administrateurs et valideurs</h2>
        <Link href="/procurement" className="text-sm text-primary-600 hover:text-primary-700 mt-3 inline-flex items-center gap-1"><ChevronLeft size={16} />Retour</Link>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Link href="/procurement" className="text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 inline-flex items-center gap-1 mb-3">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          Commande publique
        </Link>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">Organigramme &amp; profils</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Périmètres, seuils d&apos;approbation et profils achat (chef de projet, valideur, finance, contract manager)</p>
      </div>

      {error && (
        <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
          {error}
        </div>
      )}

      {user?.isAdmin && (
      <>
      <div>
        <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Périmètres</h2>
        <p className="text-xs text-gray-400 mt-1">Structure issue de l&apos;annuaire (lecture seule) — seul le seuil d&apos;approbation est géré ici.</p>
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-3">{[1, 2, 3].map((i) => <div key={i} className="h-12 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />)}</div>
      ) : orgUnits.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700 p-8 text-center">
          <p className="text-gray-500 text-sm">Aucun périmètre renvoyé par l&apos;annuaire.</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800">
                <th className="text-left text-[10px] font-medium text-gray-400 uppercase tracking-wide px-4 py-2.5">Niveau</th>
                <th className="text-left text-[10px] font-medium text-gray-400 uppercase tracking-wide px-4 py-2.5">Nom</th>
                <th className="text-left text-[10px] font-medium text-gray-400 uppercase tracking-wide px-4 py-2.5">Parent</th>
                <th className="text-left text-[10px] font-medium text-gray-400 uppercase tracking-wide px-4 py-2.5">Manager</th>
                <th className="text-left text-[10px] font-medium text-gray-400 uppercase tracking-wide px-4 py-2.5">Seuil d&apos;approbation</th>
              </tr>
            </thead>
            <tbody>
              {orgUnits.map((u) => {
                const parent = orgUnits.find((p) => p.id === u.parentId)
                return (
                  <tr key={u.id} className="border-b border-gray-50 dark:border-gray-800/60 last:border-0">
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{ORG_UNIT_NIVEAU_LABELS[u.niveau]}</td>
                    <td className="px-4 py-3 font-semibold text-gray-900 dark:text-white text-sm">{u.nom}</td>
                    <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{parent?.nom ?? '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{u.managerName ?? '—'}</td>
                    <td className="px-4 py-3">
                      <input
                        type="number" min="0" defaultValue={u.seuilApprobation ?? ''} placeholder="Illimité"
                        onBlur={(e) => updateOrgUnit(u.id, { seuilApprobation: e.target.value.trim() ? parseFloat(e.target.value) : null })}
                        className="w-32 text-sm border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-lg px-2 py-1"
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Profils achat</h2>
      <ProfilForm orgUnits={orgUnits} onAdd={addProfil} />

      {profilsAdmin.length === 0 ? (
        <p className="text-gray-400 text-sm">Aucun profil assigné.</p>
      ) : (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800">
                <th className="text-left text-[10px] font-medium text-gray-400 uppercase tracking-wide px-4 py-2.5">Utilisateur</th>
                <th className="text-left text-[10px] font-medium text-gray-400 uppercase tracking-wide px-4 py-2.5">Profil</th>
                <th className="text-left text-[10px] font-medium text-gray-400 uppercase tracking-wide px-4 py-2.5">Périmètre</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {profilsAdmin.map((p) => (
                <tr key={p.id} className="border-b border-gray-50 dark:border-gray-800/60 last:border-0">
                  <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-200">{p.user?.name ?? p.user?.email}</td>
                  <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{ROLE_ACHAT_LABELS[p.role]}</td>
                  <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{p.orgUnit ? `${ORG_UNIT_NIVEAU_LABELS[p.orgUnit.niveau]} · ${p.orgUnit.nom}` : '—'}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => deleteProfil(p.id)} className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950 transition-colors" title="Retirer">
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      </>
      )}

      {orgUnitsGouvernance.length > 0 && (
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Référentiels de gouvernance</h2>
          <p className="text-xs text-gray-400 -mt-2">
            Types de ligne budgétaire, jalons obligatoires et types d&apos;activité disponibles, par périmètre — hérités vers le bas de l&apos;arbre.
          </p>
          <GovernanceConfigPanel orgUnits={orgUnitsGouvernance} />
        </div>
      )}

    </div>
  )
}
