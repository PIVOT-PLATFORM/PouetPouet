interface Props {
  hasSelection: boolean
  zoom: number
  onFit: () => void
  onZoomBy: (factor: number) => void
  onZoomReset: () => void
}

export function ZoomControls({ hasSelection, zoom, onFit, onZoomBy, onZoomReset }: Props) {
  return (
    <div data-export-ignore="true" className="absolute bottom-4 right-6 flex items-center bg-white/95 border border-gray-200 rounded-lg shadow select-none text-xs font-mono text-gray-600">
      <button
        title={hasSelection ? 'Ajuster à la sélection' : 'Ajuster le board à l\'écran'}
        onClick={onFit}
        className="px-2 py-1.5 hover:bg-gray-100 rounded-l-lg transition-colors leading-none border-r border-gray-200"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V6a2 2 0 012-2h2M4 16v2a2 2 0 002 2h2m8-16h2a2 2 0 012 2v2m-4 12h2a2 2 0 002-2v-2" />
        </svg>
      </button>
      <button
        title="Dézoomer (−)"
        onClick={() => onZoomBy(1 / 1.25)}
        className="px-2 py-1.5 hover:bg-gray-100 transition-colors leading-none"
      >−</button>
      <button
        title="Réinitialiser le zoom (100%)"
        onClick={onZoomReset}
        className="px-2 py-1.5 hover:bg-gray-100 transition-colors leading-none min-w-[3.5rem] text-center"
      >{Math.round(zoom * 100)}%</button>
      <button
        title="Zoomer (+)"
        onClick={() => onZoomBy(1.25)}
        className="px-2 py-1.5 hover:bg-gray-100 rounded-r-lg transition-colors leading-none"
      >+</button>
    </div>
  )
}
