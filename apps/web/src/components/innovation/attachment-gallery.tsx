'use client'

import { useRef, useState } from 'react'
import { FileText, Film, Image as ImageIcon, Trash2, Upload } from 'lucide-react'
import type { InnovationAttachment } from '@/hooks/useInnovationAttachments'

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`
}

function iconFor(mimeType: string) {
  if (mimeType.startsWith('image/')) return ImageIcon
  if (mimeType.startsWith('video/')) return Film
  return FileText
}

interface Props {
  attachments: InnovationAttachment[]
  canEdit: boolean
  onUpload: (file: File) => Promise<unknown>
  onOpen: (attachmentId: string) => Promise<{ url: string }>
  onDelete: (attachmentId: string) => Promise<unknown>
}

// Galerie de pièces jointes (texte/image/vidéo) — grille avec icône par type, upload
// via input file caché déclenché par un bouton, suppression pour l'auteur/admin.
export function AttachmentGallery({ attachments, canEdit, onUpload, onOpen, onDelete }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setError(null)
    try {
      await onUpload(file)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  async function handleOpen(attachmentId: string) {
    const { url } = await onOpen(attachmentId)
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="flex flex-col gap-3">
      {attachments.length === 0 ? (
        <p className="text-xs text-gray-400">Aucune pièce jointe.</p>
      ) : (
        <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))' }}>
          {attachments.map((a) => {
            const Icon = iconFor(a.mimeType)
            return (
              <div key={a.id} className="flex flex-col gap-1.5 rounded-xl border border-gray-200 dark:border-gray-700 p-3 hover:border-amber-300 dark:hover:border-amber-700 transition-colors">
                <button onClick={() => handleOpen(a.id)} className="flex items-center gap-2 text-left min-w-0">
                  <Icon size={16} className="shrink-0 text-amber-500" />
                  <span className="text-xs font-medium text-gray-700 dark:text-gray-200 truncate">{a.filename}</span>
                </button>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] text-gray-400">{formatSize(a.sizeBytes)}</span>
                  <button onClick={() => onDelete(a.id)} className="p-1 rounded text-gray-300 hover:text-red-500" title="Supprimer"><Trash2 size={12} /></button>
                </div>
              </div>
            )
          })}
        </div>
      )}
      {canEdit && (
        <div className="flex items-center gap-2 pt-1">
          <input ref={inputRef} type="file" accept="image/*,video/*,application/pdf,text/plain" onChange={handleFileChange} className="hidden" />
          <button
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50"
          >
            <Upload size={13} /> {uploading ? 'Envoi…' : 'Ajouter une pièce jointe'}
          </button>
        </div>
      )}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}
