'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuthStore } from '@/store/auth'

/**
 * Pilote le déclenchement d'un tutoriel :
 *  - auto à la première visite (tant que l'id n'est pas dans `user.tutorialsSeen`)
 *  - forcé via `?tutorial=<id>` dans l'URL (relance depuis l'Aide)
 *
 * `enabled` permet d'attendre que la page soit prête (board chargé, accès autorisé).
 * À la fermeture (terminé ou quitté), le tutoriel est marqué comme vu.
 */
export function useTutorial(tutorialId: string, enabled: boolean) {
  const user = useAuthStore((s) => s.user)
  const markTutorialSeen = useAuthStore((s) => s.markTutorialSeen)
  const [active, setActive] = useState(false)
  const evaluated = useRef(false)

  useEffect(() => {
    if (!enabled || evaluated.current) return
    evaluated.current = true

    // Relance forcée via l'URL ?tutorial=<id> — on nettoie le paramètre.
    const params = new URLSearchParams(window.location.search)
    if (params.get('tutorial') === tutorialId) {
      params.delete('tutorial')
      const qs = params.toString()
      window.history.replaceState(null, '', window.location.pathname + (qs ? `?${qs}` : ''))
      setActive(true)
      return
    }

    // Déclenchement auto à la première visite.
    const seen = user?.tutorialsSeen ?? []
    if (user && !seen.includes(tutorialId)) setActive(true)
  }, [enabled, tutorialId, user])

  const close = useCallback(() => {
    setActive(false)
    void markTutorialSeen(tutorialId)
  }, [markTutorialSeen, tutorialId])

  const start = useCallback(() => setActive(true), [])

  return { active, start, close }
}
