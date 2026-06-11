'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/auth'
import { useAuthHydrated } from '@/hooks/useAuthHydrated'

export default function RootPage() {
  const { token } = useAuthStore()
  const hydrated = useAuthHydrated()
  const router = useRouter()

  useEffect(() => {
    if (hydrated) router.replace(token ? '/hub' : '/login')
  }, [hydrated, token, router])

  return null
}
