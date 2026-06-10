import * as Sentry from '@sentry/nextjs'

// Capture les erreurs navigateur. No-op sans NEXT_PUBLIC_SENTRY_DSN.
if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    environment: process.env.NODE_ENV,
    tracesSampleRate: 0.1,
  })
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
