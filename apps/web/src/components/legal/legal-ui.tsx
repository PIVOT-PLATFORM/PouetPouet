export function PageTitle({ children, updated }: { children: React.ReactNode; updated?: string }) {
  return (
    <header className="mb-8">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">{children}</h1>
      {updated && (
        <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">Dernière mise à jour : {updated}</p>
      )}
    </header>
  )
}

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">{title}</h2>
      <div className="space-y-3 text-sm leading-relaxed text-gray-600 dark:text-gray-300">{children}</div>
    </section>
  )
}

export function List({ children }: { children: React.ReactNode }) {
  return <ul className="list-disc pl-5 space-y-1.5 marker:text-gray-300 dark:marker:text-gray-600">{children}</ul>
}
