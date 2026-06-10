import * as Sentry from '@sentry/node'

// No-op sans SENTRY_DSN : en dev local rien n'est envoyé, en prod il suffit
// d'ajouter la variable d'env pour activer le tracking.
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV ?? 'development',
    tracesSampleRate: 0.1,
  })
}

export { Sentry }
