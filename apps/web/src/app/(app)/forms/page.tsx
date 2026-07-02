'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Plus, FileText, Trash2, BarChart3, Pencil, CheckCircle2, EyeOff, Users, Copy } from 'lucide-react'
import { useForms } from '@/hooks/useForms'
import { useFlagGuard } from '@/hooks/useFlagGuard'
import { useState } from 'react'

export default function FormsPage() {
  useFlagGuard('module.forms')
  const router = useRouter()
  const { forms, isLoading, createForm, deleteForm, duplicateForm } = useForms()
  const [creating, setCreating] = useState(false)
  const [duplicating, setDuplicating] = useState<string | null>(null)

  async function handleCreate() {
    setCreating(true)
    try {
      const f = await createForm('Nouveau formulaire')
      router.push(`/forms/${f.id}/edit`)
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold dark:text-white">Formulaires</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Créez des formulaires, partagez un lien, collectez les réponses.</p>
        </div>
        <button
          onClick={handleCreate}
          disabled={creating}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-500 hover:bg-violet-600 disabled:opacity-50 text-white text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nouveau formulaire
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="w-7 h-7 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : forms.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
          <FileText className="w-12 h-12 text-gray-300 dark:text-gray-600" />
          <p className="text-gray-500 dark:text-gray-400">Aucun formulaire. Créez-en un pour commencer.</p>
        </div>
      ) : (
        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))' }}>
          {forms.map((f) => (
            <div key={f.id} className="flex flex-col gap-3 p-5 rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 hover:shadow-sm transition-all">
              <div className="flex items-start justify-between gap-2">
                <Link href={`/forms/${f.id}/edit`} className="font-semibold text-sm dark:text-white hover:text-violet-500 transition-colors line-clamp-2 flex-1">
                  {f.title}
                </Link>
                {f.isPublished ? (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400 flex items-center gap-1 flex-shrink-0">
                    <CheckCircle2 className="w-3 h-3" /> Publié
                  </span>
                ) : (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400 flex items-center gap-1 flex-shrink-0">
                    <EyeOff className="w-3 h-3" /> Brouillon
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3 text-xs text-gray-400">
                <span>{f.fieldCount} champ{f.fieldCount > 1 ? 's' : ''}</span>
                <span>·</span>
                <span>{f.responseCount} réponse{f.responseCount > 1 ? 's' : ''}</span>
                {f.role !== 'OWNER' && (
                  <span className="flex items-center gap-1 text-violet-500"><Users className="w-3 h-3" /> Partagé</span>
                )}
              </div>

              <div className="flex gap-2 pt-1">
                <Link
                  href={`/forms/${f.id}/edit`}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-500 hover:bg-violet-600 text-white text-xs font-medium transition-colors"
                >
                  <Pencil className="w-3 h-3" /> Éditer
                </Link>
                <Link
                  href={`/forms/${f.id}/responses`}
                  className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-xs font-medium hover:bg-gray-50 dark:hover:bg-gray-800 dark:text-white transition-colors"
                >
                  <BarChart3 className="w-3 h-3" /> Réponses
                </Link>
                <button
                  onClick={async () => { setDuplicating(f.id); await duplicateForm(f.id).finally(() => setDuplicating(null)) }}
                  disabled={duplicating === f.id}
                  title="Dupliquer"
                  className="p-1.5 rounded-lg text-gray-400 hover:text-violet-500 hover:bg-violet-50 dark:hover:bg-violet-900/20 disabled:opacity-40 transition-colors"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
                {f.role === 'OWNER' && (
                  <button
                    onClick={() => { if (confirm('Supprimer ce formulaire et toutes ses réponses ?')) deleteForm(f.id) }}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                    title="Supprimer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
