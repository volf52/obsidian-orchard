import type { NoteService } from "./note-service"
import type {
  CreateNoteInput,
  Note,
  NoteFilters,
  NoteId,
  NoteVersion,
  UpdateNoteMutation,
} from "./types"
import {
  formatInlineTaskLine,
  parseInlineTasks,
  TASK_NOTE_TYPE,
  type TaskSyncState,
  type TaskFrontmatter,
  type TaskFrontmatterInit,
  type TaskCheckbox,
  type InlineTaskExtraFields,
  type InlineTask,
  type InlineTaskFormatInput,
} from "./inline-task"
import {
  _statusToCheckbox,
  appendLine,
  checkboxToStatus,
  collapseWhitespace,
  createInlineTaskBlockId,
  normalizeExtraFields,
  normalizeTaskFrontmatter,
  removeLine,
  replaceLine,
  serializeTaskFrontmatter,
  toLineSet,
  validateTaskFrontmatter,
  type LineSet,
} from "./task-utils"

export const TASK_NOTE_MINIMAL_BODY = ""

// Re-export types for backward compatibility
export type {
  TaskSyncState,
  TaskFrontmatter,
  TaskFrontmatterInit,
  TaskCheckbox,
  InlineTaskExtraFields,
  InlineTask,
  InlineTaskFormatInput,
}
export { TASK_NOTE_TYPE }

export interface TaskNote extends Omit<Note, "frontmatter"> {
  frontmatter: TaskFrontmatter
}

// TaskFrontmatterInit is now imported from ./inline-task

export interface CreateTaskNoteInput {
  id: NoteId
  title: string
  status: string
  project?: string | null
  due?: string | Date | number | null
  priority?: string | null
  mcpSyncState?: TaskSyncState | null
  tags?: string[]
}

export interface UpdateTaskNoteInput {
  title?: string
  status?: string
  project?: string | null
  due?: string | Date | number | null
  priority?: string | null
  mcpSyncState?: TaskSyncState | null
  tags?: string[]
}

// normalizeTaskFrontmatter is now imported from ./task-utils

// validateTaskFrontmatter is now imported from ./task-utils

// serializeTaskFrontmatter is now imported from ./task-utils

/**
 * Determines whether a given note is a task note.
 *
 * Validates the note's frontmatter and confirms its `type` equals `TASK_NOTE_TYPE`.
 *
 * @param note - The note to check
 * @returns `true` if the provided note is a task note (frontmatter.type === TASK_NOTE_TYPE), `false` otherwise.
 */
export function isTaskNote(note: Note | null | undefined): note is TaskNote {
  if (!note) return false
  try {
    const frontmatter = validateTaskFrontmatter(note.frontmatter)
    return frontmatter.type === TASK_NOTE_TYPE
  } catch {
    return false
  }
}

/**
 * Convert a Note into a TaskNote by validating and normalizing its frontmatter.
 *
 * @returns The original note with its `frontmatter` replaced by a normalized `TaskFrontmatter`.
 */
export function toTaskNote(note: Note): TaskNote {
  const frontmatter = validateTaskFrontmatter(note.frontmatter)
  return {
    ...note,
    frontmatter,
  }
}

export class TaskNoteService {
  private notes: NoteService

  constructor(notes: NoteService) {
    this.notes = notes
  }

  async list(filters?: NoteFilters): Promise<TaskNote[]> {
    const notes = await this.notes.list(filters)
    const tasks: TaskNote[] = []
    for (const note of notes) {
      if (!note?.frontmatter) continue
      try {
        tasks.push(toTaskNote(note))
      } catch {
        // ignore non-task notes
      }
    }
    return tasks
  }

  async read(id: NoteId): Promise<TaskNote | null> {
    const note = await this.notes.read(id)
    if (!note) return null
    if (!isTaskNote(note)) return null
    return toTaskNote(note)
  }

  async create(input: CreateTaskNoteInput): Promise<TaskNote> {
    const { frontmatter, body } = serializeTaskFrontmatter({
      status: input.status,
      project: input.project,
      due: input.due,
      priority: input.priority,
      mcpSyncState: input.mcpSyncState,
    })
    const note = await this.notes.create({
      id: input.id,
      title: input.title,
      tags: input.tags,
      frontmatter,
      body,
    })
    return toTaskNote(note)
  }

  async update(
    id: NoteId,
    mutation: UpdateTaskNoteInput,
    expectedVersion: NoteVersion,
  ): Promise<TaskNote> {
    const current = await this.read(id)
    if (!current) throw new Error(`Task note not found: ${id}`)
    const frontmatter = normalizeTaskFrontmatter({
      status: mutation.status ?? current.frontmatter.status,
      project:
        mutation.project !== undefined
          ? mutation.project
          : current.frontmatter.project,
      due: mutation.due !== undefined ? mutation.due : current.frontmatter.due,
      priority:
        mutation.priority !== undefined
          ? mutation.priority
          : current.frontmatter.priority,
      mcpSyncState:
        mutation.mcpSyncState !== undefined
          ? mutation.mcpSyncState
          : current.frontmatter.mcpSyncState,
    })

    const updatePayload: UpdateNoteMutation = {
      title: mutation.title,
      tags: mutation.tags,
      frontmatter,
      body: TASK_NOTE_MINIMAL_BODY,
    }
    const updated = await this.notes.update(id, updatePayload, expectedVersion)
    return toTaskNote(updated)
  }

  async delete(id: NoteId, expectedVersion: NoteVersion): Promise<boolean> {
    return this.notes.delete(id, expectedVersion)
  }
}

// normalizeStatus, normalizeOptionalString, normalizeDue, and toDateOnly are now in ./task-utils

// These types are now imported from ./inline-task and re-exported above

export interface CreateInlineTaskInput
  extends Omit<InlineTaskFormatInput, "frontmatter">,
    TaskFrontmatterInit {
  noteId: NoteId
}

export interface UpdateInlineTaskInput {
  text?: string
  status?: string
  project?: string | null
  due?: string | Date | number | null
  priority?: string | null
  mcpSyncState?: TaskSyncState | null
  blockId?: string | null
  extraFields?: Record<string, string | null | undefined>
}

export interface InlineTaskIdentifier {
  noteId: NoteId
  blockId?: string | null
  line?: number
}

// createInlineTaskBlockId is now imported from ./task-utils

export class InlineTaskService {
  private notes: NoteService

  private createBlockId: () => string

  constructor(notes: NoteService, options?: { createBlockId?: () => string }) {
    this.notes = notes
    this.createBlockId =
      options?.createBlockId ?? (() => createInlineTaskBlockId())
  }

  async list(noteId: NoteId): Promise<InlineTask[]> {
    const note = await this.notes.read(noteId)
    if (!note) return []
    return parseInlineTasks(note)
  }

  async create(input: CreateInlineTaskInput): Promise<InlineTask> {
    const note = await this.notes.read(input.noteId)
    if (!note)
      throw new Error(`Note not found for inline task: ${input.noteId}`)

    const tasks = parseInlineTasks(note)
    let blockId = input.blockId ?? null
    if (!blockId) {
      blockId = this.generateUniqueBlockId(tasks)
    } else if (tasks.some((task) => task.blockId === blockId)) {
      blockId = this.generateUniqueBlockId(tasks)
    }

    const line = formatInlineTaskLine({
      text: input.text,
      frontmatter: {
        status: input.status,
        project: input.project,
        due: input.due,
        priority: input.priority,
        mcpSyncState: input.mcpSyncState,
      },
      indent: input.indent,
      bullet: input.bullet,
      blockId,
      extraFields: input.extraFields,
    })

    const updated = await this.notes.update(
      note.id,
      { body: appendLine(note.body, line) },
      note.version,
    )

    const created = parseInlineTasks(updated).find(
      (task) => task.blockId === blockId,
    )
    if (!created) {
      throw new Error("Failed to locate created inline task")
    }
    return created
  }

  async update(
    identifier: InlineTaskIdentifier,
    mutation: UpdateInlineTaskInput,
  ): Promise<InlineTask> {
    const note = await this.notes.read(identifier.noteId)
    if (!note)
      throw new Error(`Note not found for inline task: ${identifier.noteId}`)

    const tasks = parseInlineTasks(note)
    const target = this.findTargetTask(tasks, identifier)
    if (!target) throw new Error("Inline task not found")

    const frontmatter = normalizeTaskFrontmatter({
      status: mutation.status ?? target.frontmatter.status,
      project:
        mutation.project !== undefined
          ? mutation.project
          : target.frontmatter.project,
      due: mutation.due !== undefined ? mutation.due : target.frontmatter.due,
      priority:
        mutation.priority !== undefined
          ? mutation.priority
          : target.frontmatter.priority,
      mcpSyncState:
        mutation.mcpSyncState !== undefined
          ? mutation.mcpSyncState
          : target.frontmatter.mcpSyncState,
    })

    const updatedExtra = { ...target.extraFields }
    if (mutation.extraFields) {
      for (const [key, value] of Object.entries(mutation.extraFields)) {
        if (value == null) {
          delete updatedExtra[key]
        } else {
          updatedExtra[key] = value
        }
      }
    }

    const blockId =
      mutation.blockId === undefined ? target.blockId : mutation.blockId

    const newLine = formatInlineTaskLine({
      text: mutation.text ?? target.text,
      frontmatter,
      indent: target.indent,
      bullet: target.bullet,
      blockId,
      extraFields: updatedExtra,
    })

    const updated = await this.notes.update(
      note.id,
      { body: replaceLine(note.body, target.line, newLine) },
      note.version,
    )

    const refreshed = parseInlineTasks(updated)
    const nextTarget = this.findTargetTask(refreshed, {
      noteId: updated.id,
      blockId: blockId ?? undefined,
      line: blockId ? undefined : target.line,
    })
    if (!nextTarget) throw new Error("Failed to locate updated inline task")
    return nextTarget
  }

  async delete(identifier: InlineTaskIdentifier): Promise<boolean> {
    const note = await this.notes.read(identifier.noteId)
    if (!note) return false

    const tasks = parseInlineTasks(note)
    const target = this.findTargetTask(tasks, identifier)
    if (!target) return false

    await this.notes.update(
      note.id,
      { body: removeLine(note.body, target.line) },
      note.version,
    )
    return true
  }

  private generateUniqueBlockId(existing: InlineTask[]): string {
    let candidate = this.createBlockId()
    const seen = new Set(existing.map((task) => task.blockId).filter(Boolean))
    let guard = 0
    while (seen.has(candidate) && guard < 10) {
      candidate = this.createBlockId()
      guard += 1
    }
    if (seen.has(candidate)) {
      throw new Error("Unable to generate unique inline task block id")
    }
    return candidate
  }

  private findTargetTask(
    tasks: InlineTask[],
    identifier: InlineTaskIdentifier,
  ): InlineTask | null {
    if (identifier.blockId) {
      const byId = tasks.find((task) => task.blockId === identifier.blockId)
      if (byId) return byId
    }
    if (identifier.line != null) {
      const byLine = tasks.find((task) => task.line === identifier.line)
      if (byLine) return byLine
    }
    return null
  }
}

// Re-export inline task formatting and parsing functions
export { formatInlineTaskLine, parseInlineTasks } from "./inline-task"

// Re-export task utility functions for backward compatibility
export {
  _statusToCheckbox,
  appendLine,
  checkboxToStatus,
  collapseWhitespace,
  createInlineTaskBlockId,
  normalizeExtraFields,
  normalizeTaskFrontmatter,
  removeLine,
  replaceLine,
  serializeTaskFrontmatter,
  toLineSet,
  validateTaskFrontmatter,
  type LineSet,
} from "./task-utils"
