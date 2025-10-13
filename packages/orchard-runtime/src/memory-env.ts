import { createEventBus, createMemoryAdapter, NoteService } from "@orchard/core"

export interface MemoryNoteEnv {
  noteService: NoteService
  events: ReturnType<typeof createEventBus>
}

/**
 * Creates an in-memory note environment preconfigured for ephemeral or testing use.
 *
 * @returns An object containing `noteService` wired to an in-memory adapter and `events` event bus.
 */
export function createInMemoryNoteEnv(): MemoryNoteEnv {
  const events = createEventBus()
  const adapter = createMemoryAdapter()
  const noteService = new NoteService({ adapter, events })
  return { noteService, events }
}