'use client'

import { useEffect, useState } from 'react'

interface Props {
  onDismiss: () => void
}

export function TimerOverlay({ onDismiss }: Props) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const raf = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <>
      <style>{`
        @keyframes timerCardIn {
          0%   { transform: translateY(32px) scale(0.92); opacity: 0; }
          65%  { transform: translateY(-6px) scale(1.02); opacity: 1; }
          100% { transform: translateY(0) scale(1); opacity: 1; }
        }
        @keyframes timerBadgeIn {
          0%   { transform: translateY(10px); opacity: 0; }
          100% { transform: translateY(0); opacity: 1; }
        }
        .timer-card-in  { animation: timerCardIn  0.55s cubic-bezier(0.34, 1.4, 0.64, 1) forwards; }
        .timer-badge-in { animation: timerBadgeIn 0.4s ease 0.5s both; }
      `}</style>

      <div
        className="absolute inset-0 flex items-center justify-center z-[150] cursor-pointer select-none"
        style={{
          background: 'rgba(248, 248, 255, 0.75)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          opacity: visible ? 1 : 0,
          transition: 'opacity 0.4s ease',
        }}
        onClick={onDismiss}
      >
        <div className="timer-card-in flex flex-col items-center gap-5 text-center">

          {/* Carte principale — même style que les cartes de vote */}
          <div className="w-36 h-48 rounded-2xl bg-gradient-to-br from-primary-500 to-secondary-600 flex flex-col items-center justify-center shadow-2xl gap-3">
            <svg className="w-12 h-12 text-white/90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="9" strokeWidth={1.8} />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 7v5l3.5 3.5" />
            </svg>
            <span className="text-white/70 text-xs font-semibold tracking-widest uppercase">Terminé</span>
          </div>

          {/* Texte */}
          <div className="flex flex-col items-center gap-1.5">
            <h2 className="text-2xl font-bold text-gray-800 tracking-tight">
              Temps écoulé !
            </h2>
            <p className="text-gray-400 text-sm">En attente de la suite…</p>
          </div>

          {/* Badge vert — même style que le badge "Estimation" du scrum poker */}
          <div className="timer-badge-in inline-block bg-green-100 rounded-2xl px-6 py-3">
            <p className="text-xs text-green-500 font-medium mb-0.5">Action</p>
            <p className="text-sm font-bold text-green-700">Cliquez pour fermer</p>
          </div>

        </div>
      </div>
    </>
  )
}
