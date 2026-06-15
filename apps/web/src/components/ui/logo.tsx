interface LogoProps {
  size?: number
  showText?: boolean
  className?: string
}

export function Logo({ size = 28, showText = true, className = '' }: LogoProps) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/pivot-logo.png"
        alt="PIVOT"
        width={size}
        height={size}
        className="shrink-0 rounded-[22%]"
      />
      {showText && (
        <span className="font-bold text-primary-600 text-lg tracking-tight leading-none">
          PIVOT
        </span>
      )}
    </div>
  )
}
