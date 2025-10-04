import type { EventBus, NoteEvent } from "./types"

export function createEventBus(): EventBus {
  const handlers = new Set<(e: NoteEvent) => void>()
  return {
    publish(event: NoteEvent) {
      for (const h of handlers) {
        try {
          h(event)
        } catch (_err) {
          // swallow to avoid cascade; could add diagnostic hook later
        }
      }
    },
    subscribe(handler: (event: NoteEvent) => void) {
      handlers.add(handler)
      return () => handlers.delete(handler)
    },
  }
}
