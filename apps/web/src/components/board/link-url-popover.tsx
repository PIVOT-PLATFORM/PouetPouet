interface Props {
  screenX: number
  screenY: number
  url: string
  onUrlChange: (url: string) => void
  onConfirm: () => void
  onCancel: () => void
}

export function LinkUrlPopover({ screenX, screenY, url, onUrlChange, onConfirm, onCancel }: Props) {
  return (
    <div
      style={{ position: 'fixed', left: screenX - 8, top: screenY - 8, zIndex: 200 }}
      className="bg-white rounded-2xl shadow-2xl border border-gray-200 p-4 flex flex-col gap-3 w-72"
      onMouseDown={(e) => e.stopPropagation()}
    >
      <p className="text-sm font-semibold text-gray-800">Ajouter un lien</p>
      <input
        autoFocus
        type="url"
        placeholder="https://..."
        value={url}
        onChange={(e) => onUrlChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onConfirm()
          if (e.key === 'Escape') onCancel()
        }}
        className="text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent"
      />
      <div className="flex gap-2 justify-end">
        <button
          onClick={onCancel}
          className="text-xs px-3 py-1.5 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
        >
          Annuler
        </button>
        <button
          onClick={onConfirm}
          className="text-xs px-3 py-1.5 rounded-lg bg-primary-600 text-white hover:bg-primary-700 transition-colors font-medium"
        >
          Ajouter
        </button>
      </div>
    </div>
  )
}
