import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

export const metadata: Metadata = {
  title: 'PIVOT',
  description: 'Suite collaborative interactive',
}

// Inlined script to apply dark class before first paint — prevents flash
const themeScript = `
try {
  const s = JSON.parse(localStorage.getItem('pouetpouet-auth') || '{}')
  if (s?.state?.user?.theme === 'dark') document.documentElement.classList.add('dark')
} catch {}
`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={inter.variable}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="font-sans bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 antialiased">
        {children}
      </body>
    </html>
  )
}
