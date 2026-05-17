'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface Props {
  onClose: () => void
  onCreate: (name: string, description?: string) => Promise<void>
}

export function CreateBoardModal({ onClose, onCreate }: Props) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setError('Le nom est requis'); return }
    setIsLoading(true)
    setError(null)
    try {
      await onCreate(name.trim(), description.trim() || undefined)
      onClose()
    } catch (err) {
      setError((err as Error).message)
      setIsLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-5">Nouveau board</h2>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            label="Nom du board"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Rétrospective sprint 42"
            ref={inputRef}
          />
          <Input
            label="Description (optionnel)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Quelques mots…"
          />
          <div className="flex gap-3 mt-2">
            <Button variant="ghost" type="button" onClick={onClose} className="flex-1">
              Annuler
            </Button>
            <Button type="submit" isLoading={isLoading} className="flex-1">
              Créer
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
