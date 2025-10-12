import { NoteService } from "./note-service"
import type {
  CreateTaskInput,
  EventBus,
  NoteFilters,
  NoteId,
  NoteVersion,
  Task,
  TaskFilters,
  TaskId,
  TaskStatus,
  TaskVersion,
  UpdateNoteMutation,
  UpdateTaskMutation,
} from "./types"
import { TASK_STATUSES } from "./types"

const DEFAULT_FOLDER = "tasks"

const STATUS_SET = new Set<string>(TASK_STATUSES)

export const TASK_STATUS_TRANSITIONS: Record<TaskStatus, readonly TaskStatus[]> = {
  todo: ["todo", "in-progress", "blocked", "done"],
  "in-progress": ["in-progress", "blocked", "done", "todo"],
  blocked: ["blocked", "in-progress", "done", "todo"],
  done: ["done", "todo"],
} as const

function isTaskStatus(value: unknown): value is TaskStatus {
  return typeof value === "string" && STATUS_SET.has(value)
}

function normalizeFolder(folder?: string): string {
  const raw = folder?.trim() ?? DEFAULT_FOLDER
  const cleaned = raw.replace(/^\/+|\/+$/g, "")
  if (!cleaned) throw new Error("Task folder must be non-empty")
  return cleaned.toLowerCase()
}

function normalizeTaskId(rawId: string): TaskId {
  const trimmed = rawId.trim()
  if (!trimmed) throw new Error("Task id must be provided")
  const withoutExt = trimmed.replace(/\.md$/i, "")
  const collapsed = withoutExt.replace(/^\/+|\/+$/g, "")
  if (!collapsed) throw new Error("Task id resolved to empty path")
  return collapsed.toLowerCase() as TaskId
}

function toNoteId(folder: string, taskId: TaskId): NoteId {
  return `${folder}/${taskId}` as NoteId
}

function fromNoteId(folder: string, noteId: NoteId): TaskId | null {
  if (!noteId.startsWith(`${folder}/`)) return null
  const remainder = noteId.slice(folder.length + 1)
  const withoutExt = remainder.replace(/\.md$/i, "")
  return withoutExt as TaskId
}

function coerceStatus(status: unknown, fallback: TaskStatus): TaskStatus {
  return isTaskStatus(status) ? status : fallback
}

function coerceDueAt(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value
  return null
}

function mapNoteToTask(note: {
  id: NoteId
  title: string
  tags: string[]
  updatedAt: number
  frontmatter: Record<string, unknown>
  body: string
  version: NoteVersion
}, folder: string, fallbackStatus: TaskStatus): Task | null {
  const taskId = fromNoteId(folder, note.id)
  if (!taskId) return null
  const frontmatter = { ...note.frontmatter }
  const status = coerceStatus(frontmatter.status, fallbackStatus)
  const dueAt = coerceDueAt(frontmatter.due)
  return {
    id: taskId,
    noteId: note.id,
    title: note.title,
    status,
    tags: note.tags,
    dueAt,
    body: note.body,
    updatedAt: note.updatedAt,
    version: note.version as TaskVersion,
    frontmatter,
  }
}

export function canTransitionTaskStatus(
  current: TaskStatus,
  next: TaskStatus,
): boolean {
  if (current === next) return true
  const allowed = TASK_STATUS_TRANSITIONS[current]
  return allowed?.includes(next) ?? false
}

export function assertCanTransitionTaskStatus(
  current: TaskStatus,
  next: TaskStatus,
): void {
  if (!canTransitionTaskStatus(current, next)) {
    throw new Error(`Invalid task status transition: ${current} -> ${next}`)
  }
}

export function assertTaskVersion(
  target: { id: TaskId; version: TaskVersion },
  expectedVersion: TaskVersion,
): void {
  if (target.version !== expectedVersion) {
    throw new Error("VersionConflict: stale version provided")
  }
}

export function taskMatchesFilters(task: Task, filters?: TaskFilters): boolean {
  if (!filters) return true
  if (filters.status) {
    const statuses = Array.isArray(filters.status)
      ? filters.status
      : [filters.status]
    if (!statuses.includes(task.status)) return false
  }
  if (filters.tag && !task.tags.includes(filters.tag)) return false
  if (filters.search) {
    const query = filters.search.toLowerCase()
    if (
      !task.title.toLowerCase().includes(query) &&
      !task.body.toLowerCase().includes(query)
    )
      return false
  }
  if (filters.dueBefore !== undefined) {
    if (task.dueAt == null || task.dueAt >= filters.dueBefore) return false
  }
  if (filters.dueAfter !== undefined) {
    if (task.dueAt == null || task.dueAt <= filters.dueAfter) return false
  }
  return true
}

interface TaskServiceDeps {
  noteService: NoteService
  folder?: string
  events?: EventBus
  defaultStatus?: TaskStatus
}

export class TaskService {
  private readonly noteService: NoteService
  private readonly folder: string
  private readonly events?: EventBus
  private readonly defaultStatus: TaskStatus

  constructor(deps: TaskServiceDeps) {
    this.noteService = deps.noteService
    this.folder = normalizeFolder(deps.folder)
    this.events = deps.events
    const status = deps.defaultStatus ?? "todo"
    if (!isTaskStatus(status)) {
      throw new Error(`Invalid default task status: ${status}`)
    }
    this.defaultStatus = status
  }

  async list(filters?: TaskFilters): Promise<Task[]> {
    const noteFilters: NoteFilters | undefined = filters
      ? {
          ...(filters.tag ? { tag: filters.tag } : {}),
          ...(filters.search ? { search: filters.search } : {}),
        }
      : undefined
    const notes = await this.noteService.list(noteFilters)
    const out: Task[] = []
    for (const note of notes) {
      const task = mapNoteToTask(note, this.folder, this.defaultStatus)
      if (!task) continue
      if (taskMatchesFilters(task, filters)) out.push(task)
    }
    return out
  }

  async read(id: TaskId): Promise<Task | null> {
    const normalizedId = normalizeTaskId(id)
    const noteId = toNoteId(this.folder, normalizedId)
    const note = await this.noteService.read(noteId)
    if (!note) return null
    const task = mapNoteToTask(note, this.folder, this.defaultStatus)
    return task
  }

  async create(input: CreateTaskInput): Promise<Task> {
    const normalizedId = normalizeTaskId(input.id)
    const status = input.status ?? this.defaultStatus
    if (!isTaskStatus(status)) {
      throw new Error(`Invalid task status: ${input.status}`)
    }
    const frontmatter = {
      ...(input.frontmatter ?? {}),
      status,
      due: input.dueAt ?? null,
    }
    const note = await this.noteService.create({
      id: toNoteId(this.folder, normalizedId),
      title: input.title,
      body: input.body ?? "",
      frontmatter,
      tags: input.tags,
    })
    const task = mapNoteToTask(note, this.folder, this.defaultStatus)
    if (!task) throw new Error("Failed to map created task")
    this.events?.publish({ type: "task.created", task })
    return task
  }

  async update(
    id: TaskId,
    mutation: UpdateTaskMutation,
    expectedVersion: TaskVersion,
  ): Promise<Task> {
    const normalizedId = normalizeTaskId(id)
    const current = await this.read(normalizedId)
    if (!current) throw new Error(`Task missing: ${normalizedId}`)
    assertTaskVersion(current, expectedVersion)
    let nextStatus = current.status
    if (mutation.status !== undefined) {
      if (!isTaskStatus(mutation.status)) {
        throw new Error(`Invalid task status: ${mutation.status}`)
      }
      assertCanTransitionTaskStatus(current.status, mutation.status)
      nextStatus = mutation.status
    }
    const nextDueAt =
      mutation.dueAt !== undefined ? mutation.dueAt : current.dueAt
    const nextFrontmatter = {
      ...current.frontmatter,
      ...(mutation.frontmatter ?? {}),
      status: nextStatus,
      due: nextDueAt,
    }
    const noteMutation: UpdateNoteMutation = {
      title: mutation.title,
      body: mutation.body,
      frontmatter: nextFrontmatter,
      tags: mutation.tags,
    }
    const updatedNote = await this.noteService.update(
      toNoteId(this.folder, normalizedId),
      noteMutation,
      expectedVersion,
    )
    const task = mapNoteToTask(updatedNote, this.folder, this.defaultStatus)
    if (!task) throw new Error("Failed to map updated task")
    this.events?.publish({
      type: "task.updated",
      task,
      previousVersion: expectedVersion,
    })
    return task
  }

  async delete(id: TaskId, expectedVersion: TaskVersion): Promise<boolean> {
    const normalizedId = normalizeTaskId(id)
    const current = await this.read(normalizedId)
    if (!current) return false
    assertTaskVersion(current, expectedVersion)
    const ok = await this.noteService.delete(
      toNoteId(this.folder, normalizedId),
      expectedVersion,
    )
    if (ok) {
      this.events?.publish({
        type: "task.deleted",
        id: current.id,
        noteId: current.noteId,
        previousVersion: expectedVersion,
      })
    }
    return ok
  }
}
