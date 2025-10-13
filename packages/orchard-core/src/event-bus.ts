import type { EventBus, NoteEvent } from "./types"

/**
 * Create an EventBus for NoteEvent handlers allowing registration and event delivery.
 *
 * @returns An EventBus with two methods:
 * - `publish(event)`: invokes every registered handler with `event`; exceptions thrown by a handler are swallowed and do not stop delivery to other handlers.
 * - `subscribe(handler)`: registers `handler` (adding the same function multiple times has no extra effect) and returns an unsubscribe function that removes the handler.
 */
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