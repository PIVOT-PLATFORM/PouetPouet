'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/auth'

export default function RootPage() {
  const { token } = useAuthStore()
  const router = useRouter()

  useEffect(() => {
    router.replace(token ? '/dashboard' : '/login')
  }, [token, router])

  return null
}
