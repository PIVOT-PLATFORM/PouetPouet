interface LogoProps {
  size?: number
  showText?: boolean
  className?: string
}

/**
 * Logo PIVOT — « The Tilt » : le P bascule de 12° autour de son point d'ancrage.
 * Le ghost derrière montre la position d'origine ; le point cyan = l'axe de pivot,
 * l'élément vivant de la marque. Icône auto-contenue (tuile sombre) → fonctionne
 * aussi bien sur header clair que sombre.
 */
export function Logo({ size = 28, showText = true, className = '' }: LogoProps) {
  const displaySize = Math.round(size * 1.4)
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <svg
        width={displaySize}
        height={displaySize}
        viewBox="0 0 64 64"
        className="shrink-0"
        style={{ minWidth: displaySize }}
        role="img"
        aria-label="PIVOT"
      >
        <defs>
          <linearGradient id="pivotP" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#a78bff" />
            <stop offset="1" stopColor="#7c5cff" />
          </linearGradient>
          <linearGradient id="pivotGhost" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#7c5cff" stopOpacity="0.25" />
            <stop offset="1" stopColor="#7c5cff" stopOpacity="0.05" />
          </linearGradient>
        </defs>
        {/* Tuile adaptative : claire en light, sombre en dark */}
        <rect width="64" height="64" rx="15" className="fill-[#f1f0f7] dark:fill-[#15151d]" />
        <rect width="64" height="64" rx="15" fill="none" className="stroke-black/5 dark:stroke-white/10" />
        {/* Ghost P (position d'origine, verticale) */}
        <g fill="url(#pivotGhost)">
          <rect x="22" y="14" width="7" height="36" rx="3.5" />
          <path d="M22 14 h14 a11 11 0 0 1 0 22 h-14 v-7 h14 a4 4 0 0 0 0-8 h-14 Z" />
        </g>
        {/* P pivoté de 12° autour du pied (25.5, 50) */}
        <g fill="url(#pivotP)" transform="rotate(12 25.5 50)">
          <rect x="22" y="14" width="7" height="36" rx="3.5" />
          <path d="M22 14 h14 a11 11 0 0 1 0 22 h-14 v-7 h14 a4 4 0 0 0 0-8 h-14 Z" />
        </g>
        {/* Point d'ancrage — l'axe de rotation */}
        <circle cx="25.5" cy="50" r="3" fill="#4ee1ff" />
      </svg>
      {showText && (
        <span className="font-bold text-lg tracking-tight leading-none text-gray-900 dark:text-white">
          PIVOT
        </span>
      )}
    </div>
  )
}
