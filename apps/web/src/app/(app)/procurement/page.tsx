'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  useContrats, useDemandesAchat, useCommandes, useActivites, useProduits, useOrgUnits, useMesProfils, useMesValidations, useDelegations,
  useGovernanceConfig,
} from '@/hooks/useProcurement'
import type { CreateActiviteInput } from '@/hooks/useProcurement'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import {
  CONTRAT_STATUT_LABELS, COMMANDE_STATUT_LABELS, ACTIVITE_STATUT_LABELS, TYPE_ACTIVITE_LABELS, METEO_LABELS,
  VALIDATION_STATUT_LABELS, NON_ENGAGEE_LABEL, ORG_UNIT_NIVEAU_LABELS,
  formatMontant, formatDate,
} from '@/lib/procurement'
import type { PouvoirDelegation, TypeActivite, ContratStatut, ValidationStatut, ActiviteStatut } from '@/lib/procurement'
import { useFlagGuard } from '@/hooks/useFlagGuard'
import { useAuthStore } from '@/store/auth'

type Tab = 'contrats' | 'demandes' | 'commandes' | 'activites' | 'produits' | 'validations' | 'budget'

const TYPES_ACTIVITE: TypeActivite[] = ['REFONTE', 'RUN', 'NOUVEAU', 'EVOLUTION', 'MAINTENANCE', 'DECOMMISSIONNEMENT', 'AUTRE']
const CONTRAT_STATUTS: ContratStatut[] = ['ACTIF', 'EXPIRE', 'RESILIE']
const VALIDATION_STATUTS: (ValidationStatut | 'NON_ENGAGEE')[] = ['NON_ENGAGEE', 'EN_VALIDATION', 'VALIDEE', 'REJETEE']
const ACTIVITE_STATUTS: ActiviteStatut[] = ['ACTIF', 'SUSPENDU', 'CLOTURE']
const PAGE_SIZE = 25

// Pagination simple — précédent/suivant + indicateur de page, suffisant tant qu'on n'a pas
// besoin de sauter directement à une page arbitraire (recherche/filtre couvrent ce besoin).
function Pagination({ page, pageSize, total, onChange }: { page: number; pageSize: number; total: number; onChange: (page: number) => void }) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  if (pageCount <= 1) return null
  return (
    <div className="flex items-center justify-between px-1">
      <p className="text-xs text-gray-400">{total} résultat{total > 1 ? 's' : ''} — page {page} / {pageCount}</p>
      <div className="flex gap-2">
        <button onClick={() => onChange(page - 1)} disabled={page <= 1}
          className="rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40">
          ← Précédent
        </button>
        <button onClick={() => onChange(page + 1)} disabled={page >= pageCount}
          className="rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40">
          Suivant →
        </button>
      </div>
    </div>
  )
}

// ── Create activité modal ──────────────────────────────────────────────────────

function CreateActiviteModal({
  orgUnitId, onCreate, onClose,
}: {
  orgUnitId: string | null
  onCreate: (input: CreateActiviteInput) => Promise<{ id: string }>
  onClose: () => void
}) {
  const router = useRouter()
  const { valeurs: typesDisponibles } = useGovernanceConfig(orgUnitId, 'TYPE_ACTIVITE')
  const [nom, setNom] = useState('')
  const [type, setType] = useState<TypeActivite>('AUTRE')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!nom.trim()) return
    setSaving(true)
    try {
      const activite = await onCreate({ nom: nom.trim(), type, description: description.trim() || null })
      router.push(`/procurement/activites/${activite.id}`)
    } catch (err) {
      alert((err as Error).message)
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md flex flex-col">
        <div className="p-6 border-b border-gray-100 dark:border-gray-800">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Nouvelle activité</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Le reste de la fiche (budget, jalons, risques…) se complète ensuite.</p>
        </div>
        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Nom</label>
            <input autoFocus value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Refonte SI RH"
              className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Type</label>
            <select value={type} onChange={(e) => setType(e.target.value as TypeActivite)}
              className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 bg-white">
              {Array.from(new Set([...typesDisponibles.map((v) => v.valeur), type])).map((t) => (
                <option key={t} value={t}>{TYPE_ACTIVITE_LABELS[t as TypeActivite]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Description (optionnel)</label>
            <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Contexte, objectifs…"
              className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400" />
          </div>
        </form>
        <div className="p-6 border-t border-gray-100 dark:border-gray-800 flex gap-3">
          <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-gray-200 dark:border-gray-700 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">Annuler</button>
          <button onClick={handleSubmit} disabled={saving || !nom.trim()} className="flex-1 rounded-xl bg-primary-600 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50">
            {saving ? 'Création…' : "Créer l'activité"}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Délégation form ────────────────────────────────────────────────────────────

function DelegationForm({ orgUnitId, onCreate }: { orgUnitId: string; onCreate: ReturnType<typeof useDelegations>['createDelegation'] }) {
  const [email, setEmail] = useState('')
  const [pouvoir, setPouvoir] = useState<PouvoirDelegation>('COMPLET')
  const [pourcentage, setPourcentage] = useState('50')
  const [seuilEuro, setSeuilEuro] = useState('')
  const [dateDebut, setDateDebut] = useState('')
  const [dateFin, setDateFin] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setSaving(true)
    try {
      await onCreate({
        delegueEmail: email.trim(),
        orgUnitId,
        pouvoir,
        pourcentage: pouvoir === 'PARTIEL' && !seuilEuro.trim() ? parseFloat(pourcentage) / 100 : null,
        seuilEuro: pouvoir === 'PARTIEL' && seuilEuro.trim() ? parseFloat(seuilEuro) : null,
        dateDebut: dateDebut || null,
        dateFin: dateFin || null,
      })
      setEmail(''); setSeuilEuro(''); setDateDebut(''); setDateFin('')
    } catch (err) {
      alert((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-2 bg-gray-50 dark:bg-gray-800/50 rounded-xl p-3">
      <div>
        <label className="block text-[11px] text-gray-500 mb-1">Déléguer à</label>
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@exemple.fr"
          className="border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-lg px-2 py-1.5 text-sm w-44" />
      </div>
      <div>
        <label className="block text-[11px] text-gray-500 mb-1">Pouvoir</label>
        <select value={pouvoir} onChange={(e) => setPouvoir(e.target.value as PouvoirDelegation)}
          className="border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-lg px-2 py-1.5 text-sm bg-white">
          <option value="COMPLET">Complet</option>
          <option value="PARTIEL">Partiel</option>
        </select>
      </div>
      {pouvoir === 'PARTIEL' && (
        <>
          <div>
            <label className="block text-[11px] text-gray-500 mb-1">% du seuil</label>
            <input type="number" min="1" max="100" value={pourcentage} onChange={(e) => { setPourcentage(e.target.value); setSeuilEuro('') }}
              disabled={!!seuilEuro.trim()}
              className="border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-lg px-2 py-1.5 text-sm w-20 disabled:opacity-40" />
          </div>
          <div>
            <label className="block text-[11px] text-gray-500 mb-1">ou seuil fixe (€)</label>
            <input type="number" min="0" value={seuilEuro} onChange={(e) => setSeuilEuro(e.target.value)} placeholder="—"
              className="border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-lg px-2 py-1.5 text-sm w-28" />
          </div>
        </>
      )}
      <div>
        <label className="block text-[11px] text-gray-500 mb-1">Début (optionnel)</label>
        <input type="date" value={dateDebut} onChange={(e) => setDateDebut(e.target.value)}
          className="border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-lg px-2 py-1.5 text-sm" />
      </div>
      <div>
        <label className="block text-[11px] text-gray-500 mb-1">Fin (optionnel)</label>
        <input type="date" value={dateFin} min={dateDebut} onChange={(e) => setDateFin(e.target.value)}
          className="border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-lg px-2 py-1.5 text-sm" />
      </div>
      <button type="submit" disabled={saving || !email.trim()} className="rounded-lg bg-primary-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50">
        {saving ? '…' : 'Déléguer'}
      </button>
    </form>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ProcurementPage() {
  useFlagGuard('module.procurement')
  const router = useRouter()
  const user = useAuthStore((s) => s.user)
  const [contratSearchInput, setContratSearchInput] = useState('')
  const [contratStatutFilter, setContratStatutFilter] = useState<ContratStatut | ''>('')
  const [contratPage, setContratPage] = useState(1)
  const contratSearch = useDebouncedValue(contratSearchInput, 300)
  const {
    contrats, total: contratsTotal, page: contratPageActual, pageSize: contratPageSize,
    isLoading: contratsLoading,
  } = useContrats({ q: contratSearch, statut: contratStatutFilter, page: contratPage, pageSize: PAGE_SIZE })

  const [demandeSearchInput, setDemandeSearchInput] = useState('')
  const [demandeStatutFilter, setDemandeStatutFilter] = useState<ValidationStatut | 'NON_ENGAGEE' | ''>('')
  const [demandePage, setDemandePage] = useState(1)
  const demandeSearch = useDebouncedValue(demandeSearchInput, 300)
  const {
    demandesAchat, total: demandesTotal, page: demandePageActual, pageSize: demandePageSize,
    isLoading: demandesLoading,
  } = useDemandesAchat({ q: demandeSearch, validationStatut: demandeStatutFilter, page: demandePage, pageSize: PAGE_SIZE })

  useEffect(() => { setContratPage(1) }, [contratSearch, contratStatutFilter])
  useEffect(() => { setDemandePage(1) }, [demandeSearch, demandeStatutFilter])

  const { commandes, isLoading: commandesLoading } = useCommandes()
  const { activites, isLoading: activitesLoading, createActivite, deleteActivite } = useActivites()
  const { produits, isLoading: produitsLoading } = useProduits()
  const { orgUnits } = useOrgUnits()
  const { profils: mesProfils, has: hasProfil } = useMesProfils()
  const chefDeProjetOrgUnitId = mesProfils.find((p) => p.role === 'CHEF_DE_PROJET')?.orgUnitId ?? null
  const { validations, isLoading: validationsLoading, decide } = useMesValidations()
  const { delegations, createDelegation, revokeDelegation } = useDelegations()

  const [tab, setTab] = useState<Tab>('contrats')
  const [showCreateActivite, setShowCreateActivite] = useState(false)
  const [confirmDeleteActivite, setConfirmDeleteActivite] = useState<string | null>(null)

  const [activiteSearchInput, setActiviteSearchInput] = useState('')
  const [activiteTypeFilter, setActiviteTypeFilter] = useState<TypeActivite | ''>('')
  const [activiteStatutFilter, setActiviteStatutFilter] = useState<ActiviteStatut | ''>('')
  const filteredActivites = activites.filter((a) => (
    (!activiteSearchInput.trim() || a.nom.toLowerCase().includes(activiteSearchInput.trim().toLowerCase()))
    && (!activiteTypeFilter || a.type === activiteTypeFilter)
    && (!activiteStatutFilter || a.statut === activiteStatutFilter)
  ))

  const hierarchieValidations = validations.filter((v) => v.type === 'HIERARCHIE')
  const financeValidations = validations.filter((v) => v.type === 'FINANCE')
  const showValidationsTab = hasProfil('VALIDEUR') || hierarchieValidations.length > 0
  const showBudgetTab = hasProfil('FINANCE') || financeValidations.length > 0
  const myOrgUnits = orgUnits.filter((u) => (u.managerEmail && u.managerEmail.toLowerCase() === user?.email?.toLowerCase()) || hasProfil('VALIDEUR', u.id))
  const myDelegationsGiven = delegations.filter((d) => d.delegantId === user?.id && d.statut === 'ACTIVE')

  const TAB_LABELS: Record<Tab, string> = {
    contrats: `Contrats (${contratsTotal})`,
    demandes: `Demandes d'achat (${demandesTotal})`,
    commandes: `Commandes (${commandes.length})`,
    activites: `Activités (${activites.length})`,
    produits: `Produits (${produits.length})`,
    validations: `Validations (${hierarchieValidations.length})`,
    budget: `Contrôle budgétaire (${financeValidations.length})`,
  }
  const visibleTabs: Tab[] = ['contrats', 'demandes', 'commandes', 'activites', 'produits', ...(showValidationsTab ? (['validations'] as Tab[]) : []), ...(showBudgetTab ? (['budget'] as Tab[]) : [])]

  const showCreateButton = tab === 'activites'

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">Commande publique</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Contrats, demandes d&apos;achat, commandes et budgets projets — circuit de validation par profil</p>
          {user?.isAdmin && (
            <button onClick={() => router.push('/procurement/organisation')} className="text-xs text-primary-600 hover:text-primary-800 font-semibold dark:text-primary-400 mt-2">
              Gérer l&apos;organigramme et les profils →
            </button>
          )}
        </div>
        {showCreateButton && (
          <button
            onClick={() => setShowCreateActivite(true)}
            className="flex items-center gap-2 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 active:scale-95 transition-all shadow-sm shadow-primary-200"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
            Nouvelle activité
          </button>
        )}
      </div>

      <div className="flex gap-2 border-b border-gray-100 dark:border-gray-800 flex-wrap">
        {visibleTabs.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${tab === t ? 'border-primary-600 text-primary-700 dark:text-primary-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
          >
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      {tab === 'contrats' && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            <input
              value={contratSearchInput} onChange={(e) => setContratSearchInput(e.target.value)}
              placeholder="Rechercher par numéro ou objet…"
              className="flex-1 min-w-[220px] border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
            />
            <select value={contratStatutFilter} onChange={(e) => setContratStatutFilter(e.target.value as ContratStatut | '')}
              className="border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 bg-white">
              <option value="">Tous statuts</option>
              {CONTRAT_STATUTS.map((s) => <option key={s} value={s}>{CONTRAT_STATUT_LABELS[s].label}</option>)}
            </select>
          </div>

          {contratsLoading ? (
            <div className="flex flex-col gap-3">{[1, 2, 3].map((i) => <div key={i} className="h-12 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />)}</div>
          ) : contrats.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700 p-12 text-center">
              <span className="text-4xl block mb-3">🏛️</span>
              <p className="text-gray-500 dark:text-gray-400 font-medium">{contratSearch || contratStatutFilter ? 'Aucun résultat' : 'Aucun contrat'}</p>
              <p className="text-gray-500 text-sm mt-1">
                {contratSearch || contratStatutFilter
                  ? 'Essayez un autre terme de recherche ou réinitialisez les filtres.'
                  : 'Les contrats sont synchronisés depuis le PGI.'}
              </p>
            </div>
          ) : (
            <>
              <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-gray-800">
                      <th className="text-left text-[10px] font-medium text-gray-400 uppercase tracking-wide px-4 py-2.5">Numéro</th>
                      <th className="text-left text-[10px] font-medium text-gray-400 uppercase tracking-wide px-4 py-2.5">Objet</th>
                      <th className="text-left text-[10px] font-medium text-gray-400 uppercase tracking-wide px-4 py-2.5">Lots</th>
                      <th className="text-left text-[10px] font-medium text-gray-400 uppercase tracking-wide px-4 py-2.5">Période</th>
                      <th className="text-left text-[10px] font-medium text-gray-400 uppercase tracking-wide px-4 py-2.5">Statut</th>
                    </tr>
                  </thead>
                  <tbody>
                    {contrats.map((c) => {
                      const status = CONTRAT_STATUT_LABELS[c.statut]
                      return (
                        <tr
                          key={c.id} onClick={() => router.push(`/procurement/contrats/${c.id}`)}
                          className="border-b border-gray-50 dark:border-gray-800/60 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800/40 cursor-pointer"
                        >
                          <td className="px-4 py-3 font-semibold text-gray-900 dark:text-white text-sm">{c.numero}</td>
                          <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300 max-w-xs truncate">{c.objet}</td>
                          <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{c.lots.length}</td>
                          <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                            {formatDate(c.dateDebut)}{c.dateFin && ` → ${formatDate(c.dateFin)}`}
                          </td>
                          <td className="px-4 py-3"><span className={`text-xs font-medium px-2.5 py-1 rounded-lg ${status.cls}`}>{status.label}</span></td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <Pagination page={contratPageActual} pageSize={contratPageSize} total={contratsTotal} onChange={setContratPage} />
            </>
          )}
        </div>
      )}

      {tab === 'demandes' && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            <input
              value={demandeSearchInput} onChange={(e) => setDemandeSearchInput(e.target.value)}
              placeholder="Rechercher par numéro ou objet…"
              className="flex-1 min-w-[220px] border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
            />
            <select value={demandeStatutFilter} onChange={(e) => setDemandeStatutFilter(e.target.value as ValidationStatut | '')}
              className="border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 bg-white">
              <option value="">Tous statuts</option>
              {VALIDATION_STATUTS.map((s) => <option key={s} value={s}>{s === 'NON_ENGAGEE' ? NON_ENGAGEE_LABEL.label : VALIDATION_STATUT_LABELS[s].label}</option>)}
            </select>
          </div>

          {demandesLoading ? (
            <div className="flex flex-col gap-3">{[1, 2, 3].map((i) => <div key={i} className="h-12 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />)}</div>
          ) : demandesAchat.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700 p-12 text-center">
              <span className="text-4xl block mb-3">📝</span>
              <p className="text-gray-500 dark:text-gray-400 font-medium">{demandeSearch || demandeStatutFilter ? 'Aucun résultat' : "Aucune demande d'achat"}</p>
              <p className="text-gray-500 text-sm mt-1">
                {demandeSearch || demandeStatutFilter
                  ? 'Essayez un autre terme de recherche ou réinitialisez les filtres.'
                  : 'Les demandes d\'achat sont synchronisées depuis le PGI — engagez-les dans un circuit de validation depuis leur fiche.'}
              </p>
            </div>
          ) : (
            <>
              <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-gray-800">
                      <th className="text-left text-[10px] font-medium text-gray-400 uppercase tracking-wide px-4 py-2.5">Numéro</th>
                      <th className="text-left text-[10px] font-medium text-gray-400 uppercase tracking-wide px-4 py-2.5">Objet</th>
                      <th className="text-left text-[10px] font-medium text-gray-400 uppercase tracking-wide px-4 py-2.5">Date</th>
                      <th className="text-left text-[10px] font-medium text-gray-400 uppercase tracking-wide px-4 py-2.5">Total</th>
                      <th className="text-left text-[10px] font-medium text-gray-400 uppercase tracking-wide px-4 py-2.5">Validation</th>
                    </tr>
                  </thead>
                  <tbody>
                    {demandesAchat.map((d) => {
                      const validation = d.validationStatut ? VALIDATION_STATUT_LABELS[d.validationStatut] : NON_ENGAGEE_LABEL
                      return (
                        <tr
                          key={d.id} onClick={() => router.push(`/procurement/demandes-achat/${d.id}`)}
                          className="border-b border-gray-50 dark:border-gray-800/60 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800/40 cursor-pointer"
                        >
                          <td className="px-4 py-3 font-semibold text-gray-900 dark:text-white text-sm">{d.numero}</td>
                          <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300 max-w-xs truncate">{d.objet}</td>
                          <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{formatDate(d.dateDemande)}</td>
                          <td className="px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-200">{formatMontant(d.total)}</td>
                          <td className="px-4 py-3"><span className={`text-xs font-medium px-2.5 py-1 rounded-lg ${validation.cls}`}>{validation.label}</span></td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <Pagination page={demandePageActual} pageSize={demandePageSize} total={demandesTotal} onChange={setDemandePage} />
            </>
          )}
        </div>
      )}

      {tab === 'commandes' && (
        commandesLoading ? (
          <div className="flex flex-col gap-3">{[1, 2, 3].map((i) => <div key={i} className="h-12 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />)}</div>
        ) : commandes.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700 p-12 text-center">
            <span className="text-4xl block mb-3">📦</span>
            <p className="text-gray-500 dark:text-gray-400 font-medium">Aucune commande</p>
            <p className="text-gray-500 text-sm mt-1">Une commande (rustine PGI) apparaît automatiquement quand une demande d&apos;achat est validée.</p>
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800">
                  <th className="text-left text-[10px] font-medium text-gray-400 uppercase tracking-wide px-4 py-2.5">Numéro</th>
                  <th className="text-left text-[10px] font-medium text-gray-400 uppercase tracking-wide px-4 py-2.5">Demande d&apos;achat</th>
                  <th className="text-left text-[10px] font-medium text-gray-400 uppercase tracking-wide px-4 py-2.5">Réf. PGI</th>
                  <th className="text-left text-[10px] font-medium text-gray-400 uppercase tracking-wide px-4 py-2.5">Émise le</th>
                  <th className="text-left text-[10px] font-medium text-gray-400 uppercase tracking-wide px-4 py-2.5">Statut</th>
                </tr>
              </thead>
              <tbody>
                {commandes.map((c) => {
                  const status = COMMANDE_STATUT_LABELS[c.statut]
                  return (
                    <tr
                      key={c.id} onClick={() => router.push(`/procurement/demandes-achat/${c.demandeAchatId}`)}
                      className="border-b border-gray-50 dark:border-gray-800/60 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800/40 cursor-pointer"
                    >
                      <td className="px-4 py-3 font-semibold text-gray-900 dark:text-white text-sm">{c.numero}</td>
                      <td className="px-4 py-3 text-sm text-primary-600 dark:text-primary-400">Voir la demande →</td>
                      <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{c.referencePgi ?? '—'}</td>
                      <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{formatDate(c.dateEmission)}</td>
                      <td className="px-4 py-3"><span className={`text-xs font-medium px-2.5 py-1 rounded-lg ${status.cls}`}>{status.label}</span></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )
      )}

      {tab === 'activites' && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            <input
              value={activiteSearchInput} onChange={(e) => setActiviteSearchInput(e.target.value)}
              placeholder="Rechercher par nom…"
              className="flex-1 min-w-[220px] border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
            />
            <select value={activiteTypeFilter} onChange={(e) => setActiviteTypeFilter(e.target.value as TypeActivite | '')}
              className="border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 bg-white">
              <option value="">Tous types</option>
              {TYPES_ACTIVITE.map((t) => <option key={t} value={t}>{TYPE_ACTIVITE_LABELS[t]}</option>)}
            </select>
            <select value={activiteStatutFilter} onChange={(e) => setActiviteStatutFilter(e.target.value as ActiviteStatut | '')}
              className="border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 bg-white">
              <option value="">Tous statuts</option>
              {ACTIVITE_STATUTS.map((s) => <option key={s} value={s}>{ACTIVITE_STATUT_LABELS[s].label}</option>)}
            </select>
          </div>

          {activitesLoading ? (
            <div className="flex flex-col gap-3">{[1, 2, 3].map((i) => <div key={i} className="h-12 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />)}</div>
          ) : activites.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700 p-12 text-center">
              <span className="text-4xl block mb-3">🎯</span>
              <p className="text-gray-500 dark:text-gray-400 font-medium">Aucune activité</p>
              <p className="text-gray-500 text-sm mt-1">Créez une activité pour suivre son budget, ses jalons et ses risques.</p>
            </div>
          ) : filteredActivites.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700 p-12 text-center">
              <span className="text-4xl block mb-3">🎯</span>
              <p className="text-gray-500 dark:text-gray-400 font-medium">Aucun résultat</p>
              <p className="text-gray-500 text-sm mt-1">Essayez un autre terme de recherche ou réinitialisez les filtres.</p>
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-800">
                    <th className="text-left text-[10px] font-medium text-gray-400 uppercase tracking-wide px-4 py-2.5">Nom</th>
                    <th className="text-left text-[10px] font-medium text-gray-400 uppercase tracking-wide px-4 py-2.5">Type</th>
                    <th className="text-left text-[10px] font-medium text-gray-400 uppercase tracking-wide px-4 py-2.5">Météo</th>
                    <th className="text-left text-[10px] font-medium text-gray-400 uppercase tracking-wide px-4 py-2.5">Département</th>
                    <th className="text-left text-[10px] font-medium text-gray-400 uppercase tracking-wide px-4 py-2.5">Statut</th>
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody>
                  {filteredActivites.map((a) => {
                    const status = ACTIVITE_STATUT_LABELS[a.statut]
                    const meteo = METEO_LABELS[a.meteo]
                    return (
                      <tr
                        key={a.id} onClick={() => router.push(`/procurement/activites/${a.id}`)}
                        className="border-b border-gray-50 dark:border-gray-800/60 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800/40 cursor-pointer"
                      >
                        <td className="px-4 py-3 font-semibold text-gray-900 dark:text-white text-sm">{a.nom}</td>
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{TYPE_ACTIVITE_LABELS[a.type]}</td>
                        <td className="px-4 py-3 text-sm">{meteo.emoji} {meteo.label}</td>
                        <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{a.departement?.nom ?? '—'}</td>
                        <td className="px-4 py-3"><span className={`text-xs font-medium px-2.5 py-1 rounded-lg ${status.cls}`}>{status.label}</span></td>
                        <td className="px-4 py-3">
                          {(!a.role || a.role === 'OWNER' || user?.isAdmin) && (
                            <button
                              onClick={(e) => { e.stopPropagation(); setConfirmDeleteActivite(a.id) }}
                              className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950 transition-colors"
                              title="Supprimer"
                            >
                              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'produits' && (
        produitsLoading ? (
          <div className="flex flex-col gap-3">{[1, 2, 3].map((i) => <div key={i} className="h-12 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />)}</div>
        ) : produits.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700 p-12 text-center">
            <span className="text-4xl block mb-3">📦</span>
            <p className="text-gray-500 dark:text-gray-400 font-medium">Aucun produit</p>
            <p className="text-gray-500 text-sm mt-1">Les produits se créent depuis la fiche d&apos;une activité (rustine, liste de référence).</p>
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800">
                  <th className="text-left text-[10px] font-medium text-gray-400 uppercase tracking-wide px-4 py-2.5">Nom</th>
                  <th className="text-left text-[10px] font-medium text-gray-400 uppercase tracking-wide px-4 py-2.5">Activités rattachées</th>
                </tr>
              </thead>
              <tbody>
                {produits.map((p) => (
                  <tr
                    key={p.id} onClick={() => router.push(`/procurement/produits/${p.id}`)}
                    className="border-b border-gray-50 dark:border-gray-800/60 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800/40 cursor-pointer"
                  >
                    <td className="px-4 py-3 font-semibold text-gray-900 dark:text-white text-sm">{p.nom}</td>
                    <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{p._count?.activites ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {tab === 'validations' && (
        <div className="flex flex-col gap-6">
          {validationsLoading ? (
            <div className="flex flex-col gap-3">{[1, 2].map((i) => <div key={i} className="h-12 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />)}</div>
          ) : hierarchieValidations.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700 p-8 text-center">
              <p className="text-gray-500 text-sm">Aucune validation en attente.</p>
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-800">
                    <th className="text-left text-[10px] font-medium text-gray-400 uppercase tracking-wide px-4 py-2.5">Demande d&apos;achat</th>
                    <th className="text-left text-[10px] font-medium text-gray-400 uppercase tracking-wide px-4 py-2.5">Périmètre</th>
                    <th className="text-left text-[10px] font-medium text-gray-400 uppercase tracking-wide px-4 py-2.5">Montant</th>
                    <th className="w-48" />
                  </tr>
                </thead>
                <tbody>
                  {hierarchieValidations.map((v) => (
                    <tr key={v.id} className="border-b border-gray-50 dark:border-gray-800/60 last:border-0">
                      <td className="px-4 py-3 text-sm">
                        <button onClick={() => router.push(`/procurement/demandes-achat/${v.demandeAchat.id}`)} className="font-semibold text-primary-600 hover:underline dark:text-primary-400">
                          {v.demandeAchat.numero}
                        </button>
                        <p className="text-xs text-gray-400">{v.demandeAchat.objet}</p>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{v.orgUnit ? `${ORG_UNIT_NIVEAU_LABELS[v.orgUnit.niveau]} · ${v.orgUnit.nom}` : '—'}</td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-200">{formatMontant(v.montant)}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2 justify-end">
                          <button onClick={() => decide(v.id, 'REJETEE')} className="rounded-lg border border-red-200 dark:border-red-900 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-950">Rejeter</button>
                          <button onClick={() => decide(v.id, 'APPROUVEE')} className="rounded-lg bg-primary-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-primary-700">Approuver</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {myOrgUnits.length > 0 && (
            <div className="flex flex-col gap-3">
              <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Mes délégations</h2>
              {myOrgUnits.map((u) => (
                <div key={u.id} className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-4 flex flex-col gap-3">
                  <p className="text-sm font-semibold text-gray-800 dark:text-white">{ORG_UNIT_NIVEAU_LABELS[u.niveau]} · {u.nom}</p>
                  <DelegationForm orgUnitId={u.id} onCreate={createDelegation} />
                  {myDelegationsGiven.filter((d) => d.orgUnitId === u.id).length > 0 && (
                    <div className="flex flex-col gap-1.5">
                      {myDelegationsGiven.filter((d) => d.orgUnitId === u.id).map((d) => (
                        <div key={d.id} className="flex items-center justify-between text-sm bg-gray-50 dark:bg-gray-800/50 rounded-lg px-3 py-1.5">
                          <span className="text-gray-600 dark:text-gray-300">
                            {d.delegue?.name ?? d.delegue?.email} — {d.pouvoir === 'COMPLET' ? 'pouvoir complet' : `partiel (${d.seuilEuro ? formatMontant(d.seuilEuro) : `${Math.round((d.pourcentage ?? 0) * 100)}%`})`}
                          </span>
                          <button onClick={() => revokeDelegation(d.id)} className="text-xs text-gray-400 hover:text-red-500">Révoquer</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'budget' && (
        <div className="flex flex-col gap-6">
          {validationsLoading ? (
            <div className="flex flex-col gap-3">{[1, 2].map((i) => <div key={i} className="h-12 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />)}</div>
          ) : financeValidations.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700 p-8 text-center">
              <p className="text-gray-500 text-sm">Aucun contrôle budgétaire en attente.</p>
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-800">
                    <th className="text-left text-[10px] font-medium text-gray-400 uppercase tracking-wide px-4 py-2.5">Demande d&apos;achat</th>
                    <th className="text-left text-[10px] font-medium text-gray-400 uppercase tracking-wide px-4 py-2.5">Montant</th>
                    <th className="w-48" />
                  </tr>
                </thead>
                <tbody>
                  {financeValidations.map((v) => (
                    <tr key={v.id} className="border-b border-gray-50 dark:border-gray-800/60 last:border-0">
                      <td className="px-4 py-3 text-sm">
                        <button onClick={() => router.push(`/procurement/demandes-achat/${v.demandeAchat.id}`)} className="font-semibold text-primary-600 hover:underline dark:text-primary-400">
                          {v.demandeAchat.numero}
                        </button>
                        <p className="text-xs text-gray-400">{v.demandeAchat.objet}</p>
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-200">{formatMontant(v.montant)}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2 justify-end">
                          <button onClick={() => decide(v.id, 'REJETEE')} className="rounded-lg border border-red-200 dark:border-red-900 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-950">Rejeter</button>
                          <button onClick={() => decide(v.id, 'APPROUVEE')} className="rounded-lg bg-primary-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-primary-700">Approuver</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {showCreateActivite && <CreateActiviteModal orgUnitId={chefDeProjetOrgUnitId} onCreate={createActivite} onClose={() => setShowCreateActivite(false)} />}

      {confirmDeleteActivite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-6 w-full max-w-sm">
            <h3 className="text-base font-bold text-gray-900 dark:text-white mb-2">Supprimer cette activité ?</h3>
            <p className="text-sm text-gray-500 mb-5">Gains, jalons, budget et risques associés seront supprimés. Action irréversible.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDeleteActivite(null)} className="flex-1 rounded-xl border border-gray-200 dark:border-gray-700 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">Annuler</button>
              <button
                onClick={async () => {
                  try { await deleteActivite(confirmDeleteActivite); setConfirmDeleteActivite(null) }
                  catch (err) { alert((err as Error).message) }
                }}
                className="flex-1 rounded-xl bg-red-600 py-2 text-sm font-semibold text-white hover:bg-red-700"
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
