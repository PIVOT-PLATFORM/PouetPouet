/* eslint-disable no-console */
// Test de charge Socket.io — N clients simultanés sur un même board.
// Mesure : connexions, temps board:join → board:state, RTT card:create → card:created,
// débit de messages curseur reçus.
//
//   npx tsx scripts/load-test.ts                          # 100 users, 30 s, local
//   USERS=50 DURATION=15 URL=http://... npx tsx scripts/load-test.ts
//
// Tous les clients utilisent le même compte (rôle OWNER) : on mesure la tenue
// du transport et des broadcasts, pas la logique de partage.
import { io as ioClient, type Socket } from 'socket.io-client'

const URL = process.env.URL ?? 'http://localhost:4000'
const USERS = Number(process.env.USERS ?? 100)
const DURATION_S = Number(process.env.DURATION ?? 30)
const CURSOR_HZ = Number(process.env.CURSOR_HZ ?? 5)
const CARD_EVERY_S = Number(process.env.CARD_EVERY_S ?? 10)

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)
  return sorted[Math.max(0, idx)]
}

async function api<T>(path: string, body: unknown, token?: string): Promise<T> {
  const res = await fetch(`${URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`${path} → ${res.status}: ${await res.text()}`)
  return res.json() as Promise<T>
}

async function main() {
  console.log(`Load test → ${URL} | ${USERS} clients | ${DURATION_S}s | curseurs ${CURSOR_HZ} Hz | 1 carte/client/${CARD_EVERY_S}s`)

  // ── Setup : compte + board ──────────────────────────────────────────────────
  const email = `loadtest-${Date.now()}@test.local`
  const password = 'LoadTest-123!'
  const reg = await api<{ token: string }>('/api/auth/register', { email, name: 'Load Test', password, bypass: true })
  const token = reg.token
  const board = await api<{ id: string }>('/api/boards', { name: `Load test ${new Date().toISOString()}` }, token)
  console.log(`Board ${board.id} créé.`)

  // ── Métriques ───────────────────────────────────────────────────────────────
  const connectTimes: number[] = []
  const stateTimes: number[] = []
  const cardRtts: number[] = []
  let connectErrors = 0
  let boardErrors = 0
  let cursorReceived = 0
  let cardCreatedReceived = 0
  const pendingCards = new Map<string, number>() // tag → emit timestamp

  // ── Connexion des clients ───────────────────────────────────────────────────
  const sockets: Socket[] = []
  const connectStart = Date.now()
  await Promise.all(
    Array.from({ length: USERS }, (_, i) =>
      new Promise<void>((resolve) => {
        const t0 = Date.now()
        const s = ioClient(URL, { auth: { token }, transports: ['websocket'], reconnection: false, timeout: 10_000 })
        sockets.push(s)
        s.on('connect', () => {
          connectTimes.push(Date.now() - t0)
          const tJoin = Date.now()
          s.emit('board:join', board.id)
          s.once('board:state', () => {
            stateTimes.push(Date.now() - tJoin)
            resolve()
          })
        })
        s.on('board:error', (msg: string) => { boardErrors++; console.error(`client ${i}: board:error ${msg}`); resolve() })
        s.on('connect_error', (err) => { connectErrors++; console.error(`client ${i}: ${err.message}`); resolve() })
        s.on('board:cursor', () => { cursorReceived++ })
        s.on('card:created', (card: { content: string }) => {
          cardCreatedReceived++
          const t = pendingCards.get(card.content)
          if (t !== undefined) {
            cardRtts.push(Date.now() - t)
            pendingCards.delete(card.content)
          }
        })
      }),
    ),
  )
  const connected = sockets.filter((s) => s.connected).length
  console.log(`${connected}/${USERS} clients connectés et joints en ${Date.now() - connectStart} ms (${connectErrors} échecs, ${boardErrors} refus board)`)

  // ── Charge ──────────────────────────────────────────────────────────────────
  const timers: ReturnType<typeof setInterval>[] = []
  sockets.forEach((s, i) => {
    if (!s.connected) return
    timers.push(setInterval(() => {
      s.emit('board:cursor', { boardId: board.id, x: Math.random() * 2000, y: Math.random() * 2000 })
    }, 1000 / CURSOR_HZ))
    timers.push(setInterval(() => {
      const tag = `lt-${i}-${Date.now()}`
      pendingCards.set(tag, Date.now())
      s.emit('card:create', { boardId: board.id, content: tag, posX: Math.random() * 2000, posY: Math.random() * 2000 })
    }, CARD_EVERY_S * 1000 + i * 7)) // léger déphasage pour éviter les rafales synchrones
  })

  await new Promise((r) => setTimeout(r, DURATION_S * 1000))
  timers.forEach(clearInterval)
  await new Promise((r) => setTimeout(r, 2000)) // laisser arriver les derniers broadcasts

  // ── Rapport ─────────────────────────────────────────────────────────────────
  const sc = [...connectTimes].sort((a, b) => a - b)
  const ss = [...stateTimes].sort((a, b) => a - b)
  const sr = [...cardRtts].sort((a, b) => a - b)
  console.log('\n— Rapport —')
  console.log(`Connexion           p50 ${percentile(sc, 50)} ms · p95 ${percentile(sc, 95)} ms · p99 ${percentile(sc, 99)} ms`)
  console.log(`board:join→state    p50 ${percentile(ss, 50)} ms · p95 ${percentile(ss, 95)} ms · p99 ${percentile(ss, 99)} ms`)
  console.log(`card:create RTT     p50 ${percentile(sr, 50)} ms · p95 ${percentile(sr, 95)} ms · p99 ${percentile(sr, 99)} ms (${cardRtts.length} mesures, ${pendingCards.size} perdues)`)
  console.log(`Curseurs reçus      ${cursorReceived} (${Math.round(cursorReceived / DURATION_S)}/s) — attendu ≈ ${connected} × ${CURSOR_HZ} Hz × ${connected - 1} pairs`)
  console.log(`card:created reçus  ${cardCreatedReceived}`)

  // ── Cleanup ─────────────────────────────────────────────────────────────────
  sockets.forEach((s) => s.disconnect())
  await api('/api/auth/delete-account', { password }, token)
  console.log('Compte et board de test supprimés.')

  const failed = connectErrors > 0 || boardErrors > 0 || pendingCards.size > cardRtts.length * 0.05
  process.exit(failed ? 1 : 0)
}

main().catch((err) => { console.error(err); process.exit(1) })
