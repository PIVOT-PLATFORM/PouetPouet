import type { FastifyPluginAsync } from 'fastify'
import crypto from 'node:crypto'
import * as oidc from 'openid-client'
import { prisma } from '../lib/prisma.js'
import { audit } from '../lib/audit.js'

// Identité fédérée (FORGE F5.1) — relying party OIDC générique (Keycloak,
// Google Workspace, Azure AD…). Entièrement env-gated : sans OIDC_ISSUER,
// les routes répondent 404 et le bouton SSO n'apparaît pas côté web.
//
// Env : OIDC_ISSUER (URL du realm/issuer), OIDC_CLIENT_ID, OIDC_CLIENT_SECRET,
//       OIDC_PROVIDER_NAME (libellé du bouton, défaut "SSO"),
//       OIDC_REDIRECT_URI (défaut http://localhost:4000/api/auth/oidc/callback)

const ISSUER = process.env.OIDC_ISSUER
const CLIENT_ID = process.env.OIDC_CLIENT_ID
const CLIENT_SECRET = process.env.OIDC_CLIENT_SECRET
const PROVIDER_NAME = process.env.OIDC_PROVIDER_NAME ?? 'SSO'
const REDIRECT_URI = process.env.OIDC_REDIRECT_URI ?? 'http://localhost:4000/api/auth/oidc/callback'
const FRONTEND_URL = process.env.FRONTEND_URL ?? 'http://localhost:3000'

const enabled = Boolean(ISSUER && CLIENT_ID)

// Découverte paresseuse et mise en cache : l'IdP peut démarrer après l'API.
let configPromise: Promise<oidc.Configuration> | null = null
function getConfig(): Promise<oidc.Configuration> {
  if (!configPromise) {
    const issuerUrl = new URL(ISSUER!)
    configPromise = oidc
      .discovery(
        issuerUrl,
        CLIENT_ID!,
        CLIENT_SECRET,
        undefined,
        // HTTP toléré uniquement pour un IdP local (Keycloak dev)
        issuerUrl.protocol === 'http:' ? { execute: [oidc.allowInsecureRequests] } : undefined,
      )
      .catch((err) => {
        configPromise = null // retenter à la prochaine requête
        throw err
      })
  }
  return configPromise
}

const TX_COOKIE = 'oidc_tx'

export const oidcRoutes: FastifyPluginAsync = async (app) => {
  // Le front interroge ce flag pour afficher (ou non) le bouton SSO.
  app.get('/enabled', async () => ({ enabled, provider: PROVIDER_NAME }))

  if (!enabled) return

  app.get('/login', async (_request, reply) => {
    const config = await getConfig()
    const codeVerifier = oidc.randomPKCECodeVerifier()
    const codeChallenge = await oidc.calculatePKCECodeChallenge(codeVerifier)
    const state = oidc.randomState()

    reply.setCookie(TX_COOKIE, JSON.stringify({ state, codeVerifier }), {
      httpOnly: true,
      sameSite: 'lax',
      secure: REDIRECT_URI.startsWith('https'),
      path: '/api/auth/oidc',
      maxAge: 600,
    })

    const url = oidc.buildAuthorizationUrl(config, {
      redirect_uri: REDIRECT_URI,
      scope: 'openid email profile',
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    })
    return reply.redirect(url.href)
  })

  app.get('/callback', async (request, reply) => {
    const raw = request.cookies[TX_COOKIE]
    reply.clearCookie(TX_COOKIE, { path: '/api/auth/oidc' })
    if (!raw) return reply.redirect(`${FRONTEND_URL}/login?error=sso`)

    try {
      const { state, codeVerifier } = JSON.parse(raw) as { state: string; codeVerifier: string }
      const config = await getConfig()
      // openid-client revérifie state + PKCE à partir de l'URL complète du callback
      const currentUrl = new URL(request.url, REDIRECT_URI)
      const tokens = await oidc.authorizationCodeGrant(config, currentUrl, {
        pkceCodeVerifier: codeVerifier,
        expectedState: state,
      })
      const claims = tokens.claims()
      if (!claims?.sub) return reply.redirect(`${FRONTEND_URL}/login?error=sso`)

      const email = typeof claims.email === 'string' ? claims.email : null
      const name = typeof claims.name === 'string' && claims.name.trim()
        ? claims.name
        : (email ?? `Utilisateur ${String(claims.sub).slice(0, 8)}`)

      const user = await findOrCreateUser(ISSUER!, String(claims.sub), email, name)
      audit(user.id, 'auth.login_sso', request, PROVIDER_NAME)

      const token = app.jwt.sign({ id: user.id, email: user.email })
      return reply.redirect(`${FRONTEND_URL}/sso#token=${encodeURIComponent(token)}`)
    } catch (err) {
      request.log.warn({ err: (err as Error).message }, 'oidc callback failed')
      return reply.redirect(`${FRONTEND_URL}/login?error=sso`)
    }
  })
}

// 1. Compte fédéré connu → utilisateur lié.
// 2. Email déjà inscrit localement → liaison du compte fédéré (l'IdP fait foi).
// 3. Sinon création d'un compte vérifié (mot de passe aléatoire, inutilisable).
export async function findOrCreateUser(provider: string, subject: string, email: string | null, name: string) {
  const existing = await prisma.oAuthAccount.findUnique({
    where: { provider_subject: { provider, subject } },
    include: { user: true },
  })
  if (existing) return existing.user

  if (email) {
    const byEmail = await prisma.user.findUnique({ where: { email } })
    if (byEmail) {
      await prisma.oAuthAccount.create({ data: { userId: byEmail.id, provider, subject, email } })
      return byEmail
    }
  }

  return prisma.user.create({
    data: {
      email: email ?? `${subject}@${new URL(provider).hostname}`,
      name,
      password: crypto.randomBytes(32).toString('hex'), // jamais un hash bcrypt valide → login local impossible
      emailVerified: true,
      oauthAccounts: { create: { provider, subject, email } },
    },
  })
}
