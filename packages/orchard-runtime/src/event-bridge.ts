import type { EventBus } from "@orchard/core"

export interface BroadcastLike {
  broadcast: (event: string, params: Record<string, unknown>) => void
}

export interface BridgeOptions {
  events: EventBus
  target: BroadcastLike
}

/**
 * Subscribes to core note events and forwards minimal payloads to a broadcast target (e.g. MCP server).
 */
export function bridgeNoteEvents({ events, target }: BridgeOptions) {
  events.subscribe((evt) => {
    if (!evt || typeof evt !== "object" || !("type" in evt)) return
    switch (evt.type) {
      case "note.created":
        target.broadcast("note.created", {
          id: evt.note.id,
          version: evt.note.version,
        })
        break
      case "note.updated":
        target.broadcast("note.updated", {
          id: evt.note.id,
          version: evt.note.version,
          previousVersion: evt.previousVersion,
        })
        break
      case "note.deleted":
        target.broadcast("note.deleted", {
          id: evt.id,
          previousVersion: evt.previousVersion,
        })
        break
      default:
        break
    }
  })
}
