import Link from 'next/link'

const LINKS = [
  { href: '/mentions-legales', label: 'Mentions légales' },
  { href: '/confidentialite', label: 'Confidentialité' },
  { href: '/cgu', label: 'CGU' },
]

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <header className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-6 h-14 flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2 font-bold text-gray-900 dark:text-white">
            <span className="text-xl">🎯</span>
            PouetPouet
          </Link>
          <nav className="ml-auto flex items-center gap-1 text-sm">
            {LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="px-3 py-1.5 rounded-lg text-gray-500 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12">
        <article>{children}</article>
      </main>

      <footer className="border-t border-gray-100 dark:border-gray-800">
        <div className="max-w-3xl mx-auto px-6 py-6 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-gray-400 dark:text-gray-600">
          <span>© {new Date().getFullYear()} PouetPouet</span>
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="hover:text-gray-700 dark:hover:text-gray-300 transition-colors">
              {l.label}
            </Link>
          ))}
        </div>
      </footer>
    </div>
  )
}
