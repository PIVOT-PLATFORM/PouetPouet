import type { ReactNode } from 'react'
import Link from 'next/link'
import { PIVOT_MODULES } from '@pouetpouet/shared'
import { DOMAINS } from '@/lib/hub-domains'
import { MODULE_ICONS } from '@/lib/module-icons'
import { Logo } from '@/components/ui/logo'
import { Radio, ShieldCheck, Share2, CheckCircle2, Loader2, Sparkles, ArrowRight } from 'lucide-react'

export interface Slide {
  id: string
  render: () => ReactNode
}

// ── Cadre commun d'une slide : kicker + titre + contenu centré ────────────────
function SlideShell({ kicker, title, accent = '#7c5cff', children }: { kicker?: string; title?: string; accent?: string; children?: ReactNode }) {
  return (
    <div className="w-full max-w-5xl mx-auto px-6 text-center">
      {kicker && <div className="text-[11px] font-semibold uppercase tracking-[0.35em]" style={{ color: accent }}>{kicker}</div>}
      {title && <h2 className="mt-4 text-4xl sm:text-5xl font-bold text-white tracking-tight leading-tight">{title}</h2>}
      {children && <div className="mt-10">{children}</div>}
    </div>
  )
}

const card = 'rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-sm'

export const PIVOT_SLIDES: Slide[] = [
  // 1 — Titre
  {
    id: 'title',
    render: () => (
      <div className="text-center px-6">
        <div className="flex justify-center mb-8"><Logo size={80} showText={false} /></div>
        <h1 className="text-6xl sm:text-7xl font-extrabold tracking-tight bg-gradient-to-r from-white via-[#a78bff] to-[#4ee1ff] bg-clip-text text-transparent">PIVOT</h1>
        <p className="mt-4 text-sm font-semibold uppercase tracking-[0.4em] text-gray-400">Digital Operating System</p>
        <p className="mt-8 text-lg sm:text-xl text-gray-300 max-w-xl mx-auto leading-relaxed">
          Une suite collaborative <span className="text-[#a78bff] font-semibold">data-centric</span>, auto-hébergée — vos outils d'équipe réunis sur un socle commun.
        </p>
      </div>
    ),
  },
  // 2 — Vision
  {
    id: 'vision',
    render: () => (
      <SlideShell kicker="La vision" title="Un graphe de données partagé" accent="#4ee1ff">
        <p className="text-xl text-gray-300 max-w-2xl mx-auto leading-relaxed">
          Pivot n'est pas une collection d'apps isolées : c'est <span className="text-white font-semibold">un graphe de données partagé dont les applications sont des vues</span>, communiquant via un bus d'événements et des objets pivots.
        </p>
        <div className="mt-12 flex items-center justify-center gap-3 sm:gap-5">
          {['Whiteboard', 'Scrum', 'Daily', 'Roadmap', 'Parcours'].map((v, i) => (
            <div key={v} className={`${card} px-4 py-3 text-sm text-gray-300`} style={{ opacity: 1 - i * 0.12 }}>{v}</div>
          ))}
        </div>
        <p className="mt-6 text-xs uppercase tracking-widest text-gray-500">↑ des vues · ↓ une même réalité</p>
        <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-[#7c5cff]/40 bg-[#7c5cff]/10 px-5 py-2 text-sm font-semibold text-[#a78bff]">
          <Share2 className="w-4 h-4" /> Graphe de données Pivot
        </div>
      </SlideShell>
    ),
  },
  // 3 — Architecture en 3 briques
  {
    id: 'architecture',
    render: () => (
      <SlideShell kicker="Architecture" title="Trois briques fondatrices">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 text-left">
          {[
            { Icon: Radio, color: '#7c5cff', t: 'Bus + registre déclaratif', d: 'Chaque module émet/écoute des événements sans couplage. Un registre monte routes et sockets par manifeste — des proto-plugins.' },
            { Icon: ShieldCheck, color: '#4ee1ff', t: 'Permissions polymorphes', d: 'Un seul modèle RBAC (ModuleShare) pour tous les modules : Propriétaire, Éditeur, Lecteur — partage par email.' },
            { Icon: Share2, color: '#22c55e', t: 'Objets pivots partagés', d: 'Les modules référencent des entités communes (User, Team) en lecture — jamais de mutation croisée. Une seule source de vérité.' },
          ].map(({ Icon, color, t, d }) => (
            <div key={t} className={`${card} p-6`}>
              <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4" style={{ background: `${color}22`, color }}><Icon className="w-6 h-6" /></div>
              <h3 className="text-lg font-semibold text-white">{t}</h3>
              <p className="mt-2 text-sm text-gray-400 leading-relaxed">{d}</p>
            </div>
          ))}
        </div>
      </SlideShell>
    ),
  },
  // 4 — Domaines
  {
    id: 'domains',
    render: () => (
      <SlideShell kicker="Cartographie" title="Sept domaines, une plateforme" accent="#4ee1ff">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-left">
          {DOMAINS.map((dm) => (
            <div key={dm.id} className={`${card} p-5`}>
              <div className="flex items-center gap-2.5">
                <span className="w-3 h-3 rounded-full shrink-0" style={{ background: dm.color }} />
                <h3 className="font-semibold text-white">{dm.label}</h3>
              </div>
              <p className="mt-2 text-xs text-gray-400 leading-relaxed">{dm.description}</p>
              <div className="mt-3 flex gap-2 text-[11px] font-medium">
                {dm.moduleIds.length > 0 && <span className="rounded-full bg-white/10 text-gray-200 px-2 py-0.5">{dm.moduleIds.length} actif{dm.moduleIds.length > 1 ? 's' : ''}</span>}
                {dm.upcoming.length > 0 && <span className="rounded-full border border-white/10 text-gray-400 px-2 py-0.5">{dm.upcoming.length} à venir</span>}
              </div>
            </div>
          ))}
        </div>
      </SlideShell>
    ),
  },
  // 5 — Modules
  {
    id: 'modules',
    render: () => {
      const mods = PIVOT_MODULES
      return (
        <SlideShell kicker="Les outils" title={`${mods.length} modules, prêts à l'emploi`}>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {mods.map((m) => {
              const Icon = MODULE_ICONS[m.id]
              return (
                <div key={m.id} className={`${card} px-3 py-4 flex flex-col items-center gap-2 text-center`}>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${m.color}22`, color: m.color }}>
                    {Icon ? <Icon className="w-5 h-5" /> : <span className="text-lg">{m.icon}</span>}
                  </div>
                  <span className="text-xs font-medium text-gray-200 leading-tight">{m.name}</span>
                </div>
              )
            })}
          </div>
        </SlideShell>
      )
    },
  },
  // 6 — Roadmap
  {
    id: 'roadmap',
    render: () => (
      <SlideShell kicker="Horizon" title="Une trajectoire claire">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 text-left">
          {[
            { Icon: CheckCircle2, color: '#22c55e', t: 'Livré', items: ['Formulaires (v0.27)', 'SignDoc — signature', 'PDF Manager, Roadmap', 'Quiz, Parcours, Feedback'] },
            { Icon: Loader2, color: '#4ee1ff', t: 'En cours', items: ['Assistant IA (Ollama)', 'Commande publique', 'Explorateur & intérêts'] },
            { Icon: Sparkles, color: '#7c5cff', t: 'À venir', items: ['OKR, PPM, Risques', 'Cartographie SI, ADR', 'RH & Compétences', 'Plugins tiers (post-v1)'] },
          ].map(({ Icon, color, t, items }) => (
            <div key={t} className={`${card} p-6`}>
              <div className="flex items-center gap-2 mb-4" style={{ color }}>
                <Icon className="w-5 h-5" /><h3 className="text-lg font-semibold text-white">{t}</h3>
              </div>
              <ul className="space-y-2 text-sm text-gray-400">
                {items.map((it) => <li key={it} className="flex items-start gap-2"><span className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0" style={{ background: color }} />{it}</li>)}
              </ul>
            </div>
          ))}
        </div>
      </SlideShell>
    ),
  },
  // 7 — Stack
  {
    id: 'stack',
    render: () => (
      <SlideShell kicker="Sous le capot" title="Une stack moderne, auto-hébergeable" accent="#4ee1ff">
        <div className="flex flex-wrap items-center justify-center gap-3 max-w-3xl mx-auto">
          {['Next.js 15', 'React 19', 'Fastify 5', 'Socket.io', 'PostgreSQL', 'Prisma 7', 'Redis', 'Docker', 'GCP Cloud Run', 'TypeScript'].map((s) => (
            <span key={s} className={`${card} px-4 py-2.5 text-sm font-medium text-gray-200`}>{s}</span>
          ))}
        </div>
        <p className="mt-10 text-gray-400 max-w-xl mx-auto">Temps réel de bout en bout, déployable chez vous — vos données restent chez vous.</p>
      </SlideShell>
    ),
  },
  // 8 — Clôture
  {
    id: 'closing',
    render: () => (
      <div className="text-center px-6">
        <div className="flex justify-center mb-6"><Logo size={56} showText={false} /></div>
        <h2 className="text-4xl sm:text-5xl font-bold text-white tracking-tight">Explorez Pivot.</h2>
        <p className="mt-4 text-lg text-gray-300 max-w-lg mx-auto">Découvrez les domaines et dites-nous quels outils vous voulez ensuite.</p>
        <Link href="/explorer" className="group mt-10 inline-flex items-center gap-2 rounded-xl bg-[#7c5cff] hover:bg-[#6a44f5] px-6 py-3 text-white font-semibold transition-colors">
          Ouvrir l'Explorateur <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
        </Link>
      </div>
    ),
  },
]
