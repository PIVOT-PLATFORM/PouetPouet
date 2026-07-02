'use client'

import { use } from 'react'
import Link from 'next/link'
import { useProduit } from '@/hooks/useProcurement'
import {
  ACTIVITE_STATUT_LABELS, METEO_LABELS, TYPE_LIGNE_BUDGET_LABELS, RISQUE_STATUT_LABELS, criticiteClass, formatMontant,
} from '@/lib/procurement'

export default function ProduitPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { produit, isLoading, error } = useProduit(id)

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-600 border-t-transparent" /></div>
  }
  if (error || !produit) {
    return (
      <div className="text-center py-16">
        <div className="text-5xl mb-4">😕</div>
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Produit introuvable</h2>
        <Link href="/procurement" className="text-sm text-primary-600 hover:text-primary-700 mt-3 inline-block">← Retour</Link>
      </div>
    )
  }

  const risquesOuverts = produit.risques.filter((r) => r.statut !== 'CLOS').length

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/procurement" className="text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 inline-flex items-center gap-1 mb-3">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          Commande publique
        </Link>
        <div className="flex items-center gap-3">
          <span className="text-3xl">📦</span>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{produit.nom}</h1>
        </div>
        <p className="text-sm text-gray-400 mt-1">Agrégation des gains, risques et budgets sur {produit.activites.length} activité{produit.activites.length > 1 ? 's' : ''}</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-4">
          <p className="text-xs text-gray-400">Activités</p>
          <p className="text-xl font-bold text-gray-900 dark:text-white mt-1">{produit.activites.length}</p>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-4">
          <p className="text-xs text-gray-400">Gains totaux</p>
          <p className="text-xl font-bold text-gray-900 dark:text-white mt-1">{formatMontant(produit.gainsTotal)}</p>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-4">
          <p className="text-xs text-gray-400">Risques ouverts</p>
          <p className="text-xl font-bold text-gray-900 dark:text-white mt-1">{risquesOuverts} / {produit.risques.length}</p>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-4">
          <p className="text-xs text-gray-400">Lignes budgétaires</p>
          <p className="text-xl font-bold text-gray-900 dark:text-white mt-1">{produit.budgetParAnneeType.length}</p>
        </div>
      </div>

      {Object.keys(produit.gainsParTypologie).length > 0 && (
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Gains par typologie</h2>
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-4 flex flex-wrap gap-3">
            {Object.entries(produit.gainsParTypologie).map(([typologie, montant]) => (
              <div key={typologie} className="bg-gray-50 dark:bg-gray-800/50 rounded-xl px-3 py-2">
                <p className="text-xs text-gray-400">{typologie}</p>
                <p className="text-sm font-semibold text-gray-800 dark:text-white">{formatMontant(montant)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {produit.budgetParAnneeType.length > 0 && (
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Budget agrégé par année / type</h2>
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-x-auto">
            <table className="w-full">
              <thead><tr className="border-b border-gray-100 dark:border-gray-800">
                <th className="text-left text-[10px] font-medium text-gray-400 uppercase tracking-wide px-4 py-2.5">Année</th>
                <th className="text-left text-[10px] font-medium text-gray-400 uppercase tracking-wide px-4 py-2.5">Type</th>
                <th className="text-left text-[10px] font-medium text-gray-400 uppercase tracking-wide px-4 py-2.5">MO</th>
                <th className="text-left text-[10px] font-medium text-gray-400 uppercase tracking-wide px-4 py-2.5">HMO</th>
              </tr></thead>
              <tbody>
                {produit.budgetParAnneeType.map((b) => (
                  <tr key={`${b.annee}-${b.type}`} className="border-b border-gray-50 dark:border-gray-800/60 last:border-0">
                    <td className="px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200">{b.annee}</td>
                    <td className="px-4 py-2.5 text-sm font-medium text-gray-900 dark:text-white">{TYPE_LIGNE_BUDGET_LABELS[b.type]}</td>
                    <td className="px-4 py-2.5 text-sm text-gray-600 dark:text-gray-300">{formatMontant(b.montantMo)}</td>
                    <td className="px-4 py-2.5 text-sm text-gray-600 dark:text-gray-300">{formatMontant(b.montantHmo)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Activités rattachées</h2>
        {produit.activites.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700 p-6 text-center"><p className="text-gray-500 text-sm">Aucune activité rattachée.</p></div>
        ) : (
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-x-auto">
            <table className="w-full">
              <thead><tr className="border-b border-gray-100 dark:border-gray-800">
                <th className="text-left text-[10px] font-medium text-gray-400 uppercase tracking-wide px-4 py-2.5">Nom</th>
                <th className="text-left text-[10px] font-medium text-gray-400 uppercase tracking-wide px-4 py-2.5">Météo</th>
                <th className="text-left text-[10px] font-medium text-gray-400 uppercase tracking-wide px-4 py-2.5">Statut</th>
              </tr></thead>
              <tbody>
                {produit.activites.map((a) => (
                  <tr key={a.id} className="border-b border-gray-50 dark:border-gray-800/60 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800/40">
                    <td className="px-4 py-2.5 text-sm"><Link href={`/procurement/activites/${a.id}`} className="font-semibold text-primary-600 hover:underline dark:text-primary-400">{a.nom}</Link></td>
                    <td className="px-4 py-2.5 text-sm">{METEO_LABELS[a.meteo].emoji} {METEO_LABELS[a.meteo].label}</td>
                    <td className="px-4 py-2.5"><span className={`text-xs font-medium px-2.5 py-1 rounded-lg ${ACTIVITE_STATUT_LABELS[a.statut].cls}`}>{ACTIVITE_STATUT_LABELS[a.statut].label}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {produit.risques.length > 0 && (
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Risques agrégés (triés par criticité)</h2>
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-x-auto">
            <table className="w-full">
              <thead><tr className="border-b border-gray-100 dark:border-gray-800">
                <th className="text-left text-[10px] font-medium text-gray-400 uppercase tracking-wide px-4 py-2.5">Risque</th>
                <th className="text-left text-[10px] font-medium text-gray-400 uppercase tracking-wide px-4 py-2.5">Activité</th>
                <th className="text-left text-[10px] font-medium text-gray-400 uppercase tracking-wide px-4 py-2.5">Criticité</th>
                <th className="text-left text-[10px] font-medium text-gray-400 uppercase tracking-wide px-4 py-2.5">Statut</th>
                <th className="text-left text-[10px] font-medium text-gray-400 uppercase tracking-wide px-4 py-2.5">Jira</th>
              </tr></thead>
              <tbody>
                {produit.risques.map((r) => (
                  <tr key={r.id} className="border-b border-gray-50 dark:border-gray-800/60 last:border-0">
                    <td className="px-4 py-2.5 text-sm font-medium text-gray-900 dark:text-white">{r.titre}</td>
                    <td className="px-4 py-2.5 text-sm"><Link href={`/procurement/activites/${r.activiteId}`} className="text-primary-600 hover:underline dark:text-primary-400">{r.activiteNom}</Link></td>
                    <td className="px-4 py-2.5"><span className={`text-xs font-medium px-2.5 py-1 rounded-lg ${criticiteClass(r.criticite)}`}>{r.criticite}</span></td>
                    <td className="px-4 py-2.5"><span className={`text-xs font-medium px-2.5 py-1 rounded-lg ${RISQUE_STATUT_LABELS[r.statut].cls}`}>{RISQUE_STATUT_LABELS[r.statut].label}</span></td>
                    <td className="px-4 py-2.5 text-sm">{r.jiraLien ? <a href={r.jiraLien} target="_blank" rel="noreferrer" className="text-primary-600 hover:underline dark:text-primary-400">Ticket →</a> : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
