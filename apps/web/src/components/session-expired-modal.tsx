'use client'

export function SessionExpiredModal() {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center">
        <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-amber-50 dark:bg-amber-950 flex items-center justify-center">
          <svg className="w-6 h-6 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-1.5">Session expirée</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
          Votre session a expiré après une période d'inactivité. Rechargez la page pour vous reconnecter.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="w-full px-5 py-2.5 rounded-xl bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 transition-colors"
        >
          Recharger la page
        </button>
      </div>
    </div>
  )
}
