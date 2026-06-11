'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/auth'

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
      <h2 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-5">{title}</h2>
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
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Gérez vos informations personnelles et vos préférences</p>
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
            <p className="text-xs text-gray-400 dark:text-gray-500">JPG, PNG, GIF · Max 5 Mo · Redimensionnée à 256 px</p>
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
              className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2.5 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Email <span className="text-gray-400 dark:text-gray-500 font-normal">(non modifiable)</span>
            </label>
            <input
              type="email"
              value={user.email}
              disabled
              className="w-full rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-850 px-4 py-2.5 text-sm text-gray-400 dark:text-gray-500 cursor-not-allowed"
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
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 text-right">{bio.length}/500</p>
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
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Affichage sombre pour réduire la fatigue visuelle</p>
            </div>
            <button
              type="button"
              onClick={handleThemeToggle}
              className={`relative shrink-0 w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900 ${
                user.theme === 'dark' ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-gray-700'
              }`}
              role="switch"
              aria-checked={user.theme === 'dark'}
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
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
              {new Date(user.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-400 dark:text-gray-500">ID utilisateur</p>
            <p className="text-xs font-mono text-gray-300 dark:text-gray-600 mt-0.5">{user.id.slice(0, 8)}…</p>
          </div>
        </div>
      </SectionCard>

      {/* ── Données personnelles ── */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-6">
        <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-5">Mes données (RGPD)</h2>
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Exporter mes données</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
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

      {/* ── Zone de danger ── */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-red-200 dark:border-red-900/50 shadow-sm p-6">
        <h2 className="text-xs font-semibold text-red-500 dark:text-red-400 uppercase tracking-wider mb-5">Zone de danger</h2>
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Supprimer mon compte</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
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
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
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
                className="px-4 py-2 rounded-xl text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
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
