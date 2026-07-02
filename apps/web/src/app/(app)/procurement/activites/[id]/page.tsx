'use client'

import { use, useState } from 'react'
import Link from 'next/link'
import { useActivite, useOrgUnits, useProduits, useGovernanceConfig } from '@/hooks/useProcurement'
import type { ActiviteGain, ActiviteBudgetLigne, ActiviteRisque, TypeLigneBudget, JalonType } from '@/hooks/useProcurement'
import {
  TYPE_ACTIVITE_LABELS, ACTIVITE_STATUT_LABELS, METEO_LABELS, TYPE_LIGNE_BUDGET_LABELS, JALON_TYPE_LABELS,
  RISQUE_STATUT_LABELS, ORG_UNIT_NIVEAU_LABELS, VALIDATION_STATUT_LABELS, criticiteClass,
  formatMontant, formatDate, toDateInput,
} from '@/lib/procurement'
import type { TypeActivite, ActiviteStatut, Meteo, ContratRecherche } from '@/lib/procurement'
import { ModuleShareModal } from '@/components/share/module-share-modal'
import { ContratPicker } from '@/components/procurement/contrat-picker'
import { useAuthStore } from '@/store/auth'

const STATUTS: ActiviteStatut[] = ['ACTIF', 'SUSPENDU', 'CLOTURE']
const METEOS: Meteo[] = ['VERT', 'ORANGE', 'ROUGE', 'GRIS']

function fieldClass() {
  return 'w-full text-sm border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-400 bg-white'
}

// ── Gain modal ─────────────────────────────────────────────────────────────────

function GainModal({ gain, onSave, onClose }: { gain?: ActiviteGain | null; onSave: (input: { montant: number; typologie: string; commentaire?: string | null }) => Promise<void>; onClose: () => void }) {
  const [montant, setMontant] = useState(gain?.montant != null ? String(gain.montant) : '')
  const [typologie, setTypologie] = useState(gain?.typologie ?? '')
  const [commentaire, setCommentaire] = useState(gain?.commentaire ?? '')
  const [saving, setSaving] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!montant.trim() || !typologie.trim()) return
    setSaving(true)
    try { await onSave({ montant: parseFloat(montant), typologie: typologie.trim(), commentaire: commentaire.trim() || null }); onClose() }
    catch (err) { alert((err as Error).message); setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md">
        <div className="p-6 border-b border-gray-100 dark:border-gray-800"><h2 className="text-lg font-bold text-gray-900 dark:text-white">{gain ? 'Modifier le gain' : 'Nouveau gain'}</h2></div>
        <form onSubmit={submit} className="p-6 flex flex-col gap-4">
          <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Montant estimé (€)</label>
            <input autoFocus type="number" value={montant} onChange={(e) => setMontant(e.target.value)} className={fieldClass()} /></div>
          <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Typologie</label>
            <input value={typologie} onChange={(e) => setTypologie(e.target.value)} placeholder="Productivité, qualité, sécurité…" className={fieldClass()} /></div>
          <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Commentaire (optionnel)</label>
            <textarea value={commentaire} onChange={(e) => setCommentaire(e.target.value)} rows={2} className={fieldClass()} /></div>
        </form>
        <div className="p-6 border-t border-gray-100 dark:border-gray-800 flex gap-3">
          <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-gray-200 dark:border-gray-700 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">Annuler</button>
          <button onClick={submit} disabled={saving} className="flex-1 rounded-xl bg-primary-600 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50">{saving ? '…' : 'Enregistrer'}</button>
        </div>
      </div>
    </div>
  )
}

// ── Budget ligne modal ─────────────────────────────────────────────────────────

function BudgetLigneModal({
  ligne, departementId, onSave, onClose,
}: {
  ligne?: ActiviteBudgetLigne | null
  departementId: string | null
  onSave: (input: Record<string, unknown>) => Promise<void>
  onClose: () => void
}) {
  const { valeurs: typesLigneDisponibles } = useGovernanceConfig(departementId, 'TYPE_LIGNE_BUDGET')
  const { valeurs: jalonsConfig } = useGovernanceConfig(departementId, 'JALON_TYPE')
  const jalonsPhaseDisponibles = jalonsConfig.filter((j) => j.obligatoire).map((j) => j.valeur as JalonType)
  const [annee, setAnnee] = useState(ligne?.annee != null ? String(ligne.annee) : String(new Date().getUTCFullYear()))
  const [type, setType] = useState<TypeLigneBudget>(ligne?.type ?? 'OPEX')
  const [montantMo, setMontantMo] = useState(ligne?.montantMo != null ? String(ligne.montantMo) : '')
  const [montantHmo, setMontantHmo] = useState(ligne?.montantHmo != null ? String(ligne.montantHmo) : '')
  const [utilisateurMetier, setUtilisateurMetier] = useState(ligne?.utilisateurMetier ?? '')
  const [priorite, setPriorite] = useState(ligne?.priorite ?? '')
  const [objetGestion, setObjetGestion] = useState(ligne?.objetGestion ?? '')
  const [jalonPhase, setJalonPhase] = useState<JalonType | ''>(ligne?.jalonPhase ?? '')
  const [contratRef, setContratRef] = useState<ContratRecherche | null>(ligne?.contrat ?? null)
  const [saving, setSaving] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!annee.trim()) return
    setSaving(true)
    try {
      await onSave({
        annee: parseInt(annee, 10), type,
        montantMo: montantMo.trim() ? parseFloat(montantMo) : null,
        montantHmo: montantHmo.trim() ? parseFloat(montantHmo) : null,
        utilisateurMetier: utilisateurMetier.trim() || null,
        priorite: priorite.trim() || null,
        objetGestion: objetGestion.trim() || null,
        jalonPhase: jalonPhase || null,
        contratId: contratRef?.id || null,
      })
      onClose()
    } catch (err) { alert((err as Error).message); setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="p-6 border-b border-gray-100 dark:border-gray-800 shrink-0"><h2 className="text-lg font-bold text-gray-900 dark:text-white">{ligne ? 'Modifier la ligne budgétaire' : 'Nouvelle ligne budgétaire'}</h2></div>
        <form onSubmit={submit} className="flex-1 overflow-y-auto p-6 flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Année</label>
              <input autoFocus type="number" value={annee} onChange={(e) => setAnnee(e.target.value)} className={fieldClass()} /></div>
            <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Type</label>
              <select value={type} onChange={(e) => setType(e.target.value as TypeLigneBudget)} className={fieldClass()}>
                {/* La valeur déjà choisie reste affichée même si elle a été retirée de la config depuis. */}
                {Array.from(new Set([...typesLigneDisponibles.map((v) => v.valeur), type])).map((t) => (
                  <option key={t} value={t}>{TYPE_LIGNE_BUDGET_LABELS[t as TypeLigneBudget]}</option>
                ))}
              </select></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Montant MO (€)</label>
              <input type="number" value={montantMo} onChange={(e) => setMontantMo(e.target.value)} className={fieldClass()} /></div>
            <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Montant HMO (€)</label>
              <input type="number" value={montantHmo} onChange={(e) => setMontantHmo(e.target.value)} className={fieldClass()} /></div>
          </div>
          <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Utilisateur métier</label>
            <input value={utilisateurMetier} onChange={(e) => setUtilisateurMetier(e.target.value)} className={fieldClass()} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Priorité</label>
              <input value={priorite} onChange={(e) => setPriorite(e.target.value)} className={fieldClass()} /></div>
            <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Phase (jalon PMPG)</label>
              <select value={jalonPhase} onChange={(e) => setJalonPhase(e.target.value as JalonType)} className={fieldClass()}>
                <option value="">— Aucune —</option>
                {jalonsPhaseDisponibles.map((j) => <option key={j} value={j}>{JALON_TYPE_LABELS[j]}</option>)}
              </select></div>
          </div>
          <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Objet de gestion</label>
            <input value={objetGestion} onChange={(e) => setObjetGestion(e.target.value)} className={fieldClass()} /></div>
          <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Numéro de contrat prévu (optionnel)</label>
            <ContratPicker value={contratRef} onSelect={setContratRef} placeholder="— Pas encore —" /></div>
        </form>
        <div className="p-6 border-t border-gray-100 dark:border-gray-800 flex gap-3 shrink-0">
          <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-gray-200 dark:border-gray-700 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">Annuler</button>
          <button onClick={submit} disabled={saving} className="flex-1 rounded-xl bg-primary-600 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50">{saving ? '…' : 'Enregistrer'}</button>
        </div>
      </div>
    </div>
  )
}

// ── Risque modal ───────────────────────────────────────────────────────────────

function RisqueModal({ risque, onSave, onClose }: { risque?: ActiviteRisque | null; onSave: (input: Record<string, unknown>) => Promise<void>; onClose: () => void }) {
  const [titre, setTitre] = useState(risque?.titre ?? '')
  const [description, setDescription] = useState(risque?.description ?? '')
  const [categorie, setCategorie] = useState(risque?.categorie ?? '')
  const [probabilite, setProbabilite] = useState(risque?.probabilite ?? 3)
  const [impact, setImpact] = useState(risque?.impact ?? 3)
  const [planMitigation, setPlanMitigation] = useState(risque?.planMitigation ?? '')
  const [responsable, setResponsable] = useState(risque?.responsable ?? '')
  const [jiraLien, setJiraLien] = useState(risque?.jiraLien ?? '')
  const [saving, setSaving] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!titre.trim()) return
    setSaving(true)
    try {
      await onSave({
        titre: titre.trim(), description: description.trim() || null, categorie: categorie.trim() || null,
        probabilite, impact, planMitigation: planMitigation.trim() || null, responsable: responsable.trim() || null,
        jiraLien: jiraLien.trim() || null,
      })
      onClose()
    } catch (err) { alert((err as Error).message); setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="p-6 border-b border-gray-100 dark:border-gray-800 shrink-0"><h2 className="text-lg font-bold text-gray-900 dark:text-white">{risque ? 'Modifier le risque' : 'Nouveau risque'}</h2></div>
        <form onSubmit={submit} className="flex-1 overflow-y-auto p-6 flex flex-col gap-4">
          <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Titre</label>
            <input autoFocus value={titre} onChange={(e) => setTitre(e.target.value)} className={fieldClass()} /></div>
          <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className={fieldClass()} /></div>
          <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Catégorie</label>
            <input value={categorie} onChange={(e) => setCategorie(e.target.value)} placeholder="Technique, financier, organisationnel…" className={fieldClass()} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Probabilité (1-5)</label>
              <input type="number" min="1" max="5" value={probabilite} onChange={(e) => setProbabilite(parseInt(e.target.value, 10) || 1)} className={fieldClass()} /></div>
            <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Impact (1-5)</label>
              <input type="number" min="1" max="5" value={impact} onChange={(e) => setImpact(parseInt(e.target.value, 10) || 1)} className={fieldClass()} /></div>
          </div>
          <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Plan de mitigation</label>
            <textarea value={planMitigation} onChange={(e) => setPlanMitigation(e.target.value)} rows={2} className={fieldClass()} /></div>
          <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Responsable</label>
            <input value={responsable} onChange={(e) => setResponsable(e.target.value)} className={fieldClass()} /></div>
          <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Lien Jira (action de remédiation)</label>
            <input value={jiraLien} onChange={(e) => setJiraLien(e.target.value)} placeholder="https://jira…/ABC-123" className={fieldClass()} /></div>
        </form>
        <div className="p-6 border-t border-gray-100 dark:border-gray-800 flex gap-3 shrink-0">
          <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-gray-200 dark:border-gray-700 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">Annuler</button>
          <button onClick={submit} disabled={saving} className="flex-1 rounded-xl bg-primary-600 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50">{saving ? '…' : 'Enregistrer'}</button>
        </div>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ActivitePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const {
    activite, isLoading, error, updateActivite,
    addGain, deleteGain, addFaitMarquant, deleteFaitMarquant,
    addBudgetLigne, updateBudgetLigne, deleteBudgetLigne,
    addJalon, updateJalon, deleteJalon,
    addRisque, updateRisque, deleteRisque,
  } = useActivite(id)
  const { orgUnits } = useOrgUnits()
  const { produits, createProduit } = useProduits()
  const user = useAuthStore((s) => s.user)
  const { valeurs: typesActiviteDisponibles } = useGovernanceConfig(activite?.departementId, 'TYPE_ACTIVITE')

  const [showShare, setShowShare] = useState(false)
  const [gainModal, setGainModal] = useState(false)
  const [budgetModal, setBudgetModal] = useState<{ open: boolean; ligne: ActiviteBudgetLigne | null }>({ open: false, ligne: null })
  const [risqueModal, setRisqueModal] = useState<{ open: boolean; risque: ActiviteRisque | null }>({ open: false, risque: null })
  const [newFaitDate, setNewFaitDate] = useState(new Date().toISOString().slice(0, 10))
  const [newFaitTexte, setNewFaitTexte] = useState('')
  const [newJalonType, setNewJalonType] = useState<JalonType>('COMITE_TECHNIQUE')
  const [newJalonLibelle, setNewJalonLibelle] = useState('')
  const [newProduitNom, setNewProduitNom] = useState('')

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-600 border-t-transparent" /></div>
  }
  if (error || !activite) {
    return (
      <div className="text-center py-16">
        <div className="text-5xl mb-4">😕</div>
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Activité introuvable</h2>
        <Link href="/procurement" className="text-sm text-primary-600 hover:text-primary-700 mt-3 inline-block">← Retour</Link>
      </div>
    )
  }

  const isOwner = !activite.role || activite.role === 'OWNER'
  const canEdit = isOwner || activite.role === 'EDITOR' || !!user?.isAdmin
  const departements = orgUnits.filter((u) => u.niveau === 'DEPARTEMENT')
  const gainsTotal = activite.gains.reduce((s, g) => s + g.montant, 0)
  const jalonTypesObligatoires = new Set(activite.jalons.filter((j) => j.obligatoire).map((j) => j.type))
  const jalonsLibresDisponibles = (Object.keys(JALON_TYPE_LABELS) as JalonType[]).filter((t) => !jalonTypesObligatoires.has(t))

  async function handleAddProduit() {
    if (!newProduitNom.trim()) return
    const produit = await createProduit(newProduitNom.trim())
    setNewProduitNom('')
    await updateActivite({ produitId: produit.id })
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/procurement" className="text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 inline-flex items-center gap-1 mb-3">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          Commande publique
        </Link>
        <fieldset disabled={!canEdit} className="contents">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{METEO_LABELS[activite.meteo].emoji}</span>
            <div>
              <input
                value={activite.nom}
                onChange={(e) => updateActivite({ nom: e.target.value })}
                className="text-2xl font-bold text-gray-900 dark:text-white bg-transparent border border-transparent hover:border-gray-200 dark:hover:border-gray-700 focus:border-primary-400 rounded-lg px-1 -mx-1 outline-none"
              />
              <p className="text-sm text-gray-400 mt-0.5">
                {TYPE_ACTIVITE_LABELS[activite.type]}
                {activite.enjeux && <span className="ml-2 text-amber-600 dark:text-amber-400 font-medium">⚠ Enjeux</span>}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {(isOwner || user?.isAdmin) && (
              <button onClick={() => setShowShare(true)} className="p-2 rounded-xl text-gray-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-950 transition-colors" title="Partager">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
                  <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                </svg>
              </button>
            )}
            <label className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 cursor-pointer">
              <input type="checkbox" checked={activite.enjeux} onChange={(e) => updateActivite({ enjeux: e.target.checked })} className="accent-primary-600" />
              Projet à enjeux
            </label>
            <select value={activite.type} onChange={(e) => updateActivite({ type: e.target.value as TypeActivite })} className="text-xs rounded-lg border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white px-2 py-1.5 bg-white">
              {Array.from(new Set([...typesActiviteDisponibles.map((v) => v.valeur), activite.type])).map((t) => (
                <option key={t} value={t}>{TYPE_ACTIVITE_LABELS[t as TypeActivite]}</option>
              ))}
            </select>
            <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1">
              {METEOS.map((m) => (
                <button key={m} onClick={() => updateActivite({ meteo: m })} title={METEO_LABELS[m].label}
                  className={`px-2 py-1.5 rounded-lg text-sm transition-colors ${activite.meteo === m ? METEO_LABELS[m].cls : 'opacity-40 hover:opacity-70'}`}>
                  {METEO_LABELS[m].emoji}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1">
              {STATUTS.map((s) => (
                <button key={s} onClick={() => updateActivite({ statut: s })}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${activite.statut === s ? ACTIVITE_STATUT_LABELS[s].cls : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'}`}>
                  {ACTIVITE_STATUT_LABELS[s].label}
                </button>
              ))}
            </div>
          </div>
        </div>
        </fieldset>
      </div>

      <fieldset disabled={!canEdit} className="contents">
      {/* Identité */}
      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Identité</h2>
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Description</label>
          <textarea
            defaultValue={activite.description ?? ''}
            onBlur={(e) => updateActivite({ description: e.target.value || null })}
            rows={3}
            className={fieldClass()}
          />
        </div>

        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Gains estimés — total {formatMontant(gainsTotal)}</h3>
          <button onClick={() => setGainModal(true)} className="text-xs text-primary-600 hover:text-primary-800 font-semibold dark:text-primary-400">+ Ajouter un gain</button>
        </div>
        {activite.gains.length > 0 && (
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-x-auto">
            <table className="w-full">
              <thead><tr className="border-b border-gray-100 dark:border-gray-800">
                <th className="text-left text-[10px] font-medium text-gray-400 uppercase tracking-wide px-4 py-2.5">Typologie</th>
                <th className="text-left text-[10px] font-medium text-gray-400 uppercase tracking-wide px-4 py-2.5">Montant</th>
                <th className="text-left text-[10px] font-medium text-gray-400 uppercase tracking-wide px-4 py-2.5">Commentaire</th>
                <th className="w-10" />
              </tr></thead>
              <tbody>
                {activite.gains.map((g) => (
                  <tr key={g.id} className="border-b border-gray-50 dark:border-gray-800/60 last:border-0">
                    <td className="px-4 py-2.5 text-sm font-medium text-gray-900 dark:text-white">{g.typologie}</td>
                    <td className="px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200">{formatMontant(g.montant)}</td>
                    <td className="px-4 py-2.5 text-sm text-gray-500 dark:text-gray-400">{g.commentaire ?? '—'}</td>
                    <td className="px-4 py-2.5"><button onClick={() => deleteGain(g.id)} className="text-gray-300 hover:text-red-500 text-xs">✕</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mt-2">Faits marquants / historique</h3>
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-4 flex flex-col gap-3">
          <form
            onSubmit={async (e) => { e.preventDefault(); if (!newFaitTexte.trim()) return; await addFaitMarquant({ date: newFaitDate, texte: newFaitTexte.trim() }); setNewFaitTexte('') }}
            className="flex gap-2"
          >
            <input type="date" value={newFaitDate} onChange={(e) => setNewFaitDate(e.target.value)} className="border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-lg px-2 py-1.5 text-sm" />
            <input value={newFaitTexte} onChange={(e) => setNewFaitTexte(e.target.value)} placeholder="Nouveau fait marquant…" className="flex-1 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-lg px-2 py-1.5 text-sm" />
            <button type="submit" className="rounded-lg bg-primary-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-primary-700">Ajouter</button>
          </form>
          {activite.faitsMarquants.length === 0 ? (
            <p className="text-sm text-gray-400">Aucun fait marquant pour l&apos;instant.</p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {activite.faitsMarquants.map((f) => (
                <li key={f.id} className="flex items-start justify-between text-sm gap-3">
                  <span><span className="text-gray-400">{formatDate(f.date)}</span> — <span className="text-gray-700 dark:text-gray-200">{f.texte}</span></span>
                  <button onClick={() => deleteFaitMarquant(f.id)} className="text-gray-300 hover:text-red-500 text-xs shrink-0">✕</button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Structurel */}
      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Structurel</h2>
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div><label className="block text-xs text-gray-400 mb-1">PMT</label>
            <input defaultValue={activite.pmt ?? ''} onBlur={(e) => updateActivite({ pmt: e.target.value || null })} className={fieldClass()} /></div>
          <div><label className="block text-xs text-gray-400 mb-1">Pilote (email)</label>
            <input defaultValue={activite.pilote?.email ?? ''} onBlur={(e) => updateActivite({ piloteEmail: e.target.value || null })} placeholder="email@exemple.fr" className={fieldClass()} /></div>
          <div><label className="block text-xs text-gray-400 mb-1">Priorité métier</label>
            <input defaultValue={activite.prioriteMetier ?? ''} onBlur={(e) => updateActivite({ prioriteMetier: e.target.value || null })} className={fieldClass()} /></div>

          <div>
            <label className="block text-xs text-gray-400 mb-1">Produit associé</label>
            <select value={activite.produitId ?? ''} onChange={(e) => updateActivite({ produitId: e.target.value || null })} className={fieldClass()}>
              <option value="">N/A</option>
              {produits.map((p) => <option key={p.id} value={p.id}>{p.nom}</option>)}
            </select>
            <div className="flex gap-1.5 mt-1.5">
              <input value={newProduitNom} onChange={(e) => setNewProduitNom(e.target.value)} placeholder="Nouveau produit…" className="flex-1 text-xs border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-lg px-2 py-1" />
              <button type="button" onClick={handleAddProduit} className="text-xs text-primary-600 hover:text-primary-800 font-semibold dark:text-primary-400 shrink-0">+ Créer</button>
            </div>
          </div>
          <div><label className="block text-xs text-gray-400 mb-1">Département</label>
            <select value={activite.departementId ?? ''} onChange={(e) => updateActivite({ departementId: e.target.value || null })} className={fieldClass()}>
              <option value="">— Aucun —</option>
              {departements.map((d) => <option key={d.id} value={d.id}>{d.nom}</option>)}
            </select></div>
          <div><label className="block text-xs text-gray-400 mb-1">Pôle</label>
            <input defaultValue={activite.pole ?? ''} onBlur={(e) => updateActivite({ pole: e.target.value || null })} className={fieldClass()} /></div>

          <div><label className="block text-xs text-gray-400 mb-1">Domaine métier</label>
            <input defaultValue={activite.domaineMetier ?? ''} onBlur={(e) => updateActivite({ domaineMetier: e.target.value || null })} className={fieldClass()} /></div>
          <div><label className="block text-xs text-gray-400 mb-1">Sous-domaine métier</label>
            <input defaultValue={activite.sousDomaineMetier ?? ''} onBlur={(e) => updateActivite({ sousDomaineMetier: e.target.value || null })} className={fieldClass()} /></div>
          <div><label className="block text-xs text-gray-400 mb-1">Capacité métier (HOPEX)</label>
            <input defaultValue={activite.capaciteMetier ?? ''} onBlur={(e) => updateActivite({ capaciteMetier: e.target.value || null })} className={fieldClass()} /></div>

          <div><label className="block text-xs text-gray-400 mb-1">Sous-capacité métier</label>
            <input defaultValue={activite.sousCapaciteMetier ?? ''} onBlur={(e) => updateActivite({ sousCapaciteMetier: e.target.value || null })} className={fieldClass()} /></div>
          <div><label className="block text-xs text-gray-400 mb-1">Lien schéma directeur (HOPEX)</label>
            <input defaultValue={activite.hopexLien ?? ''} onBlur={(e) => updateActivite({ hopexLien: e.target.value || null })} placeholder="https://…" className={fieldClass()} /></div>
          <div className="flex items-end gap-4 pb-1.5">
            <label className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-300 cursor-pointer">
              <input type="checkbox" checked={activite.planProduction} onChange={(e) => updateActivite({ planProduction: e.target.checked })} className="accent-primary-600" />
              Plan de production
            </label>
            <label className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-300 cursor-pointer">
              <input type="checkbox" checked={activite.schemaDirecteur} onChange={(e) => updateActivite({ schemaDirecteur: e.target.checked })} className="accent-primary-600" />
              Schéma directeur
            </label>
          </div>
        </div>
      </div>

      {/* Budget */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Budget pluriannuel déclaratif</h2>
          <button onClick={() => setBudgetModal({ open: true, ligne: null })} className="text-xs text-primary-600 hover:text-primary-800 font-semibold dark:text-primary-400">+ Ajouter une ligne</button>
        </div>
        {activite.budgetLignes.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700 p-6 text-center"><p className="text-gray-500 text-sm">Aucune ligne budgétaire.</p></div>
        ) : (
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-x-auto">
            <table className="w-full">
              <thead><tr className="border-b border-gray-100 dark:border-gray-800">
                <th className="text-left text-[10px] font-medium text-gray-400 uppercase tracking-wide px-4 py-2.5">Année</th>
                <th className="text-left text-[10px] font-medium text-gray-400 uppercase tracking-wide px-4 py-2.5">Type</th>
                <th className="text-left text-[10px] font-medium text-gray-400 uppercase tracking-wide px-4 py-2.5">MO</th>
                <th className="text-left text-[10px] font-medium text-gray-400 uppercase tracking-wide px-4 py-2.5">HMO</th>
                <th className="text-left text-[10px] font-medium text-gray-400 uppercase tracking-wide px-4 py-2.5">Phase</th>
                <th className="text-left text-[10px] font-medium text-gray-400 uppercase tracking-wide px-4 py-2.5">Contrat</th>
                <th className="w-16" />
              </tr></thead>
              <tbody>
                {activite.budgetLignes.map((l) => (
                  <tr key={l.id} className="border-b border-gray-50 dark:border-gray-800/60 last:border-0">
                    <td className="px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200">{l.annee}</td>
                    <td className="px-4 py-2.5 text-sm font-medium text-gray-900 dark:text-white">{TYPE_LIGNE_BUDGET_LABELS[l.type]}</td>
                    <td className="px-4 py-2.5 text-sm text-gray-600 dark:text-gray-300">{formatMontant(l.montantMo)}</td>
                    <td className="px-4 py-2.5 text-sm text-gray-600 dark:text-gray-300">{formatMontant(l.montantHmo)}</td>
                    <td className="px-4 py-2.5 text-xs text-gray-500 dark:text-gray-400">{l.jalonPhase ? JALON_TYPE_LABELS[l.jalonPhase] : '—'}</td>
                    <td className="px-4 py-2.5 text-sm">{l.contrat ? <Link href={`/procurement/contrats/${l.contrat.id}`} className="text-primary-600 hover:underline dark:text-primary-400">{l.contrat.numero}</Link> : <span className="text-gray-400">pas encore</span>}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex gap-1 justify-end">
                        <button onClick={() => setBudgetModal({ open: true, ligne: l })} className="text-gray-300 hover:text-primary-600 text-xs">✎</button>
                        <button onClick={() => deleteBudgetLigne(l.id)} className="text-gray-300 hover:text-red-500 text-xs">✕</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Jalonnement */}
      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Jalonnement PMPG</h2>
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-x-auto">
          <table className="w-full">
            <thead><tr className="border-b border-gray-100 dark:border-gray-800">
              <th className="text-left text-[10px] font-medium text-gray-400 uppercase tracking-wide px-4 py-2.5">Jalon</th>
              <th className="text-left text-[10px] font-medium text-gray-400 uppercase tracking-wide px-4 py-2.5">Date prévue</th>
              <th className="text-left text-[10px] font-medium text-gray-400 uppercase tracking-wide px-4 py-2.5">Date réelle</th>
              <th className="text-left text-[10px] font-medium text-gray-400 uppercase tracking-wide px-4 py-2.5">Décision</th>
              <th className="w-10" />
            </tr></thead>
            <tbody>
              {activite.jalons.map((j) => (
                <tr key={j.id} className="border-b border-gray-50 dark:border-gray-800/60 last:border-0">
                  <td className="px-4 py-2.5 text-sm font-medium text-gray-900 dark:text-white">{j.type === 'AUTRE' ? (j.libelle || 'Autre') : JALON_TYPE_LABELS[j.type]}</td>
                  <td className="px-4 py-2.5"><input type="date" defaultValue={j.datePrevue ? toDateInput(j.datePrevue) : ''} onBlur={(e) => updateJalon(j.id, { datePrevue: e.target.value || null })} className="text-sm border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-lg px-2 py-1" /></td>
                  <td className="px-4 py-2.5"><input type="date" defaultValue={j.dateReelle ? toDateInput(j.dateReelle) : ''} onBlur={(e) => updateJalon(j.id, { dateReelle: e.target.value || null })} className="text-sm border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-lg px-2 py-1" /></td>
                  <td className="px-4 py-2.5"><input defaultValue={j.decision ?? ''} onBlur={(e) => updateJalon(j.id, { decision: e.target.value || null })} placeholder="Décision…" className="text-sm border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-lg px-2 py-1 w-full" /></td>
                  <td className="px-4 py-2.5">
                    {!j.obligatoire && <button onClick={() => deleteJalon(j.id)} className="text-gray-300 hover:text-red-500 text-xs">✕</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <form
            onSubmit={async (e) => { e.preventDefault(); await addJalon({ type: newJalonType, libelle: newJalonType === 'AUTRE' ? newJalonLibelle.trim() || null : null }); setNewJalonLibelle('') }}
            className="flex items-center gap-2 p-3 border-t border-gray-100 dark:border-gray-800"
          >
            <select value={newJalonType} onChange={(e) => setNewJalonType(e.target.value as JalonType)} className="text-sm border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-lg px-2 py-1.5">
              {/* Tout type de jalon non marqué obligatoire pour cette activité (les
                  obligatoires sont résolus par la config de gouvernance à la création
                  et déjà présents, cf. POST /activites) — les autres restent ajoutables
                  librement, y compris plusieurs fois (ex: plusieurs comités). */}
              {jalonsLibresDisponibles.map((t) => <option key={t} value={t}>{JALON_TYPE_LABELS[t]}</option>)}
            </select>
            {newJalonType === 'AUTRE' && (
              <input value={newJalonLibelle} onChange={(e) => setNewJalonLibelle(e.target.value)} placeholder="Intitulé du jalon…" className="flex-1 text-sm border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-lg px-2 py-1.5" />
            )}
            <button type="submit" className="text-xs text-primary-600 hover:text-primary-800 font-semibold dark:text-primary-400 shrink-0">+ Ajouter un jalon libre</button>
          </form>
        </div>
      </div>

      {/* Risques */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Registre de risques</h2>
          <button onClick={() => setRisqueModal({ open: true, risque: null })} className="text-xs text-primary-600 hover:text-primary-800 font-semibold dark:text-primary-400">+ Ajouter un risque</button>
        </div>
        {activite.risques.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700 p-6 text-center"><p className="text-gray-500 text-sm">Aucun risque identifié.</p></div>
        ) : (
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-x-auto">
            <table className="w-full">
              <thead><tr className="border-b border-gray-100 dark:border-gray-800">
                <th className="text-left text-[10px] font-medium text-gray-400 uppercase tracking-wide px-4 py-2.5">Risque</th>
                <th className="text-left text-[10px] font-medium text-gray-400 uppercase tracking-wide px-4 py-2.5">Criticité</th>
                <th className="text-left text-[10px] font-medium text-gray-400 uppercase tracking-wide px-4 py-2.5">Statut</th>
                <th className="text-left text-[10px] font-medium text-gray-400 uppercase tracking-wide px-4 py-2.5">Jira</th>
                <th className="w-16" />
              </tr></thead>
              <tbody>
                {[...activite.risques].sort((a, b) => (b.probabilite * b.impact) - (a.probabilite * a.impact)).map((r) => {
                  const criticite = r.probabilite * r.impact
                  return (
                    <tr key={r.id} className="border-b border-gray-50 dark:border-gray-800/60 last:border-0">
                      <td className="px-4 py-2.5 text-sm">
                        <p className="font-medium text-gray-900 dark:text-white">{r.titre}</p>
                        {r.categorie && <p className="text-xs text-gray-400">{r.categorie}</p>}
                      </td>
                      <td className="px-4 py-2.5"><span className={`text-xs font-medium px-2.5 py-1 rounded-lg ${criticiteClass(criticite)}`}>{criticite} ({r.probabilite}×{r.impact})</span></td>
                      <td className="px-4 py-2.5">
                        <select value={r.statut} onChange={(e) => updateRisque(r.id, { statut: e.target.value })} className={`text-xs font-medium px-2 py-1 rounded-lg border-0 ${RISQUE_STATUT_LABELS[r.statut].cls}`}>
                          <option value="OUVERT">{RISQUE_STATUT_LABELS.OUVERT.label}</option>
                          <option value="EN_COURS">{RISQUE_STATUT_LABELS.EN_COURS.label}</option>
                          <option value="CLOS">{RISQUE_STATUT_LABELS.CLOS.label}</option>
                        </select>
                      </td>
                      <td className="px-4 py-2.5 text-sm">{r.jiraLien ? <a href={r.jiraLien} target="_blank" rel="noreferrer" className="text-primary-600 hover:underline dark:text-primary-400">Ticket →</a> : '—'}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex gap-1 justify-end">
                          <button onClick={() => setRisqueModal({ open: true, risque: r })} className="text-gray-300 hover:text-primary-600 text-xs">✎</button>
                          <button onClick={() => deleteRisque(r.id)} className="text-gray-300 hover:text-red-500 text-xs">✕</button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      </fieldset>

      {/* Demandes d'achat rattachées */}
      {activite.demandesAchat.length > 0 && (
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Demandes d&apos;achat rattachées</h2>
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-x-auto">
            <table className="w-full">
              <thead><tr className="border-b border-gray-100 dark:border-gray-800">
                <th className="text-left text-[10px] font-medium text-gray-400 uppercase tracking-wide px-4 py-2.5">Numéro</th>
                <th className="text-left text-[10px] font-medium text-gray-400 uppercase tracking-wide px-4 py-2.5">Objet</th>
                <th className="text-left text-[10px] font-medium text-gray-400 uppercase tracking-wide px-4 py-2.5">Validation</th>
              </tr></thead>
              <tbody>
                {activite.demandesAchat.map((d) => (
                  <tr key={d.id} className="border-b border-gray-50 dark:border-gray-800/60 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800/40">
                    <td className="px-4 py-2.5 text-sm"><Link href={`/procurement/demandes-achat/${d.id}`} className="font-semibold text-primary-600 hover:underline dark:text-primary-400">{d.numero}</Link></td>
                    <td className="px-4 py-2.5 text-sm text-gray-600 dark:text-gray-300">{d.objet}</td>
                    <td className="px-4 py-2.5"><span className={`text-xs font-medium px-2.5 py-1 rounded-lg ${VALIDATION_STATUT_LABELS[d.validationStatut].cls}`}>{VALIDATION_STATUT_LABELS[d.validationStatut].label}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showShare && <ModuleShareModal module="procurement-activite" resourceId={activite.id} resourceName={activite.nom} onClose={() => setShowShare(false)} />}
      {gainModal && <GainModal onSave={addGain} onClose={() => setGainModal(false)} />}
      {budgetModal.open && (
        <BudgetLigneModal
          ligne={budgetModal.ligne}
          departementId={activite.departementId}
          onSave={(input) => budgetModal.ligne ? updateBudgetLigne(budgetModal.ligne.id, input) : addBudgetLigne(input as never)}
          onClose={() => setBudgetModal({ open: false, ligne: null })}
        />
      )}
      {risqueModal.open && (
        <RisqueModal
          risque={risqueModal.risque}
          onSave={(input) => risqueModal.risque ? updateRisque(risqueModal.risque.id, input) : addRisque(input as never)}
          onClose={() => setRisqueModal({ open: false, risque: null })}
        />
      )}
    </div>
  )
}
