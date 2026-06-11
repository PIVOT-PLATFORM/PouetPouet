import * as Sentry from '@sentry/node'

// No-op sans SENTRY_DSN : en dev local rien n'est envoyé, en prod il suffit
// d'ajouter la variable d'env pour activer le tracking.
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV ?? 'development',
    tracesSampleRate: 0.1,
    // Les erreurs HTTP 4xx (JWT expiré, 401, validation…) sont des réponses
    // normales au client, pas des bugs serveur — on ne les envoie pas à Sentry.
    beforeSend(event, hint) {
      const err = hint?.originalException as { statusCode?: number } | undefined
      if (err && typeof err.statusCode === 'number' && err.statusCode < 500) return null
      return event
    },
  })
}

export { Sentry }
