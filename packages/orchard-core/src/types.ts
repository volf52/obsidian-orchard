export type NoteId = string // normalized relative path, lowercase, with .md
export type NoteVersion = string // hex sha256

export const TASK_STATUSES = [
  "todo",
  "in-progress",
  "blocked",
  "done",
] as const

export type TaskStatus = (typeof TASK_STATUSES)[number]
export type TaskId = string // slug without folder or extension
export type TaskVersion = NoteVersion

export interface NoteMeta {
  id: NoteId
  title: string
  tags: string[]
  updatedAt: number // epoch ms
}

export interface NoteContent {
  frontmatter: Record<string, unknown>
  body: string // markdown body without frontmatter block
}

export interface Note extends NoteMeta, NoteContent {
  version: NoteVersion
}

export interface NoteFilters {
  tag?: string
  search?: string // naive substring search for MVP
}

export interface TaskFilters {
  status?: TaskStatus | TaskStatus[]
  tag?: string
  search?: string
  dueBefore?: number
  dueAfter?: number
}

export interface CreateNoteInput extends Omit<NoteContent, "frontmatter"> {
  id: NoteId
  title?: string
  frontmatter?: Record<string, unknown>
  tags?: string[]
}

export interface UpdateNoteMutation {
  title?: string
  body?: string
  frontmatter?: Record<string, unknown>
  tags?: string[]
}

export interface Task {
  id: TaskId
  noteId: NoteId
  title: string
  status: TaskStatus
  tags: string[]
  dueAt: number | null
  body: string
  updatedAt: number
  version: TaskVersion
  frontmatter: Record<string, unknown>
}

export interface CreateTaskInput {
  id: TaskId
  title: string
  body?: string
  status?: TaskStatus
  tags?: string[]
  dueAt?: number | null
  frontmatter?: Record<string, unknown>
}

export interface UpdateTaskMutation {
  title?: string
  body?: string
  status?: TaskStatus
  tags?: string[]
  dueAt?: number | null
  frontmatter?: Record<string, unknown>
}

export interface VaultAdapterFileInfo {
  id: NoteId
  mtime: number // ms
  size: number
}

export interface VaultAdapter {
  readFile(id: NoteId): Promise<string | null>
  writeFile(id: NoteId, data: string): Promise<void>
  fileInfo(id: NoteId): Promise<VaultAdapterFileInfo | null>
  list(): Promise<VaultAdapterFileInfo[]>
  deleteFile(id: NoteId): Promise<boolean>
}

export type NoteEvent =
  | { type: "note.created"; note: Note }
  | { type: "note.updated"; note: Note; previousVersion: NoteVersion }
  | { type: "note.deleted"; id: NoteId; previousVersion: NoteVersion }

export type TaskEvent =
  | { type: "task.created"; task: Task }
  | { type: "task.updated"; task: Task; previousVersion: TaskVersion }
  | {
      type: "task.deleted"
      id: TaskId
      noteId: NoteId
      previousVersion: TaskVersion
    }

export type OrchardEvent = NoteEvent | TaskEvent

export interface EventBus {
  publish(event: OrchardEvent): void
  subscribe(handler: (event: OrchardEvent) => void): () => void
}
