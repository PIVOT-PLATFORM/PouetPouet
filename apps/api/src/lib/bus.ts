import { EventEmitter } from 'node:events'
import type { ForgeEvent } from '@pouetpouet/shared'

// Bus d'événements FORGE.
// Implémentation in-process (le modular monolith tourne en instance unique) ;
// l'interface est le contrat : une implémentation Redis pub/sub pourra la
// remplacer à l'identique quand le scaling horizontal arrivera (F4).

type Handler<T> = (event: ForgeEvent<T>) => void | Promise<void>

export interface EventBus {
  publish<T>(event: Omit<ForgeEvent<T>, 'at'>): void
  /** Retourne la fonction de désabonnement. `'*'` reçoit tous les événements. */
  subscribe<T>(type: string, handler: Handler<T>): () => void
}

class InProcessBus implements EventBus {
  private emitter = new EventEmitter()

  constructor() {
    // Des dizaines d'abonnements module × type sont attendus à terme.
    this.emitter.setMaxListeners(100)
  }

  publish<T>(event: Omit<ForgeEvent<T>, 'at'>): void {
    const full: ForgeEvent<T> = { ...event, at: new Date().toISOString() }
    // Un handler qui jette ne doit jamais faire tomber le producteur.
    for (const channel of [event.type, '*']) {
      for (const listener of this.emitter.listeners(channel)) {
        try {
          void (listener as Handler<T>)(full)
        } catch (err) {
          console.error(`[bus] handler error on ${event.type}:`, err)
        }
      }
    }
  }

  subscribe<T>(type: string, handler: Handler<T>): () => void {
    this.emitter.on(type, handler as (...args: unknown[]) => void)
    return () => this.emitter.off(type, handler as (...args: unknown[]) => void)
  }
}

export const bus: EventBus = new InProcessBus()
