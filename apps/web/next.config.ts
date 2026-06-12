import type { NextConfig } from 'next'
import path from 'path'

const isDev = process.env.NODE_ENV !== 'production'

// CSP directives:
// - 'unsafe-inline' scripts: required by Next.js inline script injection (hydration, RSC)
// - 'unsafe-eval': required by Next.js dev HMR (hot module replacement) — prod only allows
//   wasm-unsafe-eval for PDF.js WebAssembly decoding
// - socket.io connects to the API origin; ws:// allowed in dev, only wss:// in prod
// - data: images: board import (base64 card content) and user avatars
// - blob: images: pdf.js renders page images as blob URLs
const FRONTEND_URL = process.env.NEXT_PUBLIC_API_URL ?? (isDev ? 'http://localhost:4000' : '')
const WS_ORIGIN = FRONTEND_URL.replace(/^http/, 'ws')

const cspDirectives = [
  `default-src 'self'`,
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : " 'wasm-unsafe-eval'"}`,
  `style-src 'self' 'unsafe-inline'`,
  `img-src 'self' data: blob:`,
  `font-src 'self'`,
  // *.sentry.io / *.ingest.de.sentry.io: error reporting (@sentry/nextjs envelope endpoint)
  `connect-src 'self' ${FRONTEND_URL} ${WS_ORIGIN} https://*.sentry.io https://*.ingest.de.sentry.io`,
  `frame-ancestors 'none'`,
  `object-src 'none'`,
  `base-uri 'self'`,
  `form-action 'self'`,
].join('; ')

const securityHeaders = [
  { key: 'Content-Security-Policy', value: cspDirectives },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  // HSTS only in prod — dev uses plain http
  ...(isDev ? [] : [{ key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' }]),
]

const nextConfig: NextConfig = {
  output: 'standalone',
  outputFileTracingRoot: path.join(__dirname, '../../'),
  transpilePackages: ['@pouetpouet/shared'],
  webpack: (config) => {
    // pdfjs-dist optionally requires 'canvas' for Node.js — not needed in browser
    config.resolve.alias.canvas = false
    // @pouetpouet/shared uses ESM '.js' specifiers on .ts sources (required by
    // tsx/Node on the API side) — map them back for webpack.
    config.resolve.extensionAlias = { '.js': ['.ts', '.js'] }
    return config
  },
  async headers() {
    return [{ source: '/(.*)', headers: securityHeaders }]
  },
}

export default nextConfig
