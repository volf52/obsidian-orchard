import { createEventBus, createMemoryAdapter, NoteService } from "@orchard/core"

export interface MemoryNoteEnv {
  noteService: NoteService
  events: ReturnType<typeof createEventBus>
}

/**
 * Convenience factory for ephemeral/testing scenarios.
 */
export function createInMemoryNoteEnv(): MemoryNoteEnv {
  const events = createEventBus()
  const adapter = createMemoryAdapter()
  const noteService = new NoteService({ adapter, events })
  return { noteService, events }
}
