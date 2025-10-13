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

function formatBody(body: string | undefined): string {
  if (!body) return ""
  const trimmed = body.replace(/\s+$/u, "")
  return trimmed ? `${trimmed}\n` : ""
}

function toDirname(id: NoteId): string {
  const segments = id.split("/")
  if (segments.length <= 1) return ""
  return segments.slice(0, -1).join("/")
}

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
