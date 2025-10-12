import type { EventBus, OrchardEvent } from "./types"

export function createEventBus(): EventBus {
  const handlers = new Set<(e: OrchardEvent) => void>()
  return {
    publish(event: OrchardEvent) {
      for (const h of handlers) {
        try {
          h(event)
        } catch (_err) {
          // swallow to avoid cascade; could add diagnostic hook later
        }
      }
    },
    subscribe(handler: (event: OrchardEvent) => void) {
      handlers.add(handler)
      return () => handlers.delete(handler)
    },
  }
}
