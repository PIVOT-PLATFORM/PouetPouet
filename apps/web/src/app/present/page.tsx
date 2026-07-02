'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { X, ChevronLeft, ChevronRight, Play, Pause } from 'lucide-react'
import { useAuthStore } from '@/store/auth'
import { PIVOT_SLIDES } from '@/components/present/slides'

const AUTOPLAY_MS = 6000

export default function PresentPage() {
  const router = useRouter()
  const { token } = useAuthStore()
  const [index, setIndex] = useState(0)
  const [autoplay, setAutoplay] = useState(false)
  const last = PIVOT_SLIDES.length - 1

  const go = useCallback((n: number) => setIndex(() => Math.max(0, Math.min(last, n))), [last])
  const next = useCallback(() => setIndex((i) => Math.min(last, i + 1)), [last])
  const prev = useCallback(() => setIndex((i) => Math.max(0, i - 1)), [])
  const exit = useCallback(() => router.push(token ? '/hub' : '/'), [router, token])

  // Navigation clavier
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowRight': case 'ArrowDown': case ' ': case 'PageDown': e.preventDefault(); next(); break
        case 'ArrowLeft': case 'ArrowUp': case 'PageUp': e.preventDefault(); prev(); break
        case 'Home': e.preventDefault(); go(0); break
        case 'End': e.preventDefault(); go(last); break
        case 'Escape': e.preventDefault(); exit(); break
        case 'p': case 'P': setAutoplay((a) => !a); break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [next, prev, go, last, exit])

  // Autoplay — s'arrête en fin de deck
  useEffect(() => {
    if (!autoplay) return
    if (index >= last) { setAutoplay(false); return }
    const t = setTimeout(() => setIndex((i) => Math.min(last, i + 1)), AUTOPLAY_MS)
    return () => clearTimeout(t)
  }, [autoplay, index, last])

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-[#060608] text-white flex flex-col">
      {/* Décor : halos radiaux violet/cyan */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 -left-40 w-[36rem] h-[36rem] rounded-full bg-[#7c5cff]/20 blur-[120px]" />
        <div className="absolute -bottom-52 -right-40 w-[40rem] h-[40rem] rounded-full bg-[#4ee1ff]/10 blur-[130px]" />
      </div>

      {/* Fermer */}
      <button onClick={exit} aria-label="Quitter la présentation"
        className="absolute top-5 right-5 z-20 w-9 h-9 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors">
        <X className="w-4 h-4" />
      </button>

      {/* Scène */}
      <main className="relative z-10 flex-1 flex items-center justify-center py-16">
        <div key={index} className="slide-enter w-full" aria-roledescription="slide" aria-label={`Slide ${index + 1} sur ${PIVOT_SLIDES.length}`}>
          {PIVOT_SLIDES[index].render()}
        </div>
      </main>

      {/* Zones de clic latérales (préc./suiv.) */}
      {index > 0 && <button aria-label="Slide précédente" onClick={prev} className="group absolute left-0 top-0 bottom-24 z-10 w-1/6 flex items-center justify-start pl-4">
        <ChevronLeft className="w-6 h-6 text-white/20 group-hover:text-white/70 transition-colors" />
      </button>}
      {index < last && <button aria-label="Slide suivante" onClick={next} className="group absolute right-0 top-0 bottom-24 z-10 w-1/6 flex items-center justify-end pr-4">
        <ChevronRight className="w-6 h-6 text-white/20 group-hover:text-white/70 transition-colors" />
      </button>}

      {/* Barre de contrôle */}
      <footer className="relative z-20 px-6 pb-6">
        {/* Progression */}
        <div className="h-0.5 w-full max-w-3xl mx-auto rounded-full bg-white/10 overflow-hidden">
          <div className="h-full bg-gradient-to-r from-[#7c5cff] to-[#4ee1ff] transition-all duration-500" style={{ width: `${((index + 1) / PIVOT_SLIDES.length) * 100}%` }} />
        </div>
        <div className="mt-4 flex items-center justify-center gap-4">
          <button onClick={() => setAutoplay((a) => !a)} aria-label={autoplay ? 'Pause' : 'Lecture automatique'}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 text-gray-300 transition-colors">
            {autoplay ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </button>
          {/* Pastilles */}
          <div className="flex items-center gap-2">
            {PIVOT_SLIDES.map((s, i) => (
              <button key={s.id} onClick={() => go(i)} aria-label={`Aller à la slide ${i + 1}`}
                className={`h-2 rounded-full transition-all ${i === index ? 'w-6 bg-white' : 'w-2 bg-white/25 hover:bg-white/50'}`} />
            ))}
          </div>
          <span className="text-xs font-mono text-gray-500 tabular-nums w-12 text-right">{index + 1} / {PIVOT_SLIDES.length}</span>
        </div>
      </footer>
    </div>
  )
}
