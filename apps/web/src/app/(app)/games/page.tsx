import Link from 'next/link'

const GAMES = [
  {
    href: '/games/bingo',
    emoji: '🎯',
    title: 'Bingo des Réunions',
    desc: 'Cochez les phrases entendues en réunion et tentez de faire un Bingo avant vos collègues.',
    color: 'from-violet-500 to-purple-600',
    badge: 'Solo',
  },
  {
    href: '/games/postit-rush',
    emoji: '📝',
    title: 'Post-it Rush',
    desc: 'Des post-its apparaissent et disparaissent — cliquez dessus avant qu\'ils s\'estompent !',
    color: 'from-amber-400 to-orange-500',
    badge: '60s',
  },
  {
    href: '/games/trivia',
    emoji: '🧠',
    title: 'Trivia Agile',
    desc: 'Testez vos connaissances sur l\'agilité, Scrum et la collaboration en équipe.',
    color: 'from-teal-400 to-emerald-500',
    badge: '10 questions',
  },
]

export default function GamesPage() {
  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div className="text-center space-y-2">
        <div className="text-5xl">🎮</div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Mini-jeux</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm">
          Un coin secret pour se détendre entre deux sprints.
        </p>
      </div>

      <div className="grid gap-5 sm:grid-cols-3">
        {GAMES.map((g) => (
          <Link
            key={g.href}
            href={g.href}
            className="group relative bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 flex flex-col gap-4 hover:shadow-lg hover:border-primary-300 dark:hover:border-primary-700 transition-all"
          >
            <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${g.color} flex items-center justify-center text-2xl shadow-sm`}>
              {g.emoji}
            </div>
            <div className="flex-1 space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="font-semibold text-gray-900 dark:text-white text-sm">{g.title}</h2>
                <span className="text-[10px] font-medium bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 px-1.5 py-0.5 rounded-full">
                  {g.badge}
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">{g.desc}</p>
            </div>
            <span className="text-xs font-medium text-primary-600 dark:text-primary-400 group-hover:underline">
              Jouer →
            </span>
          </Link>
        ))}
      </div>

      <p className="text-center text-xs text-gray-400 dark:text-gray-600">
        Ces jeux sont purement locaux — aucune donnée n&apos;est envoyée au serveur.
      </p>
    </div>
  )
}
