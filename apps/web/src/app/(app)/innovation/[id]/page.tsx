'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { Camera, ChevronLeft, Image as ImageIcon, ThumbsUp, Trophy, User, X } from 'lucide-react'
import { useInnovationFiche, type InnovationStatus } from '@/hooks/useInnovation'
import { useChallenges, useFicheChallengeEntries, submitFicheToChallenge } from '@/hooks/useChallenges'
import { useOrgUnits, useInnovationCategories } from '@/hooks/useInnovationOrg'
import { useInnovationComments } from '@/hooks/useInnovationComments'
import { useInnovationAttachments } from '@/hooks/useInnovationAttachments'
import { useInnovationLinks } from '@/hooks/useInnovationLinks'
import { OrgUnitPicker } from '@/components/innovation/org-unit-picker'
import { CategoryPicker } from '@/components/innovation/category-picker'
import { CommentThread } from '@/components/innovation/comment-thread'
import { AttachmentGallery } from '@/components/innovation/attachment-gallery'
import { LinkList } from '@/components/innovation/link-list'
import { useFlagGuard } from '@/hooks/useFlagGuard'
import { useAuthStore } from '@/store/auth'
import { resizeImage } from '@/lib/image-resize'

const STATUSES: { key: InnovationStatus; label: string; color: string }[] = [
  { key: 'IDEE', label: 'Idée', color: '#eab308' },
  { key: 'EXPLORATION', label: 'En exploration', color: '#2563eb' },
  { key: 'ADOPTEE', label: 'Adoptée', color: '#16a34a' },
  { key: 'ABANDONNEE', label: 'Abandonnée', color: '#6b7280' },
]

const inputCls = 'w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400'

function frDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function Section({ title, body }: { title: string; body: string | null }) {
  if (!body) return null
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1.5">{title}</h3>
      <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-line leading-relaxed">{body}</p>
    </div>
  )
}

// Section éditable inline (clic → textarea → sauvegarde au blur), même geste que le
// titre de la fiche. Les champs problème/solution/bénéfices sont optionnels à la
// création mais doivent rester ajoutables ensuite — required=true (pitch) refuse
// de sauvegarder une valeur vide plutôt que de casser la contrainte serveur.
function EditableSection({ title, value, placeholder, canEdit, required, onSave }: {
  title: string
  value: string | null
  placeholder: string
  canEdit: boolean
  required?: boolean
  onSave: (v: string | null) => void
}) {
  const [draft, setDraft] = useState(value ?? '')

  if (!canEdit) return <Section title={title} body={value} />

  function handleBlur() {
    const trimmed = draft.trim()
    if (required && !trimmed) { setDraft(value ?? ''); return }
    if (trimmed === (value ?? '')) return
    onSave(trimmed || null)
  }

  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1.5">{title}</h3>
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={handleBlur}
        placeholder={placeholder}
        rows={3}
        className="w-full bg-transparent border border-transparent hover:border-gray-200 dark:hover:border-gray-700 focus:border-amber-400 rounded-lg px-2 py-1.5 -mx-2 text-sm text-gray-700 dark:text-gray-300 leading-relaxed resize-none focus:outline-none"
      />
    </div>
  )
}

export default function InnovationDetailPage() {
  useFlagGuard('module.innovation')
  const { id } = useParams<{ id: string }>()
  const user = useAuthStore((s) => s.user)
  const { fiche, isLoading, notFound, updateFiche, toggleVote, addContributor, removeContributor } = useInnovationFiche(id)
  const { entries: challengeEntries, reload: reloadChallengeEntries } = useFicheChallengeEntries(id)
  const { challenges } = useChallenges()
  const { units } = useOrgUnits()
  const { categories } = useInnovationCategories(fiche?.orgUnitRef ?? null)
  const { comments, addComment, editComment, deleteComment } = useInnovationComments(id)
  const { attachments, uploadFile, getDownloadUrl, deleteAttachment } = useInnovationAttachments(id)
  const { links, addLink, deleteLink } = useInnovationLinks(id)

  const [editing, setEditing] = useState(false)
  const [contributorEmail, setContributorEmail] = useState('')
  const [contributorError, setContributorError] = useState<string | null>(null)
  const [abandonReason, setAbandonReason] = useState('')
  const [showAbandon, setShowAbandon] = useState(false)
  const [showChallengePicker, setShowChallengePicker] = useState(false)
  const bannerInputRef = useRef<HTMLInputElement>(null)
  const coverInputRef = useRef<HTMLInputElement>(null)

  async function handleBannerFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const dataUrl = await resizeImage(file, 1600)
    await updateFiche({ bannerImage: dataUrl })
    if (bannerInputRef.current) bannerInputRef.current.value = ''
  }

  async function handleCoverFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const dataUrl = await resizeImage(file, 400)
    await updateFiche({ coverImage: dataUrl })
    if (coverInputRef.current) coverInputRef.current.value = ''
  }

  if (isLoading) {
    return <div className="flex justify-center py-20"><div className="w-7 h-7 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" /></div>
  }
  if (notFound || !fiche) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-20 text-center">
        <p className="text-gray-500 dark:text-gray-400 mb-4">Fiche introuvable.</p>
        <Link href="/innovation" className="inline-flex items-center gap-1 text-sm font-medium text-amber-600 hover:text-amber-700"><ChevronLeft size={16} />Retour à Innovation</Link>
      </div>
    )
  }

  const canEdit = !!user && (user.isAdmin || fiche.authorId === user.id || fiche.contributors.some((c) => c.id === user.id))
  const meta = STATUSES.find((s) => s.key === fiche.status) ?? STATUSES[0]

  async function handleStatusChange(next: InnovationStatus) {
    if (next === 'ABANDONNEE') { setShowAbandon(true); return }
    await updateFiche({ status: next, abandonReason: null })
  }

  async function confirmAbandon() {
    if (!abandonReason.trim()) return
    await updateFiche({ status: 'ABANDONNEE', abandonReason: abandonReason.trim() })
    setShowAbandon(false)
    setAbandonReason('')
  }

  const registeredChallengeIds = new Set(challengeEntries.map((e) => e.challenge.id))
  const availableChallenges = challenges.filter((c) => c.status === 'OPEN' && !registeredChallengeIds.has(c.id))

  async function handleSubmitToChallenge(challengeId: string) {
    await submitFicheToChallenge(challengeId, fiche!.id)
    await reloadChallengeEntries()
    setShowChallengePicker(false)
  }

  async function handleAddContributor(e: React.FormEvent) {
    e.preventDefault()
    if (!contributorEmail.trim()) return
    setContributorError(null)
    try {
      await addContributor(contributorEmail.trim())
      setContributorEmail('')
    } catch (err) {
      setContributorError((err as Error).message)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Link href="/innovation" className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors"><ChevronLeft size={16} />Innovation</Link>

      {/* Bannière */}
      {(fiche.bannerImage || canEdit) && (
        <div className="relative w-full h-40 rounded-2xl overflow-hidden bg-gray-100 dark:bg-gray-800 group">
          {fiche.bannerImage ? (
            <img src={fiche.bannerImage} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-300 dark:text-gray-600"><ImageIcon size={28} /></div>
          )}
          {canEdit && (
            <>
              <input ref={bannerInputRef} type="file" accept="image/*" className="hidden" onChange={handleBannerFile} />
              <button
                onClick={() => bannerInputRef.current?.click()}
                className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-lg bg-black/50 px-3 py-1.5 text-xs font-medium text-white opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Camera size={13} /> {fiche.bannerImage ? 'Changer' : 'Ajouter une bannière'}
              </button>
            </>
          )}
        </div>
      )}

      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          {editing ? (
            <input
              defaultValue={fiche.title}
              onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== fiche.title) updateFiche({ title: v }); setEditing(false) }}
              autoFocus
              className="text-3xl font-bold text-gray-900 dark:text-gray-100 tracking-tight bg-transparent border border-transparent hover:border-gray-200 dark:hover:border-gray-700 focus:border-amber-400 rounded-lg px-2 py-1 -ml-2 focus:outline-none w-full"
            />
          ) : (
            <h1
              onClick={() => canEdit && setEditing(true)}
              className={`text-3xl font-bold text-gray-900 dark:text-gray-100 tracking-tight ${canEdit ? 'cursor-text hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg px-2 py-1 -ml-2' : ''}`}
            >
              {fiche.title}
            </h1>
          )}
          <p className="text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-1.5 flex-wrap">
            <User size={14} />{fiche.author.name} · {frDate(fiche.createdAt)}
          </p>
        </div>
        <button
          onClick={() => toggleVote()}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all shrink-0 ${fiche.hasVoted ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-amber-50 dark:hover:bg-amber-900/20'}`}
        >
          <ThumbsUp size={16} /> {fiche.votes}
        </button>
      </div>

      {/* Statut */}
      <div className="flex items-center gap-2 flex-wrap">
        {STATUSES.map((s) => (
          <button
            key={s.key}
            disabled={!canEdit}
            onClick={() => handleStatusChange(s.key)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${canEdit ? '' : 'cursor-default'}`}
            style={fiche.status === s.key ? { background: s.color, color: 'white' } : { background: s.color + '1a', color: s.color, opacity: canEdit ? 1 : 0.6 }}
          >
            {s.label}
          </button>
        ))}
      </div>
      {fiche.status === 'ABANDONNEE' && fiche.abandonReason && (
        <p className="text-sm text-gray-500 dark:text-gray-400 italic">Motif d'abandon : {fiche.abandonReason}</p>
      )}

      {/* Périmètre & catégories */}
      {canEdit ? (
        <div className="grid grid-cols-2 gap-3">
          <OrgUnitPicker units={units} value={fiche.orgUnitRef} onChange={(v) => updateFiche({ orgUnitRef: v, categoryIds: [] })} placeholder="Aucun périmètre" />
          <CategoryPicker categories={categories} value={fiche.categories.map((c) => c.id)} onChange={(ids) => updateFiche({ categoryIds: ids })} placeholder="Aucune catégorie" />
        </div>
      ) : (fiche.orgUnitRef || fiche.categories.length > 0) && (
        <div className="flex items-center gap-2 flex-wrap text-xs text-gray-500 dark:text-gray-400">
          {fiche.orgUnitRef && <span>{units.find((u) => u.ref === fiche.orgUnitRef)?.nom ?? fiche.orgUnitRef}</span>}
          {fiche.categories.map((c) => (
            <span key={c.id} className="font-medium text-amber-600 dark:text-amber-400">{c.label}</span>
          ))}
        </div>
      )}

      {/* Contenu */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-6 flex flex-col gap-5">
        <EditableSection title="Pitch" value={fiche.pitch} placeholder="En 2-3 phrases, de quoi s'agit-il ?" canEdit={canEdit} required onSave={(v) => v && updateFiche({ pitch: v })} />
        <EditableSection title="Problème" value={fiche.probleme} placeholder="Quel problème cette idée résout-elle ?" canEdit={canEdit} onSave={(v) => updateFiche({ probleme: v })} />
        <EditableSection title="Solution" value={fiche.solution} placeholder="Quelle est la solution envisagée ?" canEdit={canEdit} onSave={(v) => updateFiche({ solution: v })} />
        <EditableSection title="Bénéfices" value={fiche.benefices} placeholder="Quels bénéfices attendus ?" canEdit={canEdit} onSave={(v) => updateFiche({ benefices: v })} />
      </div>

      {/* Image de couverture (affichée sur la carte de la liste) */}
      {(fiche.coverImage || canEdit) && (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-6 flex items-center gap-4">
          <div className="w-16 h-16 shrink-0 rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
            {fiche.coverImage ? <img src={fiche.coverImage} alt="" className="w-full h-full object-cover" /> : <ImageIcon size={20} className="text-gray-300 dark:text-gray-600" />}
          </div>
          <div className="flex flex-col gap-1">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400">Image de couverture</h3>
            <p className="text-xs text-gray-400">Affichée sur la carte de la fiche dans la liste.</p>
            {canEdit && (
              <div className="flex items-center gap-2 pt-1">
                <input ref={coverInputRef} type="file" accept="image/*" className="hidden" onChange={handleCoverFile} />
                <button onClick={() => coverInputRef.current?.click()} className="text-xs font-medium text-amber-600 hover:text-amber-700">{fiche.coverImage ? 'Changer' : 'Ajouter une image'}</button>
                {fiche.coverImage && (
                  <button onClick={() => updateFiche({ coverImage: null })} className="text-xs text-gray-400 hover:text-red-500">Retirer</button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Pièces jointes */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-6 flex flex-col gap-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400">Pièces jointes</h3>
        <AttachmentGallery
          attachments={attachments}
          canEdit={canEdit}
          onUpload={uploadFile}
          onOpen={getDownloadUrl}
          onDelete={deleteAttachment}
        />
      </div>

      {/* Liens */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-6 flex flex-col gap-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400">Liens</h3>
        <LinkList links={links} canEdit={canEdit} onAdd={addLink} onDelete={deleteLink} />
      </div>

      {/* Contributeurs */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-6 flex flex-col gap-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400">Contributeurs</h3>
        <div className="flex flex-wrap gap-2">
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">{fiche.author.name} · auteur</span>
          {fiche.contributors.map((c) => (
            <span key={c.id} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
              {c.name}
              {canEdit && (
                <button onClick={() => removeContributor(c.id)} className="hover:text-red-500"><X size={11} /></button>
              )}
            </span>
          ))}
        </div>
        {canEdit && (
          <form onSubmit={handleAddContributor} className="flex gap-2 pt-1">
            <input value={contributorEmail} onChange={(e) => setContributorEmail(e.target.value)} type="email" placeholder="email@exemple.com" className={inputCls} />
            <button type="submit" className="shrink-0 rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">Ajouter</button>
          </form>
        )}
        {contributorError && <p className="text-sm text-red-500">{contributorError}</p>}
      </div>

      {/* Challenges */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-6 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400">Challenges</h3>
          {canEdit && availableChallenges.length > 0 && (
            <button onClick={() => setShowChallengePicker(true)} className="text-sm font-medium text-amber-600 hover:text-amber-700">+ Inscrire à un challenge</button>
          )}
        </div>
        {challengeEntries.length === 0 ? (
          <p className="text-xs text-gray-400">Cette fiche n'est inscrite à aucun challenge.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {challengeEntries.map((e) => (
              <Link key={e.challenge.id} href={`/innovation/challenges/${e.challenge.id}`} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/30">
                {e.isWinner && '🏆 '}{e.challenge.nom}
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Commentaires */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-6 flex flex-col gap-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400">Commentaires</h3>
        <CommentThread
          comments={comments}
          currentUserId={user?.id ?? ''}
          isAdmin={!!user?.isAdmin}
          onAdd={addComment}
          onEdit={editComment}
          onDelete={deleteComment}
        />
      </div>

      {showChallengePicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowChallengePicker(false)}>
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-gray-900 shadow-2xl border border-gray-100 dark:border-gray-800 flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-100 dark:border-gray-800">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2"><Trophy size={18} style={{ color: '#eab308' }} />Inscrire à un challenge</h2>
            </div>
            <div className="p-4 flex flex-col gap-1.5 max-h-[50vh] overflow-y-auto">
              {availableChallenges.map((c) => (
                <button key={c.id} onClick={() => handleSubmitToChallenge(c.id)} className="text-left rounded-xl border border-gray-200 dark:border-gray-700 px-3 py-2.5 hover:border-amber-300 hover:bg-amber-50/50 dark:hover:bg-amber-950/20 transition-colors">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{c.nom}</p>
                  {c.theme && <p className="text-xs text-amber-600 dark:text-amber-400">{c.theme}</p>}
                </button>
              ))}
            </div>
            <div className="p-4 border-t border-gray-100 dark:border-gray-800">
              <button onClick={() => setShowChallengePicker(false)} className="w-full rounded-xl border border-gray-200 dark:border-gray-700 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">Fermer</button>
            </div>
          </div>
        </div>
      )}

      {showAbandon && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowAbandon(false)}>
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-gray-900 shadow-2xl border border-gray-100 dark:border-gray-800 p-6 flex flex-col gap-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Motif d'abandon</h2>
            <textarea value={abandonReason} onChange={(e) => setAbandonReason(e.target.value)} rows={3} placeholder="Pourquoi cette fiche est-elle abandonnée ?" className={`${inputCls} resize-none`} autoFocus />
            <div className="flex gap-3">
              <button onClick={() => setShowAbandon(false)} className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">Annuler</button>
              <button onClick={confirmAbandon} disabled={!abandonReason.trim()} className="flex-1 py-2.5 rounded-xl bg-gray-700 text-white text-sm font-semibold hover:bg-gray-800 disabled:opacity-50">Confirmer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
