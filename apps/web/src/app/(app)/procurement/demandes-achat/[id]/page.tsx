'use client'

import { use, useState } from 'react'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { useDemandeAchat, useOrgUnits, useActivites, useCommandes } from '@/hooks/useProcurement'
import type { CommandeStatut } from '@/hooks/useProcurement'
import {
  VALIDATION_STATUT_LABELS, NON_ENGAGEE_LABEL, STATUT_APPROBATION_LABELS, ORG_UNIT_NIVEAU_LABELS, COMMANDE_STATUT_LABELS,
  formatMontant, formatDate,
} from '@/lib/procurement'
import { ModuleShareModal } from '@/components/share/module-share-modal'
import { useAuthStore } from '@/store/auth'

const COMMANDE_STATUSES: CommandeStatut[] = ['EN_COURS', 'LIVREE', 'SOLDEE']

// Panneau d'engagement : visible sur une DA "non engagée" (existe côté PGI, pas encore
// prise en charge par un circuit de validation). N'importe quel utilisateur authentifié
// peut tenter d'engager — le serveur vérifie le profil chef de projet sur le périmètre choisi.
function EngagerPanel({
  orgUnits, activites, onEngager,
}: {
  orgUnits: ReturnType<typeof useOrgUnits>['orgUnits']
  activites: ReturnType<typeof useActivites>['activites']
  onEngager: (input: { orgUnitId: string; activiteId?: string | null }) => Promise<unknown>
}) {
  const [orgUnitId, setOrgUnitId] = useState('')
  const [activiteId, setActiviteId] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleEngager() {
    if (!orgUnitId) return
    setSaving(true)
    try {
      await onEngager({ orgUnitId, activiteId: activiteId || null })
    } catch (err) {
      alert((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-2xl p-4">
      <p className="text-sm text-amber-800 dark:text-amber-300">
        Cette demande existe côté PGI mais n&apos;est pas encore engagée dans un circuit de validation.
      </p>
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <label className="block text-[11px] text-gray-500 mb-1">Équipe demandeuse</label>
          <select value={orgUnitId} onChange={(e) => setOrgUnitId(e.target.value)}
            className="border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-lg px-2 py-1.5 text-sm bg-white min-w-[14rem]">
            <option value="">— Sélectionner —</option>
            {orgUnits.map((u) => <option key={u.id} value={u.id}>{ORG_UNIT_NIVEAU_LABELS[u.niveau]} · {u.nom}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[11px] text-gray-500 mb-1">Activité (optionnel)</label>
          <select value={activiteId} onChange={(e) => setActiviteId(e.target.value)}
            className="border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-lg px-2 py-1.5 text-sm bg-white min-w-[14rem]">
            <option value="">— Aucune —</option>
            {activites.map((a) => <option key={a.id} value={a.id}>{a.nom}</option>)}
          </select>
        </div>
        <button onClick={handleEngager} disabled={saving || !orgUnitId} className="rounded-xl bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50">
          {saving ? 'Engagement…' : 'Engager dans le circuit de validation'}
        </button>
      </div>
    </div>
  )
}

export default function DemandeAchatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { demandeAchat, isLoading, error, engagerDemandeAchat, updateDemandeAchat, abandonnerEngagement, decideApprobation } = useDemandeAchat(id)
  const { orgUnits } = useOrgUnits()
  const { activites } = useActivites()
  const { updateCommande } = useCommandes()
  const user = useAuthStore((s) => s.user)

  const [showShare, setShowShare] = useState(false)
  const [confirmAbandon, setConfirmAbandon] = useState(false)

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-600 border-t-transparent" /></div>
  }
  if (error || !demandeAchat) {
    return (
      <div className="text-center py-16">
        <div className="text-5xl mb-4">😕</div>
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Demande d&apos;achat introuvable</h2>
        <Link href="/procurement" className="text-sm text-primary-600 hover:text-primary-700 mt-3 inline-flex items-center gap-1"><ChevronLeft size={16} />Retour</Link>
      </div>
    )
  }

  const isOwner = demandeAchat.role === 'OWNER'
  const canEdit = isOwner || demandeAchat.role === 'EDITOR' || !!user?.isAdmin
  const statusLabel = demandeAchat.validationStatut ? VALIDATION_STATUT_LABELS[demandeAchat.validationStatut] : NON_ENGAGEE_LABEL
  const approbations = demandeAchat.approbations ?? []

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/procurement" className="text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 inline-flex items-center gap-1 mb-3">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          Commande publique
        </Link>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <span className="text-3xl">📝</span>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">{demandeAchat.numero}</h1>
              <p className="text-sm text-gray-400 mt-0.5">{demandeAchat.objet} · {formatDate(demandeAchat.dateDemande)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {(isOwner || user?.isAdmin) && (
              <button onClick={() => setShowShare(true)} className="p-2 rounded-xl text-gray-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-950 transition-colors" title="Partager">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
                  <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                </svg>
              </button>
            )}
            <span className={`text-xs font-medium px-2.5 py-1 rounded-lg ${statusLabel.cls}`}>{statusLabel.label}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-4">
          <p className="text-xs text-gray-400">Lots</p>
          <p className="text-xl font-bold text-gray-900 dark:text-white mt-1">{demandeAchat.lots.length}</p>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-4">
          <p className="text-xs text-gray-400">Total</p>
          <p className="text-xl font-bold text-gray-900 dark:text-white mt-1">{formatMontant(demandeAchat.total)}</p>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-4">
          <p className="text-xs text-gray-400 mb-1">Équipe demandeuse</p>
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">{demandeAchat.orgUnit ? `${ORG_UNIT_NIVEAU_LABELS[demandeAchat.orgUnit.niveau]} · ${demandeAchat.orgUnit.nom}` : '—'}</p>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-4">
          <p className="text-xs text-gray-400 mb-1">Activité</p>
          {canEdit && demandeAchat.validationStatut ? (
            <select
              value={demandeAchat.activiteId ?? ''}
              onChange={(e) => updateDemandeAchat({ activiteId: e.target.value || null })}
              className="w-full text-sm border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary-400 bg-white"
            >
              <option value="">— Aucune —</option>
              {activites.map((a) => <option key={a.id} value={a.id}>{a.nom}</option>)}
            </select>
          ) : (
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">{demandeAchat.activite?.nom ?? '—'}</p>
          )}
        </div>
      </div>

      {!demandeAchat.validationStatut && (
        <EngagerPanel orgUnits={orgUnits} activites={activites} onEngager={engagerDemandeAchat} />
      )}

      {canEdit && demandeAchat.validationStatut === 'EN_VALIDATION' && (
        <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-800/50 rounded-2xl p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">Circuit de validation en cours.</p>
          <button onClick={() => setConfirmAbandon(true)} className="text-xs text-red-600 hover:text-red-800 font-semibold dark:text-red-400">Abandonner le circuit</button>
        </div>
      )}

      {approbations.length > 0 && (
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Circuit de validation</h2>
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800">
                  <th className="text-left text-[10px] font-medium text-gray-400 uppercase tracking-wide px-4 py-2.5">Étape</th>
                  <th className="text-left text-[10px] font-medium text-gray-400 uppercase tracking-wide px-4 py-2.5">Statut</th>
                  <th className="text-left text-[10px] font-medium text-gray-400 uppercase tracking-wide px-4 py-2.5">Validateur</th>
                  <th className="w-48" />
                </tr>
              </thead>
              <tbody>
                {approbations.map((a, i) => {
                  const isCurrent = a.statut === 'EN_ATTENTE' && approbations.slice(0, i).every((p) => p.statut === 'APPROUVEE')
                  return (
                    <tr key={a.id} className="border-b border-gray-50 dark:border-gray-800/60 last:border-0">
                      <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-200">
                        {a.type === 'FINANCE' ? 'Finance' : a.orgUnit ? `${ORG_UNIT_NIVEAU_LABELS[a.orgUnit.niveau]} · ${a.orgUnit.nom}` : '—'}
                      </td>
                      <td className="px-4 py-3"><span className={`text-xs font-medium px-2.5 py-1 rounded-lg ${STATUT_APPROBATION_LABELS[a.statut].cls}`}>{STATUT_APPROBATION_LABELS[a.statut].label}</span></td>
                      <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{a.validateur?.name ?? '—'}</td>
                      <td className="px-4 py-3">
                        {isCurrent && (
                          <div className="flex gap-2 justify-end">
                            <button onClick={() => decideApprobation(a.id, 'REJETEE').catch((err) => alert((err as Error).message))} className="rounded-lg border border-red-200 dark:border-red-900 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-950">Rejeter</button>
                            <button onClick={() => decideApprobation(a.id, 'APPROUVEE').catch((err) => alert((err as Error).message))} className="rounded-lg bg-primary-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-primary-700">Approuver</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {demandeAchat.commande && (
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Commande (rustine PGI)</h2>
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-4 flex items-center justify-between flex-wrap gap-3">
            <div>
              <p className="text-sm font-semibold text-gray-800 dark:text-white">{demandeAchat.commande.numero}</p>
              <p className="text-xs text-gray-400 mt-0.5">
                {demandeAchat.commande.referencePgi ? `Réf. PGI ${demandeAchat.commande.referencePgi}` : 'Pas de référence PGI'} · émise le {formatDate(demandeAchat.commande.dateEmission)}
              </p>
            </div>
            <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1">
              {COMMANDE_STATUSES.map((s) => (
                <button
                  key={s}
                  onClick={() => updateCommande(demandeAchat.commande!.id, { statut: s })} disabled={!canEdit}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                    demandeAchat.commande!.statut === s ? COMMANDE_STATUT_LABELS[s].cls : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
                  }`}
                >
                  {COMMANDE_STATUT_LABELS[s].label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Lots de la demande</h2>

      {demandeAchat.lots.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700 p-8 text-center">
          <p className="text-gray-500 text-sm">Aucun lot pour l&apos;instant.</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800">
                <th className="text-left text-[10px] font-medium text-gray-400 uppercase tracking-wide px-4 py-2.5">Intitulé</th>
                <th className="text-left text-[10px] font-medium text-gray-400 uppercase tracking-wide px-4 py-2.5">Source</th>
                <th className="text-left text-[10px] font-medium text-gray-400 uppercase tracking-wide px-4 py-2.5">Titulaire</th>
                <th className="text-left text-[10px] font-medium text-gray-400 uppercase tracking-wide px-4 py-2.5">Montant</th>
              </tr>
            </thead>
            <tbody>
              {demandeAchat.lots.map((lot) => (
                <tr key={lot.id} className="border-b border-gray-50 dark:border-gray-800/60 last:border-0">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">{lot.intitule}</td>
                  <td className="px-4 py-3 text-sm">
                    {lot.contratLot ? (
                      <Link href={`/procurement/contrats/${lot.contratLot.contrat.id}`} className="text-primary-600 hover:underline dark:text-primary-400">
                        {lot.contratLot.contrat.numero} · {lot.contratLot.numero}
                      </Link>
                    ) : (
                      <span className="text-xs font-medium px-2 py-0.5 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">Gré à gré</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{lot.contratLot?.titulaire ?? lot.titulaire ?? '—'}</td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-200">{formatMontant(lot.montant)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showShare && <ModuleShareModal module="procurement-demande-achat" resourceId={demandeAchat.id} resourceName={demandeAchat.numero} onClose={() => setShowShare(false)} />}

      {confirmAbandon && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-6 w-full max-w-sm">
            <h3 className="text-base font-bold text-gray-900 dark:text-white mb-2">Abandonner le circuit de validation ?</h3>
            <p className="text-sm text-gray-500 mb-5">La demande reste visible côté PGI ; elle redevient &laquo; non engagée &raquo;. Action irréversible.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmAbandon(false)} className="flex-1 rounded-xl border border-gray-200 dark:border-gray-700 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">Annuler</button>
              <button
                onClick={async () => {
                  try { await abandonnerEngagement(); setConfirmAbandon(false) }
                  catch (err) { alert((err as Error).message) }
                }}
                className="flex-1 rounded-xl bg-red-600 py-2 text-sm font-semibold text-white hover:bg-red-700"
              >
                Abandonner
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
