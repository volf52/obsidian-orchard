import {
  InlineTaskService,
  type Note,
  type NoteId,
  type NoteService,
  type NoteVersion,
  serializeTaskFrontmatter,
  TaskNoteService,
  toTaskNote,
  type TaskFrontmatter,
  type TaskNote,
} from "@orchard/core"
import type { Vault } from "obsidian"

import {
  ensureDirectory,
  ensureTaskBaseDefinition,
  generateTaskNoteId,
} from "@/utils/task-files"

import type { TaskSchema } from "./schema"

export interface TaskCreateInput {
  title: string
  frontmatter: TaskFrontmatter
  body?: string
  tags?: string[]
}

export interface TaskUpdateInput {
  frontmatter: TaskFrontmatter
  body?: string
  title?: string
  tags?: string[]
}

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

  async refreshBaseDefinition(vault: Vault): Promise<void> {
    await ensureTaskBaseDefinition(vault, this.schema.baseFile)
  }

  async createTask(
    vault: Vault,
    input: TaskCreateInput,
    date = new Date(),
  ): Promise<TaskNote> {
    const id = generateTaskNoteId(input.title, date, this.schema.folder)
    await ensureDirectory(vault, toDirname(id))

    const frontmatter = mergeFrontmatter(input.frontmatter)
    const note = await this.noteService.create({
      id,
      title: input.title,
      tags: input.tags,
      frontmatter,
      body: formatBody(input.body),
    })

    await this.refreshBaseDefinition(vault)
    return toTaskNote(note)
  }

  async updateTask(
    vault: Vault,
    id: NoteId,
    expectedVersion: NoteVersion,
    input: TaskUpdateInput,
  ): Promise<TaskNote> {
    const current = await this.noteService.read(id)
    if (!current) {
      throw new Error(`Task note not found: ${id}`)
    }

    const nextFrontmatter = mergeFrontmatter(input.frontmatter, current)
    const body =
      input.body !== undefined ? formatBody(input.body) : (current.body ?? "")

    const updated = await this.noteService.update(
      id,
      {
        frontmatter: nextFrontmatter,
        body,
        title: input.title,
        tags: input.tags,
      },
      expectedVersion,
    )

    await this.refreshBaseDefinition(vault)
    return toTaskNote(updated)
  }

  async loadTask(id: NoteId): Promise<TaskNote | null> {
    return this.taskNotes.read(id)
  }
}

/**
 * Normalize a note body by removing trailing whitespace and ensuring a single trailing newline when non-empty.
 *
 * @param body - The raw body text, or `undefined` for an empty body
 * @returns An empty string if `body` is empty or undefined; otherwise `body` with trailing whitespace removed and exactly one newline appended
 */
function formatBody(body: string | undefined): string {
  if (!body) return ""
  const trimmed = body.replace(/\s+$/u, "")
  return trimmed ? `${trimmed}\n` : ""
}

/**
 * Extracts the directory path portion from a note identifier.
 *
 * @param id - The note identifier which may include slash-separated path segments
 * @returns The directory portion (all segments except the last) or an empty string if there is no directory
 */
function toDirname(id: NoteId): string {
  const segments = id.split("/")
  if (segments.length <= 1) return ""
  return segments.slice(0, -1).join("/")
}

/**
 * Merge incoming task frontmatter into an existing note's frontmatter, preserving any unspecified fields and normalizing `mcpSyncState`.
 *
 * @param incoming - Frontmatter values to merge; provided fields override corresponding values from `current`.
 * @param current - Optional existing note whose frontmatter supplies defaults and preserved fields when `incoming` omits them.
 * @returns The resulting TaskFrontmatter combining the current frontmatter with serialized incoming values; `mcpSyncState` is taken from `incoming` if present, otherwise from `current`, or `null` if neither is set.
 */
function mergeFrontmatter(
  incoming: TaskFrontmatter,
  current?: Note,
): TaskFrontmatter {
  const currentFrontmatter =
    current?.frontmatter && typeof current.frontmatter === "object"
      ? current.frontmatter
      : {}

  const normalized = serializeTaskFrontmatter({
    status: incoming.status,
    project: incoming.project,
    due: incoming.due,
    priority: incoming.priority,
    mcpSyncState:
      incoming.mcpSyncState ??
      (currentFrontmatter.mcpSyncState as string | null | undefined) ??
      null,
  }).frontmatter

  return {
    ...currentFrontmatter,
    ...normalized,
  } as TaskFrontmatter
}