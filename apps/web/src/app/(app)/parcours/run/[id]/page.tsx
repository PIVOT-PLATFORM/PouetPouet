'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { CheckCircle2, XCircle, Clock, FileText, RotateCcw, Bell, BellOff, Download, MessageSquare, Send, Ban, Trash2 } from 'lucide-react'
import { useParcourInstance } from '@/hooks/useParcours'
import { useFlagGuard } from '@/hooks/useFlagGuard'
import { InstanceProgress } from '@/components/parcours/InstanceProgress'
import { StepDetailPanel } from '@/components/parcours/StepDetailPanel'
import { ParcourHistoryLog } from '@/components/parcours/ParcourHistoryLog'

const STATUS_CONFIG: Record<string, { label: string; icon: React.ReactNode; cls: string }> = {
  IN_PROGRESS: { label: 'En cours',  icon: <Clock className="w-4 h-4" />,        cls: 'text-blue-600 bg-blue-50 dark:bg-blue-900/20 dark:text-blue-400' },
  COMPLETED:   { label: 'Terminé',   icon: <CheckCircle2 className="w-4 h-4" />, cls: 'text-green-600 bg-green-50 dark:bg-green-900/20 dark:text-green-400' },
  REJECTED:    { label: 'Rejeté',    icon: <XCircle className="w-4 h-4" />,       cls: 'text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400' },
  CANCELLED:   { label: 'Annulé',    icon: <XCircle className="w-4 h-4" />,       cls: 'text-gray-500 bg-gray-100 dark:bg-gray-800 dark:text-gray-400' },
}

export default function InstanceCockpitPage() {
  useFlagGuard('module.parcours')
  const { id } = useParams<{ id: string }>()
  const {
    instance, isLoading, accessDenied,
    completeStep, restartInstance, skipStep, cancelInstance,
    forceCompleteStep, resetStep, updateStepData,
    addComment, addStepComment, updateInstance, getDocumentUrl, deleteDocument,
    getUploadUrl, registerDocument,
  } = useParcourInstance(id)

  // null = suivre automatiquement currentStep ; sinon étape épinglée par l'utilisateur
  const [selectedStep, setSelectedStep] = useState<number | null>(null)
  const [comment, setComment] = useState('')
  const [sendingComment, setSendingComment] = useState(false)
  const [downloadingDoc, setDownloadingDoc] = useState<string | null>(null)
  const [deletingDoc, setDeletingDoc] = useState<string | null>(null)
  const [togglingRemind, setTogglingRemind] = useState(false)

  if (isLoading) return (
    <div className="flex justify-center py-20">
      <div className="w-7 h-7 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (accessDenied || !instance) return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <p className="text-gray-500 dark:text-gray-400">Parcours introuvable ou accès refusé.</p>
      <Link href="/parcours" className="text-cyan-500 hover:underline text-sm">← Mes parcours</Link>
    </div>
  )

  const statusCfg = STATUS_CONFIG[instance.status] ?? STATUS_CONFIG.IN_PROGRESS
  const isActive = instance.status === 'IN_PROGRESS'
  const canEdit = instance.role !== 'VIEWER'
  // Étape affichée : épinglée par l'utilisateur, sinon étape courante
  const displayStep = selectedStep !== null ? selectedStep : instance.currentStep

  // Fix #8 : progression
  const completedCount = instance.stepInstances.filter((s) => s.status === 'COMPLETED' || s.status === 'SKIPPED').length
  const totalCount = instance.steps.length

  // Séparer les commentaires libres (fil de discussion) des événements du workflow
  const commentEntries = instance.history.filter((h) => h.action === 'comment')
  const workflowHistory = instance.history.filter((h) => h.action !== 'comment')

  async function handleDownload(docId: string, filename: string) {
    setDownloadingDoc(docId)
    try {
      const { url } = await getDocumentUrl(docId)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.target = '_blank'
      a.click()
    } finally {
      setDownloadingDoc(null)
    }
  }

  async function handleDeleteDoc(docId: string) {
    if (!confirm('Supprimer ce document ?')) return
    setDeletingDoc(docId)
    try {
      await deleteDocument(docId)
    } finally {
      setDeletingDoc(null)
    }
  }

  async function handleToggleRemind() {
    if (!instance) return
    setTogglingRemind(true)
    try {
      await updateInstance({ remindByEmail: !instance.remindByEmail })
    } finally {
      setTogglingRemind(false)
    }
  }

  async function handleSendComment() {
    if (!comment.trim()) return
    setSendingComment(true)
    try {
      await addComment(comment.trim())
      setComment('')
    } finally {
      setSendingComment(false)
    }
  }

  async function handleCancel() {
    const reason = window.prompt('Raison de l\'annulation (optionnel) :')
    if (reason === null) return // annulé par l'utilisateur
    await cancelInstance(reason || undefined)
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <Link href="/parcours" className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 mb-1 inline-block">
          ← Parcours
        </Link>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold dark:text-white">{instance.title}</h1>
            <div className="flex items-center gap-3 mt-0.5 flex-wrap">
              {instance.refNumber && (
                <span className="text-sm font-mono text-gray-400">{instance.refNumber}</span>
              )}
              {/* Fix #8 : compteur d'étapes */}
              <span className="text-sm text-gray-400">
                {completedCount} / {totalCount} étape{totalCount > 1 ? 's' : ''}
              </span>
              {totalCount > 0 && (
                <div className="w-24 h-1.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-cyan-500 transition-all"
                    style={{ width: `${Math.round((completedCount / totalCount) * 100)}%` }}
                  />
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {canEdit && (
              <button
                onClick={handleToggleRemind}
                disabled={togglingRemind}
                title={instance.remindByEmail ? 'Rappels email activés — cliquer pour désactiver' : 'Activer les rappels email'}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium border transition-colors ${
                  instance.remindByEmail
                    ? 'bg-cyan-50 border-cyan-200 text-cyan-700 dark:bg-cyan-900/20 dark:border-cyan-800 dark:text-cyan-300'
                    : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-cyan-200 dark:hover:border-cyan-800'
                }`}
              >
                {instance.remindByEmail ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
                <span className="hidden sm:inline">{instance.remindByEmail ? 'Rappels activés' : 'Rappels email'}</span>
              </button>
            )}
            {/* Annuler — seulement si IN_PROGRESS et OWNER */}
            {isActive && instance.role === 'OWNER' && (
              <button
                onClick={handleCancel}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-500 dark:text-gray-400 hover:border-red-200 hover:text-red-600 dark:hover:border-red-800 dark:hover:text-red-400 transition-colors"
              >
                <Ban className="w-4 h-4" />
                <span className="hidden sm:inline">Annuler</span>
              </button>
            )}
            {(instance.status === 'REJECTED' || instance.status === 'CANCELLED') && canEdit && (
              <button
                onClick={() => { if (confirm('Relancer ce parcours depuis l\'étape courante ?')) restartInstance() }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
                Relancer
              </button>
            )}
            <span className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium ${statusCfg.cls}`}>
              {statusCfg.icon}
              {statusCfg.label}
            </span>
          </div>
        </div>
      </div>

      {/* Bannière non-actif */}
      {!isActive && (
        <div className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-sm ${statusCfg.cls}`}>
          {statusCfg.icon}
          <span className="font-medium">Ce parcours est {statusCfg.label.toLowerCase()}.</span>
          <span className="text-xs opacity-70">Vous pouvez toujours consulter et modifier les étapes.</span>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        {/* Centre : détail de l'étape sélectionnée */}
        <StepDetailPanel
          steps={instance.steps}
          stepInstances={instance.stepInstances}
          documents={instance.documents}
          history={instance.history}
          selectedStep={displayStep}
          currentStep={instance.currentStep}
          instanceStatus={instance.status}
          canEdit={canEdit}
          onComplete={(idx, body) => completeStep(idx, body)}
          onForceComplete={forceCompleteStep}
          onSkip={skipStep}
          onReset={resetStep}
          onUpdateData={updateStepData}
          onAddStepComment={addStepComment}
          onNavigate={setSelectedStep}
          getUploadUrl={getUploadUrl}
          registerDocument={registerDocument}
        />

        {/* Sidebar droite : navigation + documents + commentaire + historique */}
        <div className="flex flex-col gap-4">
          {/* Navigation étapes */}
          <div className="p-4 rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900">
            <h3 className="font-semibold text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-3">Étapes</h3>
            <InstanceProgress
              steps={instance.steps}
              stepInstances={instance.stepInstances}
              currentStep={instance.currentStep}
              selectedStep={displayStep}
              onSelect={setSelectedStep}
            />
          </div>

          {/* Documents */}
          {instance.documents.length > 0 && (
            <div className="p-4 rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 flex flex-col gap-2">
              <h3 className="font-semibold text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide">Documents</h3>
              {instance.documents.map((doc) => (
                <div key={doc.id} className="flex items-center gap-2 py-1">
                  <FileText className="w-3.5 h-3.5 text-cyan-500 flex-shrink-0" />
                  <span className="flex-1 text-xs dark:text-white truncate">{doc.filename}</span>
                  <span className="text-xs text-gray-400 flex-shrink-0">{doc.classification}</span>
                  <button
                    onClick={() => handleDownload(doc.id, doc.filename)}
                    disabled={downloadingDoc === doc.id}
                    className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-cyan-500 transition-colors disabled:opacity-50 flex-shrink-0"
                    title="Télécharger"
                  >
                    <Download className="w-3 h-3" />
                  </button>
                  {canEdit && (
                    <button
                      onClick={() => handleDeleteDoc(doc.id)}
                      disabled={deletingDoc === doc.id}
                      className="p-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-500 transition-colors disabled:opacity-50 flex-shrink-0"
                      title="Supprimer"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Commentaires / discussion */}
          <div className="p-4 rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 flex flex-col gap-3">
            <h3 className="font-semibold text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5" />
              Commentaires
            </h3>

            {commentEntries.length > 0 ? (
              <div className="flex flex-col gap-2.5">
                {commentEntries.map((c) => (
                  <div key={c.id} className="flex flex-col gap-0.5 px-3 py-2 rounded-xl bg-gray-50 dark:bg-gray-800">
                    <p className="text-sm text-gray-700 dark:text-gray-200 whitespace-pre-wrap break-words">{c.comment}</p>
                    <span className="text-[11px] text-gray-400 dark:text-gray-500">
                      {new Date(c.createdAt).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400 py-1">Aucun commentaire pour l'instant.</p>
            )}

            <div className="flex gap-2">
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={2}
                placeholder="Ajouter un commentaire…"
                className="flex-1 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50 resize-none"
                onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSendComment() }}
              />
              <button
                onClick={handleSendComment}
                disabled={!comment.trim() || sendingComment}
                className="self-end p-2 rounded-xl bg-cyan-500 hover:bg-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed text-white transition-colors"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Historique (événements du workflow — hors commentaires libres) */}
          <div className="p-4 rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900">
            <h3 className="font-semibold text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-3">Historique</h3>
            <ParcourHistoryLog entries={workflowHistory} />
          </div>
        </div>
      </div>
    </div>
  )
}
