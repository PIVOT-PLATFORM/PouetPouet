'use client'

import { use } from 'react'
import Link from 'next/link'
import { useContrat } from '@/hooks/useProcurement'
import { CONTRAT_STATUT_LABELS, formatMontant, formatDate } from '@/lib/procurement'

// Fiche contrat — lecture seule : les contrats sont des données externes (pod
// pgi-mock, type SAP), leur cycle de vie n'est plus géré par l'app.
export default function ContratPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { contrat, isLoading, error } = useContrat(id)

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-600 border-t-transparent" /></div>
  }
  if (error || !contrat) {
    return (
      <div className="text-center py-16">
        <div className="text-5xl mb-4">😕</div>
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Contrat introuvable</h2>
        <Link href="/procurement" className="text-sm text-primary-600 hover:text-primary-700 mt-3 inline-block">← Retour</Link>
      </div>
    )
  }

  const status = CONTRAT_STATUT_LABELS[contrat.statut]
  const montantMaxTotal = contrat.lots.reduce((s, l) => s + (l.montantMax ?? 0), 0)
  const consommeTotal = contrat.lots.reduce((s, l) => s + l.consomme, 0)

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/procurement" className="text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 inline-flex items-center gap-1 mb-3">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          Commande publique
        </Link>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🏛️</span>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{contrat.numero}</h1>
              <p className="text-sm text-gray-400 mt-0.5">
                {contrat.objet} · {formatDate(contrat.dateDebut)}{contrat.dateFin && ` → ${formatDate(contrat.dateFin)}`}
              </p>
            </div>
          </div>
          <span className={`text-xs font-medium px-2.5 py-1 rounded-lg ${status.cls}`}>{status.label}</span>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Lots', value: String(contrat.lots.length) },
          { label: 'Montant max', value: formatMontant(montantMaxTotal || null) },
          { label: 'Consommé', value: formatMontant(consommeTotal) },
          { label: 'Restant', value: formatMontant(montantMaxTotal ? montantMaxTotal - consommeTotal : null) },
        ].map((c) => (
          <div key={c.label} className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-4">
            <p className="text-xs text-gray-400">{c.label}</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white mt-1">{c.value}</p>
          </div>
        ))}
      </div>

      {/* Lots table */}
      <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Lots du contrat</h2>

      {contrat.lots.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700 p-8 text-center">
          <p className="text-gray-500 text-sm">Aucun lot pour l&apos;instant.</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800">
                <th className="text-left text-[10px] font-medium text-gray-400 uppercase tracking-wide px-4 py-2.5">Lot</th>
                <th className="text-left text-[10px] font-medium text-gray-400 uppercase tracking-wide px-4 py-2.5">Titulaire</th>
                <th className="text-left text-[10px] font-medium text-gray-400 uppercase tracking-wide px-4 py-2.5">Montant max</th>
                <th className="text-left text-[10px] font-medium text-gray-400 uppercase tracking-wide px-4 py-2.5">Consommation</th>
              </tr>
            </thead>
            <tbody>
              {contrat.lots.map((lot) => {
                const pct = lot.montantMax ? Math.min(100, Math.round((lot.consomme / lot.montantMax) * 100)) : null
                return (
                  <tr key={lot.id} className="border-b border-gray-50 dark:border-gray-800/60 last:border-0">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-gray-900 dark:text-white text-sm">{lot.numero}</p>
                      <p className="text-xs text-gray-400">{lot.intitule}</p>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{lot.titulaire ?? '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{formatMontant(lot.montantMax)}</td>
                    <td className="px-4 py-3">
                      <p className="text-sm text-gray-600 dark:text-gray-300">{formatMontant(lot.consomme)}{pct != null && <span className="text-gray-400"> · {pct}%</span>}</p>
                      {pct != null && (
                        <div className="w-32 h-1.5 rounded-full bg-gray-100 dark:bg-gray-800 mt-1.5 overflow-hidden">
                          <div className={`h-full rounded-full ${pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-amber-500' : 'bg-primary-500'}`} style={{ width: `${pct}%` }} />
                        </div>
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
  )
}
