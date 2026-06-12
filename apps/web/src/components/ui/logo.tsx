interface LogoProps {
  size?: number
  showText?: boolean
  className?: string
}

export function Logo({ size = 28, showText = true, className = '' }: LogoProps) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 32 32"
        width={size}
        height={size}
        aria-hidden="true"
        className="shrink-0"
      >
        <defs>
          <linearGradient id="logo-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#6366f1" />
            <stop offset="100%" stopColor="#8b5cf6" />
          </linearGradient>
        </defs>
        <rect width="32" height="32" rx="8" fill="url(#logo-grad)" />
        <rect x="6" y="12" width="12" height="15" rx="2.5" fill="white" fillOpacity="0.4" />
        <rect x="14" y="5" width="12" height="15" rx="2.5" fill="white" fillOpacity="0.95" />
      </svg>
      {showText && (
        <span className="font-bold text-primary-600 text-lg tracking-tight leading-none">
          PouetPouet
        </span>
      )}
    </div>
  )
}
