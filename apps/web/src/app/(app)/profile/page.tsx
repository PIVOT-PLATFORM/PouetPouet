'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/auth'
import { api } from '@/lib/api'

interface ApiKeyMeta {
  id: string
  name: string
  prefix: string
  lastUsedAt: string | null
  expiresAt: string | null
  createdAt: string
}

const WEBHOOK_EVENT_LABELS: Record<string, string> = {
  'board.imported': 'Board importé',
  'daily.session.ended': 'Daily terminé',
  'scrum.ticket.estimated': 'Scrum — tous estimés',
  'wheel.draw.completed': 'Tirage Roue',
}
const WEBHOOK_EVENTS_LIST = Object.keys(WEBHOOK_EVENT_LABELS)

interface WebhookMeta {
  id: string
  name: string
  url: string
  events: string[]
  active: boolean
  createdAt: string
}

interface WebhookDeliveryMeta {
  id: string
  event: string
  statusCode: number | null
  error: string | null
  durationMs: number
  createdAt: string
}

const AUDIT_ACTION_LABELS: Record<string, string> = {
  'auth.login': 'Connexion',
  'auth.login_failed': 'Tentative de connexion échouée',
  'auth.password_changed': 'Mot de passe modifié',
  'auth.password_reset': 'Mot de passe réinitialisé',
  'account.exported': 'Export des données (RGPD)',
  'apikey.created': 'Clé API créée',
  'apikey.revoked': 'Clé API révoquée',
  'webhook.created': 'Webhook créé',
  'webhook.deleted': 'Webhook supprimé',
}

interface AuditEntry {
  id: string
  action: string
  resource: string | null
  ip: string | null
  createdAt: string
}

function resizeImage(file: File, maxPx: number): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const scale = Math.min(maxPx / img.width, maxPx / img.height, 1)
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * scale)
      canvas.height = Math.round(img.height * scale)
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
      resolve(canvas.toDataURL('image/jpeg', 0.85))
    }
    img.src = url
  })
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-6">
      <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-500 uppercase tracking-wider mb-5">{title}</h2>
      {children}
    </div>
  )
}

function SaveButton({ saving, label = 'Sauvegarder' }: { saving: boolean; label?: string }) {
  return (
    <button
      type="submit"
      disabled={saving}
      className="px-5 py-2 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50"
    >
      {saving ? 'Sauvegarde…' : label}
    </button>
  )
}

function SuccessBadge({ show }: { show: boolean }) {
  if (!show) return null
  return <span className="text-sm text-emerald-600 dark:text-emerald-400">✓ Sauvegardé</span>
}

export default function ProfilePage() {
  const { user, updateProfile, updateAvatar, changePassword, deleteAccount } = useAuthStore()
  const router = useRouter()

  // Sync local state when user changes
  const [name, setName] = useState(user?.name ?? '')
  const [bio, setBio] = useState(user?.bio ?? '')
  useEffect(() => { setName(user?.name ?? '') }, [user?.name])
  useEffect(() => { setBio(user?.bio ?? '') }, [user?.bio])

  const [infoSaving, setInfoSaving] = useState(false)
  const [infoSuccess, setInfoSuccess] = useState(false)

  const [avatarLoading, setAvatarLoading] = useState(false)
  const [avatarError, setAvatarError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [currentPwd, setCurrentPwd] = useState('')
  const [newPwd, setNewPwd] = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')
  const [pwdError, setPwdError] = useState('')
  const [pwdSuccess, setPwdSuccess] = useState(false)
  const [pwdSaving, setPwdSaving] = useState(false)

  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deletePwd, setDeletePwd] = useState('')
  const [deleteError, setDeleteError] = useState('')
  const [deleting, setDeleting] = useState(false)

  const [apiKeys, setApiKeys] = useState<ApiKeyMeta[]>([])
  const [apiKeyName, setApiKeyName] = useState('')
  const [creatingKey, setCreatingKey] = useState(false)
  const [newKeyValue, setNewKeyValue] = useState<string | null>(null)
  const [deletingKeyId, setDeletingKeyId] = useState<string | null>(null)
  const [keyCopied, setKeyCopied] = useState(false)

  const loadApiKeys = useCallback(async () => {
    try {
      const keys = await api.get<ApiKeyMeta[]>('/api/auth/keys')
      setApiKeys(keys)
    } catch { /* silent */ }
  }, [])

  useEffect(() => { loadApiKeys() }, [loadApiKeys])

  // ── Webhooks ──────────────────────────────────────────────────────────────
  const [webhooks, setWebhooks] = useState<WebhookMeta[]>([])
  const [showWebhookForm, setShowWebhookForm] = useState(false)
  const [wkName, setWkName] = useState('')
  const [wkUrl, setWkUrl] = useState('')
  const [wkEvents, setWkEvents] = useState<string[]>([])
  const [creatingWk, setCreatingWk] = useState(false)
  const [deletingWkId, setDeletingWkId] = useState<string | null>(null)
  const [testingWkId, setTestingWkId] = useState<string | null>(null)
  const [testWkResult, setTestWkResult] = useState<Record<string, { ok: boolean; status?: number; error?: string }>>({})
  const [newWkSecret, setNewWkSecret] = useState<string | null>(null)
  const [wkSecretCopied, setWkSecretCopied] = useState(false)
  const [expandedWkId, setExpandedWkId] = useState<string | null>(null)
  const [wkDeliveries, setWkDeliveries] = useState<Record<string, WebhookDeliveryMeta[]>>({})

  // ── Journal de sécurité ────────────────────────────────────────────────────
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([])
  const [showAuditLog, setShowAuditLog] = useState(false)

  useEffect(() => {
    if (!showAuditLog) return
    api.get<AuditEntry[]>('/api/auth/security-log').then(setAuditLog).catch(() => {})
  }, [showAuditLog])

  const loadWebhooks = useCallback(async () => {
    try { setWebhooks(await api.get<WebhookMeta[]>('/api/webhooks')) } catch { /* silent */ }
  }, [])

  useEffect(() => { loadWebhooks() }, [loadWebhooks])

  async function handleCreateWebhook(e: React.FormEvent) {
    e.preventDefault()
    if (!wkName.trim() || !wkUrl.trim() || wkEvents.length === 0) return
    setCreatingWk(true)
    try {
      const res = await api.post<WebhookMeta & { secret: string }>('/api/webhooks', { name: wkName.trim(), url: wkUrl.trim(), events: wkEvents })
      setNewWkSecret(res.secret)
      setWkName(''); setWkUrl(''); setWkEvents([])
      setShowWebhookForm(false)
      await loadWebhooks()
    } finally {
      setCreatingWk(false)
    }
  }

  async function handleToggleWebhook(id: string, active: boolean) {
    await api.patch(`/api/webhooks/${id}`, { active }).catch(() => {})
    setWebhooks((prev) => prev.map((w) => w.id === id ? { ...w, active } : w))
  }

  async function handleDeleteWebhook(id: string) {
    setDeletingWkId(id)
    try {
      await api.delete(`/api/webhooks/${id}`)
      setWebhooks((prev) => prev.filter((w) => w.id !== id))
    } finally {
      setDeletingWkId(null)
    }
  }

  function copyWkSecret() {
    if (!newWkSecret) return
    navigator.clipboard.writeText(newWkSecret).then(() => {
      setWkSecretCopied(true)
      setTimeout(() => setWkSecretCopied(false), 2000)
    })
  }

  async function handleTestWebhook(id: string) {
    setTestingWkId(id)
    try {
      const res = await api.post<{ ok: boolean; status?: number; error?: string }>(`/api/webhooks/${id}/test`, {})
      setTestWkResult((prev) => ({ ...prev, [id]: res }))
      setTimeout(() => setTestWkResult((prev) => { const next = { ...prev }; delete next[id]; return next }), 5000)
      // Refresh the delivery panel if it is open for this webhook
      if (expandedWkId === id) {
        api.get<WebhookDeliveryMeta[]>(`/api/webhooks/${id}/deliveries`)
          .then((d) => setWkDeliveries((prev) => ({ ...prev, [id]: d })))
          .catch(() => {})
      }
    } finally {
      setTestingWkId(null)
    }
  }

  async function handleToggleDeliveries(id: string) {
    if (expandedWkId === id) {
      setExpandedWkId(null)
      return
    }
    setExpandedWkId(id)
    try {
      const deliveries = await api.get<WebhookDeliveryMeta[]>(`/api/webhooks/${id}/deliveries`)
      setWkDeliveries((prev) => ({ ...prev, [id]: deliveries }))
    } catch { /* silent */ }
  }

  async function handleCreateKey(e: React.FormEvent) {
    e.preventDefault()
    if (!apiKeyName.trim()) return
    setCreatingKey(true)
    try {
      const res = await api.post<{ key: string; name: string; prefix: string }>('/api/auth/keys', { name: apiKeyName.trim() })
      setNewKeyValue(res.key)
      setApiKeyName('')
      await loadApiKeys()
    } finally {
      setCreatingKey(false)
    }
  }

  async function handleDeleteKey(id: string) {
    setDeletingKeyId(id)
    try {
      await api.delete(`/api/auth/keys/${id}`)
      setApiKeys((prev) => prev.filter((k) => k.id !== id))
    } finally {
      setDeletingKeyId(null)
    }
  }

  function copyKey() {
    if (!newKeyValue) return
    navigator.clipboard.writeText(newKeyValue).then(() => {
      setKeyCopied(true)
      setTimeout(() => setKeyCopied(false), 2000)
    })
  }

  if (!user) return null

  function closeDeleteModal() {
    setShowDeleteModal(false)
    setDeletePwd('')
    setDeleteError('')
  }

  async function handleDeleteAccount(e: React.FormEvent) {
    e.preventDefault()
    setDeleteError('')
    setDeleting(true)
    try {
      await deleteAccount(deletePwd)
      router.replace('/login')
    } catch (err) {
      setDeleteError((err as Error).message)
      setDeleting(false)
    }
  }

  async function handleSaveInfo(e: React.FormEvent) {
    e.preventDefault()
    setInfoSaving(true)
    try {
      await updateProfile({ name: name.trim(), bio: bio.trim() || null })
      setInfoSuccess(true)
      setTimeout(() => setInfoSuccess(false), 2500)
    } finally {
      setInfoSaving(false)
    }
  }

  async function handleAvatarFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatarError('')
    if (file.size > 5_000_000) { setAvatarError('Fichier trop grand (max 5 Mo)'); return }
    setAvatarLoading(true)
    try {
      const base64 = await resizeImage(file, 256)
      await updateAvatar(base64)
    } catch {
      setAvatarError('Erreur lors du chargement')
    } finally {
      setAvatarLoading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function handleRemoveAvatar() {
    setAvatarLoading(true)
    try { await updateAvatar(null) } finally { setAvatarLoading(false) }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault()
    setPwdError('')
    if (newPwd !== confirmPwd) { setPwdError('Les mots de passe ne correspondent pas'); return }
    if (newPwd.length < 8) { setPwdError('8 caractères minimum'); return }
    setPwdSaving(true)
    try {
      await changePassword(currentPwd, newPwd)
      setCurrentPwd(''); setNewPwd(''); setConfirmPwd('')
      setPwdSuccess(true)
      setTimeout(() => setPwdSuccess(false), 2500)
    } catch (err) {
      setPwdError((err as Error).message)
    } finally {
      setPwdSaving(false)
    }
  }

  async function handleThemeToggle() {
    if (!user) return
    await updateProfile({ theme: user.theme === 'dark' ? 'light' : 'dark' })
  }

  const avatarInitials = (user?.name ?? '').split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">Mon profil</h1>
        <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">Gérez vos informations personnelles et vos préférences</p>
      </div>

      {/* ── Avatar ── */}
      <SectionCard title="Photo de profil">
        <div className="flex items-center gap-5">
          <div className="relative shrink-0">
            {user.avatar ? (
              <img src={user.avatar} alt={user.name} className="w-20 h-20 rounded-full object-cover ring-2 ring-gray-100 dark:ring-gray-700" />
            ) : (
              <div className="w-20 h-20 rounded-full bg-indigo-600 flex items-center justify-center text-white text-2xl font-bold ring-2 ring-gray-100 dark:ring-gray-700">
                {avatarInitials}
              </div>
            )}
            {avatarLoading && (
              <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center">
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2 min-w-0">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={avatarLoading}
              className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 w-fit"
            >
              Changer la photo
            </button>
            {user.avatar && (
              <button
                onClick={handleRemoveAvatar}
                disabled={avatarLoading}
                className="px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors w-fit"
              >
                Supprimer
              </button>
            )}
            {avatarError && <p className="text-xs text-red-500">{avatarError}</p>}
            <p className="text-xs text-gray-500 dark:text-gray-500">JPG, PNG, GIF · Max 5 Mo · Redimensionnée à 256 px</p>
          </div>

          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarFile} />
        </div>
      </SectionCard>

      {/* ── Informations ── */}
      <SectionCard title="Informations">
        <form onSubmit={handleSaveInfo} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Nom</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              minLength={2}
              aria-label="Nom"
              className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2.5 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Email <span className="text-gray-500 dark:text-gray-500 font-normal">(non modifiable)</span>
            </label>
            <input
              type="email"
              value={user.email}
              disabled
              aria-label="Email"
              className="w-full rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-850 px-4 py-2.5 text-sm text-gray-500 dark:text-gray-500 cursor-not-allowed"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Bio</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder="Quelques mots sur vous…"
              className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2.5 text-sm text-gray-900 dark:text-gray-100 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-gray-400 dark:placeholder-gray-500"
            />
            <p className="text-xs text-gray-500 dark:text-gray-500 mt-1 text-right">{bio.length}/500</p>
          </div>

          <div className="flex items-center gap-3 pt-1">
            <SaveButton saving={infoSaving} />
            <SuccessBadge show={infoSuccess} />
          </div>
        </form>
      </SectionCard>

      {/* ── Préférences ── */}
      <SectionCard title="Préférences">
        <div className="space-y-5">
          {/* Dark mode */}
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Mode nuit</p>
              <p className="text-xs text-gray-500 dark:text-gray-500 mt-0.5">Affichage sombre pour réduire la fatigue visuelle</p>
            </div>
            <button
              type="button"
              onClick={handleThemeToggle}
              className={`relative shrink-0 w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900 ${
                user.theme === 'dark' ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-gray-700'
              }`}
              role="switch"
              aria-checked={user.theme === 'dark'}
              aria-label="Mode nuit"
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                  user.theme === 'dark' ? 'translate-x-5' : ''
                }`}
              />
            </button>
          </div>
        </div>
      </SectionCard>

      {/* ── Sécurité ── */}
      <SectionCard title="Sécurité">
        <form onSubmit={handleChangePassword} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Mot de passe actuel</label>
            <input
              type="password"
              value={currentPwd}
              onChange={(e) => setCurrentPwd(e.target.value)}
              autoComplete="current-password"
              aria-label="Mot de passe actuel"
              className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2.5 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Nouveau mot de passe</label>
            <input
              type="password"
              value={newPwd}
              onChange={(e) => setNewPwd(e.target.value)}
              autoComplete="new-password"
              aria-label="Nouveau mot de passe"
              className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2.5 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Confirmer le mot de passe</label>
            <input
              type="password"
              value={confirmPwd}
              onChange={(e) => setConfirmPwd(e.target.value)}
              autoComplete="new-password"
              aria-label="Confirmer le mot de passe"
              className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2.5 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {pwdError && (
            <p className="text-sm text-red-600 dark:text-red-400">{pwdError}</p>
          )}

          <div className="flex items-center gap-3 pt-1">
            <SaveButton
              saving={pwdSaving}
              label="Modifier le mot de passe"
            />
            {pwdSuccess && <span className="text-sm text-emerald-600 dark:text-emerald-400">✓ Mot de passe modifié</span>}
          </div>
        </form>
      </SectionCard>

      {/* ── Compte ── */}
      <SectionCard title="Compte">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Membre depuis</p>
            <p className="text-xs text-gray-500 dark:text-gray-500 mt-0.5">
              {new Date(user.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-500 dark:text-gray-500">ID utilisateur</p>
            <p className="text-xs font-mono text-gray-500 dark:text-gray-600 mt-0.5">{user.id.slice(0, 8)}…</p>
          </div>
        </div>
      </SectionCard>

      {/* ── Données personnelles ── */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-6">
        <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-500 uppercase tracking-wider mb-5">Mes données (RGPD)</h2>
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Exporter mes données</p>
            <p className="text-xs text-gray-500 dark:text-gray-500 mt-0.5">
              Télécharge toutes vos données personnelles (profil, boards, dailys, équipes…) au format JSON.
            </p>
          </div>
          <a
            href="/api/auth/export"
            download
            className="shrink-0 px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            Exporter
          </a>
        </div>
      </div>

      {/* ── Clés API ── */}
      <SectionCard title="Clés API">
        <div className="space-y-5">
          <p className="text-xs text-gray-500 dark:text-gray-500">
            Utilisez une clé API pour accéder à l&apos;API PouetPouet depuis vos scripts (header <code className="font-mono bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 px-1 rounded">X-API-Key</code>). Maximum 10 clés.
          </p>

          {/* New key form */}
          <form onSubmit={handleCreateKey} className="flex gap-2">
            <input
              type="text"
              value={apiKeyName}
              onChange={(e) => setApiKeyName(e.target.value)}
              placeholder="Nom de la clé (ex: CI, script export…)"
              maxLength={64}
              className="flex-1 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-gray-400 dark:placeholder-gray-500"
            />
            <button
              type="submit"
              disabled={creatingKey || !apiKeyName.trim()}
              className="shrink-0 px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50"
            >
              {creatingKey ? 'Création…' : 'Créer'}
            </button>
          </form>

          {/* New key reveal (shown once) */}
          {newKeyValue && (
            <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 p-4 space-y-2">
              <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">Copiez cette clé maintenant — elle ne sera plus affichée.</p>
              <div className="flex gap-2 items-center">
                <code className="flex-1 font-mono text-xs bg-white dark:bg-gray-900 border border-emerald-200 dark:border-emerald-800 rounded-lg px-3 py-2 text-gray-700 dark:text-gray-200 truncate">
                  {newKeyValue}
                </code>
                <button
                  onClick={copyKey}
                  className="shrink-0 px-3 py-2 rounded-lg border border-emerald-300 dark:border-emerald-700 text-xs font-medium text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors"
                >
                  {keyCopied ? '✓ Copié' : 'Copier'}
                </button>
                <button
                  onClick={() => setNewKeyValue(null)}
                  className="shrink-0 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-xs font-medium text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                  Fermer
                </button>
              </div>
            </div>
          )}

          {/* Existing keys list */}
          {apiKeys.length > 0 && (
            <ul className="space-y-2">
              {apiKeys.map((k) => (
                <li key={k.id} className="flex items-center justify-between gap-3 rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{k.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-500 font-mono mt-0.5">
                      pp_{k.prefix}… · créée {new Date(k.createdAt).toLocaleDateString('fr-FR')}
                      {k.lastUsedAt && ` · utilisée ${new Date(k.lastUsedAt).toLocaleDateString('fr-FR')}`}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDeleteKey(k.id)}
                    disabled={deletingKeyId === k.id}
                    className="shrink-0 px-3 py-1.5 rounded-lg border border-red-200 dark:border-red-900/50 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors disabled:opacity-50"
                  >
                    {deletingKeyId === k.id ? '…' : 'Révoquer'}
                  </button>
                </li>
              ))}
            </ul>
          )}

          {apiKeys.length === 0 && !newKeyValue && (
            <p className="text-xs text-gray-500 dark:text-gray-500 italic">Aucune clé API active.</p>
          )}
        </div>
      </SectionCard>

      {/* ── Webhooks ── */}
      <SectionCard title="Webhooks">
        <p className="text-xs text-gray-500 dark:text-gray-500 mb-4">
          Recevez des notifications HTTP lorsque des événements se produisent dans FORGE. Chaque livraison est signée avec un secret HMAC-SHA256 dans l'en-tête <code className="bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 px-1 rounded text-xs">X-Webhook-Signature</code>.
        </p>

        {newWkSecret && (
          <div className="mb-4 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800">
            <p className="text-xs font-semibold text-amber-700 dark:text-amber-300 mb-1">Secret généré — copiez-le maintenant, il ne sera plus affiché</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs font-mono bg-white dark:bg-gray-900 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2 overflow-x-auto text-amber-800 dark:text-amber-200 select-all break-all">
                {newWkSecret}
              </code>
              <button onClick={copyWkSecret} className="shrink-0 px-3 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-medium transition-colors">
                {wkSecretCopied ? '✓ Copié' : 'Copier'}
              </button>
            </div>
            <button onClick={() => setNewWkSecret(null)} className="mt-2 text-xs text-amber-500 hover:text-amber-700 transition-colors">
              J'ai bien copié le secret ×
            </button>
          </div>
        )}

        {/* Formulaire de création */}
        {showWebhookForm ? (
          <form onSubmit={handleCreateWebhook} className="mb-4 p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 flex flex-col gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-500 mb-1">Nom</label>
              <input
                autoFocus
                value={wkName}
                onChange={(e) => setWkName(e.target.value)}
                placeholder="Mon webhook CI"
                className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-500 mb-1">URL</label>
              <input
                value={wkUrl}
                onChange={(e) => setWkUrl(e.target.value)}
                placeholder="https://example.com/webhook"
                type="url"
                className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-500 mb-1.5">Événements</label>
              <div className="flex flex-wrap gap-2">
                {WEBHOOK_EVENTS_LIST.map((ev) => (
                  <label key={ev} className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={wkEvents.includes(ev)}
                      onChange={(e) => setWkEvents((prev) => e.target.checked ? [...prev, ev] : prev.filter((x) => x !== ev))}
                      className="rounded"
                    />
                    <span className="text-xs text-gray-700 dark:text-gray-300">{WEBHOOK_EVENT_LABELS[ev]}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => { setShowWebhookForm(false); setWkName(''); setWkUrl(''); setWkEvents([]) }} className="px-3 py-1.5 text-sm text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
                Annuler
              </button>
              <button type="submit" disabled={creatingWk || !wkName.trim() || !wkUrl.trim() || wkEvents.length === 0} className="px-3 py-1.5 text-sm font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors">
                {creatingWk ? 'Création…' : 'Créer'}
              </button>
            </div>
          </form>
        ) : (
          <button onClick={() => setShowWebhookForm(true)} className="mb-4 flex items-center gap-2 text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Ajouter un webhook
          </button>
        )}

        {webhooks.length > 0 ? (
          <div className="space-y-2">
            {webhooks.map((wk) => (
              <div key={wk.id} className="rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-3 p-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{wk.name}</span>
                    <span className={`shrink-0 text-xs px-1.5 py-0.5 rounded-full font-medium ${wk.active ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400' : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'}`}>
                      {wk.active ? 'Actif' : 'Inactif'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-500 truncate mt-0.5">{wk.url}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-500 mt-0.5">{wk.events.map((ev) => WEBHOOK_EVENT_LABELS[ev] ?? ev).join(', ')}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {testWkResult[wk.id] && (
                    <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${testWkResult[wk.id].ok ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                      {testWkResult[wk.id].ok ? `✓ ${testWkResult[wk.id].status}` : '✗'}
                    </span>
                  )}
                  <button
                    onClick={() => handleToggleDeliveries(wk.id)}
                    className={`p-1.5 rounded-lg transition-colors ${expandedWkId === wk.id ? 'text-indigo-500 bg-indigo-50 dark:bg-indigo-950' : 'text-gray-500 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-950'}`}
                    title="Historique des livraisons"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  </button>
                  <button
                    onClick={() => handleTestWebhook(wk.id)}
                    disabled={testingWkId === wk.id}
                    className="p-1.5 rounded-lg text-gray-500 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-950 transition-colors"
                    title="Tester"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                  </button>
                  <button
                    onClick={() => handleToggleWebhook(wk.id, !wk.active)}
                    className="p-1.5 rounded-lg text-gray-500 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-950 transition-colors"
                    title={wk.active ? 'Désactiver' : 'Activer'}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={wk.active ? 'M10 9v6m4-6v6' : 'M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z'} /></svg>
                  </button>
                  <button
                    onClick={() => handleDeleteWebhook(wk.id)}
                    disabled={deletingWkId === wk.id}
                    className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950 transition-colors"
                    title="Supprimer"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
              {expandedWkId === wk.id && (
                <div className="border-t border-gray-200 dark:border-gray-700 px-3 py-2">
                  {!wkDeliveries[wk.id] ? (
                    <p className="text-xs text-gray-500 dark:text-gray-500 py-1">Chargement…</p>
                  ) : wkDeliveries[wk.id].length === 0 ? (
                    <p className="text-xs text-gray-500 dark:text-gray-500 py-1">Aucune livraison enregistrée.</p>
                  ) : (
                    <div className="space-y-1 max-h-48 overflow-y-auto">
                      {wkDeliveries[wk.id].map((d) => (
                        <div key={d.id} className="flex items-center gap-2 text-xs py-0.5">
                          <span className={`shrink-0 w-12 text-center px-1 py-0.5 rounded font-medium ${d.statusCode !== null && d.statusCode < 400 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400' : 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400'}`}>
                            {d.statusCode ?? 'ERR'}
                          </span>
                          <span className="text-gray-600 dark:text-gray-300 truncate">{WEBHOOK_EVENT_LABELS[d.event] ?? d.event}</span>
                          {d.error && <span className="text-red-500 dark:text-red-400 truncate" title={d.error}>{d.error}</span>}
                          <span className="ml-auto shrink-0 text-gray-500 dark:text-gray-500">{d.durationMs} ms</span>
                          <span className="shrink-0 text-gray-500 dark:text-gray-500">
                            {new Date(d.createdAt).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              </div>
            ))}
          </div>
        ) : !showWebhookForm && (
          <p className="text-sm text-gray-500 dark:text-gray-500">Aucun webhook configuré.</p>
        )}
      </SectionCard>

      {/* ── Journal de sécurité ── */}
      <SectionCard title="Journal de sécurité">
        <p className="text-xs text-gray-500 dark:text-gray-500 mb-4">
          Les 50 dernières actions sensibles de votre compte : connexions, changements de mot de passe, clés API, webhooks.
        </p>
        {!showAuditLog ? (
          <button
            onClick={() => setShowAuditLog(true)}
            className="flex items-center gap-2 text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
            Afficher le journal
          </button>
        ) : auditLog.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-500">Aucune action enregistrée pour le moment.</p>
        ) : (
          <div className="space-y-1 max-h-64 overflow-y-auto">
            {auditLog.map((entry) => (
              <div key={entry.id} className="flex items-center gap-2 text-xs py-1.5 border-b border-gray-50 dark:border-gray-800 last:border-0">
                <span className={`shrink-0 w-1.5 h-1.5 rounded-full ${entry.action === 'auth.login_failed' ? 'bg-red-400' : 'bg-emerald-400'}`} />
                <span className="text-gray-700 dark:text-gray-200 font-medium">{AUDIT_ACTION_LABELS[entry.action] ?? entry.action}</span>
                {entry.resource && <span className="text-gray-500 dark:text-gray-500 truncate">« {entry.resource} »</span>}
                <span className="ml-auto shrink-0 text-gray-500 dark:text-gray-500">{entry.ip ?? ''}</span>
                <span className="shrink-0 text-gray-500 dark:text-gray-500">
                  {new Date(entry.createdAt).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* ── Zone de danger ── */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-red-200 dark:border-red-900/50 shadow-sm p-6">
        <h2 className="text-xs font-semibold text-red-600 dark:text-red-400 uppercase tracking-wider mb-5">Zone de danger</h2>
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Supprimer mon compte</p>
            <p className="text-xs text-gray-500 dark:text-gray-500 mt-0.5">
              Efface définitivement votre compte et toutes vos données (boards, dailys, salles, équipes…). Irréversible.
            </p>
          </div>
          <button
            onClick={() => setShowDeleteModal(true)}
            className="shrink-0 px-4 py-2 rounded-xl border border-red-200 dark:border-red-900/60 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
          >
            Supprimer
          </button>
        </div>
      </div>

      {/* ── Modale de confirmation de suppression ── */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={closeDeleteModal}>
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleDeleteAccount}
            className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md p-6 flex flex-col gap-4"
          >
            <div className="flex items-start gap-3">
              <div className="shrink-0 w-10 h-10 rounded-full bg-red-50 dark:bg-red-950 flex items-center justify-center">
                <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Supprimer le compte ?</h3>
                <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
                  Cette action est <span className="font-semibold text-red-600 dark:text-red-400">définitive</span>. Toutes vos données seront supprimées et ne pourront pas être récupérées.
                </p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Confirmez avec votre mot de passe
              </label>
              <input
                autoFocus
                type="password"
                value={deletePwd}
                onChange={(e) => setDeletePwd(e.target.value)}
                autoComplete="current-password"
                placeholder="••••••••"
                className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2.5 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-red-500"
              />
              {deleteError && <p className="text-sm text-red-600 dark:text-red-400 mt-2">{deleteError}</p>}
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={closeDeleteModal}
                className="px-4 py-2 rounded-xl text-sm font-medium text-gray-500 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={deleting || !deletePwd}
                className="px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {deleting ? 'Suppression…' : 'Supprimer définitivement'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
