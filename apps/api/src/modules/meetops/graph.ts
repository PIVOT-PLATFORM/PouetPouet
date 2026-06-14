// MeetOps — connecteur Microsoft Graph (OAuth2 délégué).
// Crée des événements Outlook avec réunion Teams (isOnlineMeeting + teamsForBusiness).
// Tout est gardé par `isGraphConfigured` : sans variables d'env, le module se
// comporte comme « non configuré » (aucun crash, le reste de MeetOps fonctionne).

const CLIENT_ID = process.env.MS_GRAPH_CLIENT_ID
const CLIENT_SECRET = process.env.MS_GRAPH_CLIENT_SECRET
const TENANT_ID = process.env.MS_GRAPH_TENANT_ID
const REDIRECT_URI = process.env.MS_GRAPH_REDIRECT_URI ?? 'http://localhost:4000/api/meetops/graph/callback'

// offline_access → refresh token ; les 2 scopes métier = calendrier + lien Teams.
const SCOPES = 'offline_access openid profile User.Read Calendars.ReadWrite OnlineMeetings.ReadWrite'

export const isGraphConfigured = Boolean(CLIENT_ID && CLIENT_SECRET && TENANT_ID)

const authority = () => `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0`
const GRAPH = 'https://graph.microsoft.com/v1.0'

export interface TokenSet {
  accessToken: string
  refreshToken: string
  expiresAt: Date
  scope?: string
}

export interface GraphMeetingInput {
  subject: string
  startAt: Date
  durationMin: number
  agenda?: string | null
  location?: string | null
  attendees: { email: string; name?: string | null }[]
}

// Graph attend un dateTime sans suffixe 'Z', accompagné d'un timeZone explicite.
function graphDate(d: Date): string {
  return d.toISOString().slice(0, 19)
}

/** URL de consentement Microsoft vers laquelle rediriger l'utilisateur. */
export function buildAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: CLIENT_ID!,
    response_type: 'code',
    redirect_uri: REDIRECT_URI,
    response_mode: 'query',
    scope: SCOPES,
    state,
  })
  return `${authority()}/authorize?${params.toString()}`
}

async function tokenRequest(body: Record<string, string>): Promise<TokenSet> {
  const res = await fetch(`${authority()}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID!,
      client_secret: CLIENT_SECRET!,
      redirect_uri: REDIRECT_URI,
      ...body,
    }).toString(),
  })
  const data = (await res.json()) as {
    access_token?: string; refresh_token?: string; expires_in?: number; scope?: string
    error?: string; error_description?: string
  }
  if (!res.ok || !data.access_token) {
    throw new Error(`OAuth Microsoft: ${data.error_description ?? data.error ?? res.statusText}`)
  }
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? body.refresh_token ?? '',
    expiresAt: new Date(Date.now() + (data.expires_in ?? 3600) * 1000),
    scope: data.scope,
  }
}

/** Échange le code d'autorisation contre un jeu de tokens. */
export function exchangeCodeForTokens(code: string): Promise<TokenSet> {
  return tokenRequest({ grant_type: 'authorization_code', code, scope: SCOPES })
}

/** Rafraîchit l'access token à partir du refresh token. */
export function refreshTokens(refreshToken: string): Promise<TokenSet> {
  return tokenRequest({ grant_type: 'refresh_token', refresh_token: refreshToken, scope: SCOPES })
}

async function graphFetch(accessToken: string, path: string, init?: RequestInit) {
  const res = await fetch(`${GRAPH}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json', ...init?.headers },
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Graph ${init?.method ?? 'GET'} ${path} → ${res.status} ${text.slice(0, 300)}`)
  }
  return res.status === 204 ? null : res.json()
}

/** Profil du compte connecté (id + email). */
export async function fetchMe(accessToken: string): Promise<{ id: string; email: string | null }> {
  const me = (await graphFetch(accessToken, '/me')) as { id: string; mail?: string; userPrincipalName?: string }
  return { id: me.id, email: me.mail ?? me.userPrincipalName ?? null }
}

function eventBody(m: GraphMeetingInput) {
  const end = new Date(m.startAt.getTime() + m.durationMin * 60_000)
  return {
    subject: m.subject,
    body: { contentType: 'HTML', content: m.agenda ?? '' },
    start: { dateTime: graphDate(m.startAt), timeZone: 'UTC' },
    end: { dateTime: graphDate(end), timeZone: 'UTC' },
    location: m.location ? { displayName: m.location } : undefined,
    attendees: m.attendees.map((a) => ({
      emailAddress: { address: a.email, name: a.name ?? undefined },
      type: 'required',
    })),
    isOnlineMeeting: true,
    onlineMeetingProvider: 'teamsForBusiness',
  }
}

/** Crée l'événement Outlook + réunion Teams. Renvoie l'id Graph et le lien Teams. */
export async function createTeamsEvent(accessToken: string, m: GraphMeetingInput): Promise<{ id: string; joinUrl: string | null }> {
  const ev = (await graphFetch(accessToken, '/me/events', {
    method: 'POST',
    body: JSON.stringify(eventBody(m)),
  })) as { id: string; onlineMeeting?: { joinUrl?: string } }
  return { id: ev.id, joinUrl: ev.onlineMeeting?.joinUrl ?? null }
}

/** Met à jour un événement existant. */
export async function updateTeamsEvent(accessToken: string, externalId: string, m: GraphMeetingInput): Promise<{ joinUrl: string | null }> {
  const ev = (await graphFetch(accessToken, `/me/events/${externalId}`, {
    method: 'PATCH',
    body: JSON.stringify(eventBody(m)),
  })) as { onlineMeeting?: { joinUrl?: string } }
  return { joinUrl: ev.onlineMeeting?.joinUrl ?? null }
}

/** Annule (supprime) un événement — Graph notifie les participants. */
export async function cancelEvent(accessToken: string, externalId: string): Promise<void> {
  await graphFetch(accessToken, `/me/events/${externalId}`, { method: 'DELETE' })
}
