'use client'

import { useCallback, useEffect, useLayoutEffect, useState } from 'react'
import type { TutorialStep } from './tutorials'

interface Props {
  steps: TutorialStep[]
  onClose: (reason: 'completed' | 'quit' | 'reset') => void
}

interface Rect { top: number; left: number; width: number; height: number }

const MASK_STRONG = 'rgba(15,23,42,0.75)'
const CARD_W = 440
const CARD_H_EST = 240

// ── Positionnement de la carte d'instructions ─────────────────────────────────
// Grande cible (canvas, plein écran) → bas-gauche (les boutons de nav sont bas-droite).
// Petite cible → en-dessous si de la place, au-dessus, puis côté droit/gauche.
// Toujours clampé dans le viewport.
function computeCardStyle(rect: Rect | null): React.CSSProperties {
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800
  const vw = typeof window !== 'undefined' ? window.innerWidth  : 1200
  const M  = 16

  if (!rect) {
    return { position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)' }
  }

  // "Extra-large" : canvas (couvre > 50% de chaque dimension)
  const isExtraLarge = rect.width > vw * 0.5 && rect.height > vh * 0.5
  if (isExtraLarge) {
    // Bas-gauche : nav buttons sont bas-droite → pas de chevauchement
    return { position: 'fixed', bottom: 90, left: M }
  }

  // Cible petite/moyenne : cherche le plus grand espace libre
  const spaceBelow = vh - rect.top - rect.height
  const spaceAbove = rect.top
  const centX = Math.min(Math.max(M, rect.left + rect.width / 2 - CARD_W / 2), vw - CARD_W - M)

  if (spaceBelow >= CARD_H_EST + M * 2) {
    return { position: 'fixed', top: rect.top + rect.height + M, left: centX }
  }
  if (spaceAbove >= CARD_H_EST + M * 2) {
    return { position: 'fixed', top: Math.max(M, rect.top - CARD_H_EST - M), left: centX }
  }
  const spaceRight = vw - rect.left - rect.width
  if (spaceRight >= CARD_W + M * 2) {
    return { position: 'fixed',
      top: Math.min(Math.max(M, rect.top), vh - CARD_H_EST - M),
      left: rect.left + rect.width + M }
  }
  if (rect.left >= CARD_W + M * 2) {
    return { position: 'fixed',
      top: Math.min(Math.max(M, rect.top), vh - CARD_H_EST - M),
      left: Math.max(M, rect.left - CARD_W - M) }
  }
  // Fallback : au-dessus, centré
  return { position: 'fixed',
    top: Math.max(M, rect.top - CARD_H_EST - M),
    left: Math.min(Math.max(M, rect.left + rect.width / 2 - CARD_W / 2), vw - CARD_W - M) }
}

// ── Composant ─────────────────────────────────────────────────────────────────
export function TutorialOverlay({ steps, onClose }: Props) {
  const [i, setI]             = useState(0)
  const [rect, setRect]       = useState<Rect | null>(null)
  const [blockedRects, setBlockedRects] = useState<Rect[]>([])

  const step   = steps[i]
  const isLast = i === steps.length - 1
  const kind   = step?.kind ?? (step?.target ? 'spotlight' : 'centered')
  const isCentered = kind === 'centered'

  // ── Navigation ───────────────────────────────────────────────────────────────
  const next = useCallback(() => {
    setI((idx) => {
      if (idx >= steps.length - 1) { onClose('completed'); return idx }
      return idx + 1
    })
  }, [steps.length, onClose])

  const prev = useCallback(() => setI((idx) => (idx === 0 ? 0 : idx - 1)), [])
  const quit  = useCallback(() => onClose('quit'),  [onClose])
  const reset = useCallback(() => onClose('reset'), [onClose])

  // ── Mesure la cible + les éléments bloqués ───────────────────────────────────
  useLayoutEffect(() => {
    if (!step) return

    function measure() {
      // Cible principale
      if (!step.target) {
        setRect(null)
      } else {
        const el = document.querySelector(`[data-tutorial="${step.target}"]`)
        if (!el) {
          setRect(null)
        } else {
          const r = el.getBoundingClientRect()
          const pad = step.pad ?? 8
          setRect({ top: r.top - pad, left: r.left - pad, width: r.width + pad * 2, height: r.height + pad * 2 })
        }
      }

      // Éléments additionnels à masquer
      const extras: Rect[] = []
      for (const sel of step.blocked ?? []) {
        const el = document.querySelector(`[data-tutorial="${sel}"]`)
        if (el) {
          const r = el.getBoundingClientRect()
          extras.push({ top: r.top, left: r.left, width: r.width, height: r.height })
        }
      }
      setBlockedRects(extras)
    }

    measure()
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)
    return () => {
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure, true)
    }
  }, [step, i])

  // ── Clavier ──────────────────────────────────────────────────────────────────
  // Échap quitte dans tous les modes.
  // ArrowRight/Enter/ArrowLeft : uniquement en 'centered' (les autres modes laissent
  // le clavier au board pour Ctrl+Z, flèches déplacement, etc.)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault(); e.stopImmediatePropagation(); quit(); return
      }
      if (isCentered) {
        if (e.key === 'ArrowRight' || e.key === 'Enter') { e.preventDefault(); e.stopImmediatePropagation(); next() }
        else if (e.key === 'ArrowLeft') { e.preventDefault(); e.stopImmediatePropagation(); prev() }
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [next, prev, quit, isCentered])

  if (!step) return null

  const cardStyle = computeCardStyle(rect)
  const TR = 'transition-all duration-300 ease-out'

  // ── Rendu ─────────────────────────────────────────────────────────────────────
  // Le conteneur racine n'intercepte jamais les événements (pointer-events:none).
  // Les bandes sombres 'spotlight' ont pointer-events:auto → bloquent les clics hors cible.
  // Le trou est vide → les clics atteignent directement la vraie UI.
  // Mode 'interactive' : aucune bande → modales et popups s'ouvrent normalement.
  // Mode 'centered' : fond plein avec pointer-events:auto + onClick=next.
  return (
    <div
      className="fixed inset-0 z-[9998]"
      style={{ pointerEvents: 'none' }}
      aria-live="polite"
      role="dialog"
      aria-modal={isCentered}
    >

      {/* ── Fond sombre ── */}
      {isCentered ? (
        // Plein écran, cliquable pour avancer
        <div
          className={`absolute inset-0 ${TR}`}
          style={{ background: MASK_STRONG, pointerEvents: 'auto', cursor: 'pointer' }}
          onClick={next}
        />
      ) : kind === 'spotlight' && rect ? (
        // 4 bandes autour de la cible (pointer-events:auto → bloquent les clics hors trou)
        <>
          <div className={`absolute left-0 right-0 top-0 ${TR}`}
            style={{ height: Math.max(0, rect.top), background: MASK_STRONG, pointerEvents: 'auto' }} />
          <div className={`absolute left-0 right-0 bottom-0 ${TR}`}
            style={{ top: rect.top + rect.height, background: MASK_STRONG, pointerEvents: 'auto' }} />
          <div className={`absolute left-0 ${TR}`}
            style={{ top: rect.top, height: rect.height, width: Math.max(0, rect.left), background: MASK_STRONG, pointerEvents: 'auto' }} />
          <div className={`absolute right-0 ${TR}`}
            style={{ top: rect.top, height: rect.height, left: rect.left + rect.width, background: MASK_STRONG, pointerEvents: 'auto' }} />
          {/* Anneau lumineux non-bloquant */}
          <div className={`absolute rounded-xl ${TR}`}
            style={{
              top: rect.top, left: rect.left, width: rect.width, height: rect.height,
              boxShadow: '0 0 0 3px rgba(99,102,241,0.6), 0 0 32px 8px rgba(99,102,241,0.30)',
              border: '2px solid rgba(99,102,241,0.7)',
              pointerEvents: 'none',
            }} />
        </>
      ) : kind === 'spotlight' && !rect ? (
        // Cible introuvable : fond léger sans bloquer les clics
        <div className={`absolute inset-0 ${TR}`}
          style={{ background: 'rgba(15,23,42,0.20)', pointerEvents: 'none' }} />
      ) : rect ? (
        // interactive + cible trouvée : juste l'anneau lumineux, pas de bandes
        // (les modales s'ouvrent librement au-dessus du tutorial)
        <div className={`absolute rounded-xl ${TR}`}
          style={{
            top: rect.top, left: rect.left, width: rect.width, height: rect.height,
            boxShadow: '0 0 0 3px rgba(99,102,241,0.5), 0 0 24px 6px rgba(99,102,241,0.25)',
            border: '2px solid rgba(99,102,241,0.6)',
            pointerEvents: 'none',
          }} />
      ) : null /* interactive sans cible : rien */ }

      {/* ── Masques additionnels (blocked) : re-masquent des éléments dans le trou ── */}
      {blockedRects.map((r, idx) => (
        <div
          key={idx}
          className={`absolute rounded-lg ${TR}`}
          style={{
            top: r.top, left: r.left, width: r.width, height: r.height,
            background: MASK_STRONG,
            pointerEvents: 'auto',
          }}
        />
      ))}

      {/* ── Carte d'instructions ── */}
      <div
        className={`absolute bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-700 p-5 ${TR}`}
        style={{ ...cardStyle, width: CARD_W, maxWidth: 'calc(100vw - 2rem)', pointerEvents: 'auto' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* En-tête */}
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-primary-500 tracking-wide uppercase">
            Étape {i + 1} / {steps.length}
          </span>
          <button
            onClick={quit}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
            title="Quitter"
            aria-label="Quitter"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-1.5">{step.title}</h3>
        <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-300 whitespace-pre-line">{step.body}</p>

        {/* Barre de progression */}
        <div className="flex items-center gap-1 mt-4 flex-wrap">
          {steps.map((_, idx) => (
            <span
              key={idx}
              className={`h-1.5 rounded-full transition-all ${
                idx === i ? 'w-5 bg-primary-500' : idx < i ? 'w-1.5 bg-primary-200' : 'w-1.5 bg-gray-200 dark:bg-gray-600'
              }`}
            />
          ))}
        </div>

        {/* Hint contextuel */}
        {!step.isOutro && (
          <p className="mt-2 text-[11px] text-gray-400 dark:text-gray-500">
            {isCentered
              ? "Cliquez n'importe où ou appuyez sur → pour continuer"
              : "Réalisez l'action ci-dessus, puis cliquez Suivant →"}
          </p>
        )}

        {/* Boutons outro */}
        {step.isOutro && (
          <div className="flex gap-2 mt-4">
            <button
              onClick={() => onClose('completed')}
              className="flex-1 h-10 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-1.5"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Terminé — garder les éléments
            </button>
            <button
              onClick={reset}
              className="h-10 px-4 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 text-sm font-medium transition-colors border border-red-200 shrink-0"
              title="Supprimer les éléments créés pendant le tour"
            >
              🗑 Reset
            </button>
          </div>
        )}
      </div>

      {/* ── Navigation bas-droite ── */}
      <div
        className="fixed bottom-5 right-5 flex items-center gap-2 z-[9999]"
        style={{ pointerEvents: 'auto' }}
      >
        <button
          onClick={quit}
          className="px-3 h-10 rounded-xl text-sm font-medium text-gray-200 bg-white/10 hover:bg-white/20 backdrop-blur transition-colors"
        >
          Quitter
        </button>
        {!step.isOutro && (
          <>
            <button
              onClick={prev}
              disabled={i === 0}
              className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/90 hover:bg-white text-gray-700 shadow-lg disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              aria-label="Précédent"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={next}
              className="h-10 px-4 flex items-center gap-1.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-medium shadow-lg transition-colors text-sm"
            >
              {isLast ? 'Terminer' : 'Suivant'}
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </>
        )}
      </div>
    </div>
  )
}
