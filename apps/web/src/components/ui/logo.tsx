interface LogoProps {
  size?: number
  showText?: boolean
  className?: string
}

export function Logo({ size = 28, showText = true, className = '' }: LogoProps) {
  const displaySize = Math.round(size * 1.6)
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/pivot-logo.png"
        alt="PIVOT"
        width={displaySize}
        height={displaySize}
        className="shrink-0 rounded-[22%]"
        style={{ minWidth: displaySize }}
      />
      {showText && (
        <span className="font-bold text-primary-600 text-lg tracking-tight leading-none">
          PIVOT
        </span>
      )}
    </div>
  )
}
