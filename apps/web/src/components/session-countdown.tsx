'use client'

import { useEffect, useState } from 'react'
import { useAuthStore } from '@/store/auth'
import { tokenTimes } from '@/lib/jwt'

// Show the countdown once the session has this little time left; turn red in the final minute.
const WARN_BEFORE_MS = 5 * 60_000
const RED_BEFORE_MS = 60_000

export function SessionCountdown() {
  const token = useAuthStore((s) => s.token)
  const sessionExpired = useAuthStore((s) => s.sessionExpired)
  const [remaining, setRemaining] = useState<number | null>(null)

  useEffect(() => {
    if (!token) {
      setRemaining(null)
      return
    }
    const times = tokenTimes(token)
    if (!times) {
      setRemaining(null)
      return
    }
    const tick = () => setRemaining(times.exp - Date.now())
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [token])

  if (sessionExpired || remaining == null) return null
  if (remaining > WARN_BEFORE_MS || remaining < 0) return null

  const totalSec = Math.ceil(remaining / 1000)
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  const isRed = remaining <= RED_BEFORE_MS

  return (
    <div
      className={`fixed bottom-4 left-4 z-[300] rounded-lg text-white text-xs font-mono font-semibold px-3 py-2 shadow-lg ${
        isRed ? 'bg-red-500' : 'bg-amber-500'
      }`}
    >
      ⏱ Session expire dans {m}:{s.toString().padStart(2, '0')}
    </div>
  )
}
