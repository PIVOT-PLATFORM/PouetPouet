'use client'

import { useEffect, useRef, useState } from 'react'

interface Props {
  onShowResults: () => void
}

export function VoteEndOverlay({ onShowResults }: Props) {
  const [visible, setVisible] = useState(false)
  const [countdown, setCountdown] = useState(15)
  const onShowResultsRef = useRef(onShowResults)
  onShowResultsRef.current = onShowResults

  useEffect(() => {
    const raf = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(raf)
  }, [])

  useEffect(() => {
    if (countdown <= 0) {
      onShowResultsRef.current()
      return
    }
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [countdown])

  return (
    <>
      <style>{`
        @keyframes voteEndCardIn {
          0%   { transform: translateY(32px) scale(0.92); opacity: 0; }
          65%  { transform: translateY(-6px) scale(1.02); opacity: 1; }
          100% { transform: translateY(0) scale(1); opacity: 1; }
        }
        @keyframes voteEndBadgeIn {
          0%   { transform: translateY(10px); opacity: 0; }
          100% { transform: translateY(0); opacity: 1; }
        }
        .vote-end-card-in  { animation: voteEndCardIn  0.55s cubic-bezier(0.34, 1.4, 0.64, 1) forwards; }
        .vote-end-badge-in { animation: voteEndBadgeIn 0.4s ease 0.5s both; }
      `}</style>

      <div
        className="absolute inset-0 flex items-center justify-center z-[150] cursor-pointer select-none"
        style={{
          background: 'rgba(248, 246, 255, 0.75)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          opacity: visible ? 1 : 0,
          transition: 'opacity 0.4s ease',
        }}
        onClick={onShowResults}
      >
        <div className="vote-end-card-in flex flex-col items-center gap-5 text-center">

          <div className="w-36 h-48 rounded-2xl bg-gradient-to-br from-secondary-500 to-primary-600 flex flex-col items-center justify-center shadow-2xl gap-3">
            <svg className="w-12 h-12 text-white/90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <span className="text-white/70 text-xs font-semibold tracking-widest uppercase">Résultats</span>
          </div>

          <div className="flex flex-col items-center gap-1.5">
            <h2 className="text-2xl font-bold text-gray-800 tracking-tight">Vote terminé !</h2>
            <p className="text-gray-400 text-sm">Les résultats sont prêts</p>
          </div>

          <div className="vote-end-badge-in inline-block bg-secondary-50 rounded-2xl px-6 py-3">
            <p className="text-xs text-secondary-400 font-medium mb-0.5">Affichage dans</p>
            <p className="text-sm font-bold text-secondary-700">{countdown}s · Cliquez pour voir</p>
          </div>

        </div>
      </div>
    </>
  )
}
