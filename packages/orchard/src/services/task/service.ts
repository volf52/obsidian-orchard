import {
  InlineTaskService,
  type NoteService,
  TaskNoteService,
} from "@orchard/core"

import type { TaskSchema } from "./schema"

export class TaskService {
  readonly noteService: NoteService
  readonly taskNotes: TaskNoteService
  readonly inlineTasks: InlineTaskService
  readonly schema: TaskSchema

  constructor(noteService: NoteService, schema: TaskSchema) {
    this.noteService = noteService
    this.taskNotes = new TaskNoteService(noteService)
    this.inlineTasks = new InlineTaskService(noteService)
    this.schema = schema
  }
}
