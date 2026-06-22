'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useFlagsStore } from '@/store/flags'

// Redirige vers /hub si le flag donné est explicitement false.
// À utiliser dans la page d'entrée de chaque module flaggué.
// Ne fait rien tant que les flags ne sont pas encore chargés (évite le flash).
export function useFlagGuard(key: string) {
  const router = useRouter()
  const { flags, loaded } = useFlagsStore()

  useEffect(() => {
    if (!loaded) return
    if (flags[key] === false) {
      router.replace('/hub')
    }
  }, [loaded, flags, key, router])
}
