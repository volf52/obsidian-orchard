import type {
  CreateNoteInput,
  Note,
  NoteFilters,
  NoteId,
  NoteVersion,
  UpdateNoteMutation,
} from "./types"
import type { NoteService } from "./note-service"

export const TASK_NOTE_TYPE = "orchard-task" as const
export const TASK_NOTE_MINIMAL_BODY = ""

export type TaskSyncState = "pending" | "synced" | "error" | (string & {})

export interface TaskFrontmatter extends Record<string, unknown> {
  type: typeof TASK_NOTE_TYPE
  status: string
  project: string | null
  due: string | null
  priority: string | null
  mcpSyncState: TaskSyncState | null
}

export interface TaskNote extends Omit<Note, "frontmatter"> {
  frontmatter: TaskFrontmatter
}

export interface TaskFrontmatterInit {
  status: unknown
  project?: unknown
  due?: unknown
  priority?: unknown
  mcpSyncState?: unknown
}

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

export function normalizeTaskFrontmatter(
  init: TaskFrontmatterInit,
): TaskFrontmatter {
  const status = normalizeStatus(init.status)
  return {
    type: TASK_NOTE_TYPE,
    status,
    project: normalizeOptionalString(init.project),
    due: normalizeDue(init.due),
    priority: normalizeOptionalString(init.priority),
    mcpSyncState: normalizeOptionalString(init.mcpSyncState),
  }
}

export function validateTaskFrontmatter(raw: Record<string, unknown>): TaskFrontmatter {
  if (!raw || typeof raw !== "object") {
    throw new Error("Task frontmatter must be an object")
  }
  const typeValue = "type" in raw ? raw.type : undefined
  if (typeValue != null && typeValue !== TASK_NOTE_TYPE) {
    throw new Error(`Expected task note type \"${TASK_NOTE_TYPE}\"`)
  }
  const init: TaskFrontmatterInit = {
    status: (raw as Record<string, unknown>).status,
    project: (raw as Record<string, unknown>).project,
    due: (raw as Record<string, unknown>).due,
    priority: (raw as Record<string, unknown>).priority,
    mcpSyncState: (raw as Record<string, unknown>).mcpSyncState,
  }
  return normalizeTaskFrontmatter(init)
}

export function serializeTaskFrontmatter(
  init: TaskFrontmatterInit,
): Pick<CreateNoteInput, "frontmatter" | "body"> {
  return {
    frontmatter: normalizeTaskFrontmatter(init),
    body: TASK_NOTE_MINIMAL_BODY,
  }
}

export function isTaskNote(note: Note | null | undefined): note is TaskNote {
  if (!note) return false
  try {
    const frontmatter = validateTaskFrontmatter(note.frontmatter)
    return frontmatter.type === TASK_NOTE_TYPE
  } catch {
    return false
  }
}

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
      due:
        mutation.due !== undefined ? mutation.due : current.frontmatter.due,
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

function normalizeStatus(status: unknown): string {
  if (typeof status !== "string") {
    throw new Error("Task status must be a string")
  }
  const trimmed = status.trim()
  if (!trimmed) throw new Error("Task status cannot be empty")
  return trimmed
}

function normalizeOptionalString(value: unknown): string | null {
  if (value == null) return null
  if (typeof value === "string") {
    const trimmed = value.trim()
    return trimmed === "" ? null : trimmed
  }
  return String(value)
}

function normalizeDue(value: unknown): string | null {
  if (value == null || value === "") return null
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null
    return toDateOnly(value)
  }
  if (typeof value === "number") {
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return null
    return toDateOnly(date)
  }
  if (typeof value === "string") {
    const trimmed = value.trim()
    if (!trimmed) return null
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed
    const date = new Date(trimmed)
    if (Number.isNaN(date.getTime())) {
      throw new Error(`Invalid task due date: ${value}`)
    }
    return toDateOnly(date)
  }
  throw new Error("Invalid type for task due date")
}

function toDateOnly(date: Date): string {
  const year = date.getUTCFullYear()
  const month = `${date.getUTCMonth() + 1}`.padStart(2, "0")
  const day = `${date.getUTCDate()}`.padStart(2, "0")
  return `${year}-${month}-${day}`
}

type TaskCheckbox = " " | "x" | "X" | "-" | ">" | "~"

export interface InlineTaskExtraFields extends Record<string, string> {}

export interface InlineTask {
  noteId: NoteId
  line: number
  indent: string
  bullet: "-" | "*"
  checkbox: TaskCheckbox
  text: string
  blockId: string | null
  frontmatter: TaskFrontmatter
  extraFields: InlineTaskExtraFields
  raw: string
}

export interface InlineTaskFormatInput {
  text: string
  frontmatter: TaskFrontmatterInit | TaskFrontmatter
  indent?: string
  bullet?: "-" | "*"
  blockId?: string | null
  extraFields?: InlineTaskExtraFields
}

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

export function createInlineTaskBlockId(
  date = new Date(),
  randomFn: () => number = Math.random,
): string {
  const iso = date.toISOString().replace(/[-:TZ.]/g, "").slice(0, 14)
  const random = Math.floor(randomFn() * 36 ** 4)
    .toString(36)
    .padStart(4, "0")
  return `orchard-task-${iso}${random}`
}

export function formatInlineTaskLine(input: InlineTaskFormatInput): string {
  const frontmatter = normalizeTaskFrontmatter({
    status: input.frontmatter.status,
    project: input.frontmatter.project,
    due: input.frontmatter.due,
    priority: input.frontmatter.priority,
    mcpSyncState: input.frontmatter.mcpSyncState,
  })

  const indent = input.indent ?? ""
  const bullet = input.bullet ?? "-"
  const checkbox = statusToCheckbox(frontmatter.status)
  const text = collapseWhitespace(input.text)
  const segments: string[] = []
  segments.push(`${indent}${bullet} [${checkbox}] ${text}`)
  segments.push(`type:: ${TASK_NOTE_TYPE}`)
  segments.push(`status:: ${frontmatter.status}`)
  if (frontmatter.project) segments.push(`project:: ${frontmatter.project}`)
  if (frontmatter.due) segments.push(`due:: ${frontmatter.due}`)
  if (frontmatter.priority) segments.push(`priority:: ${frontmatter.priority}`)
  if (frontmatter.mcpSyncState)
    segments.push(`mcpSyncState:: ${frontmatter.mcpSyncState}`)

  const extra = normalizeExtraFields(input.extraFields)
  for (const key of Object.keys(extra).sort((a, b) => a.localeCompare(b))) {
    const value = extra[key]
    if (!value) continue
    segments.push(`${key}:: ${value}`)
  }

  let line = segments.join(" ")
  if (input.blockId) {
    line = `${line} ^${input.blockId}`
  }
  return line
}

export function parseInlineTasks(note: Pick<Note, "id" | "body">): InlineTask[] {
  const { lines } = toLineSet(note.body)
  const tasks: InlineTask[] = []
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    const match = line.match(/^(\s*)([-*])\s+\[([ xX>\-~])\]\s+(.*)$/)
    if (!match) continue

    const indent = match[1]
    const bullet = match[2] === "*" ? "*" : "-"
    const checkbox = match[3] as TaskCheckbox
    let remainder = match[4]

    let blockId: string | null = null
    const blockMatch = remainder.match(/\s*\^([A-Za-z0-9-]+)\s*$/)
    if (blockMatch && blockMatch.index !== undefined) {
      blockId = blockMatch[1]
      remainder = remainder.slice(0, blockMatch.index).trimEnd()
    }

    const extracted = extractInlineFields(remainder)
    const rawType = extracted.fields.type
    if (!rawType || rawType.toLowerCase() !== TASK_NOTE_TYPE) continue

    const statusValue =
      extracted.fields.status !== undefined
        ? extracted.fields.status
        : checkboxToStatus(checkbox)

    const frontmatter = normalizeTaskFrontmatter({
      status: statusValue,
      project: extracted.fields.project,
      due: extracted.fields.due,
      priority: extracted.fields.priority,
      mcpSyncState: extracted.fields.mcpSyncState,
    })

    const extraFields = normalizeExtraFields(extracted.fields, [
      "type",
      "status",
      "project",
      "due",
      "priority",
      "mcpSyncState",
    ])

    const task: InlineTask = {
      noteId: note.id,
      line: index,
      indent,
      bullet,
      checkbox,
      text: extracted.text,
      blockId,
      frontmatter,
      extraFields,
      raw: line,
    }
    tasks.push(task)
  }
  return tasks
}

export class InlineTaskService {
  private notes: NoteService

  private createBlockId: () => string

  constructor(notes: NoteService, options?: { createBlockId?: () => string }) {
    this.notes = notes
    this.createBlockId = options?.createBlockId ?? (() => createInlineTaskBlockId())
  }

  async list(noteId: NoteId): Promise<InlineTask[]> {
    const note = await this.notes.read(noteId)
    if (!note) return []
    return parseInlineTasks(note)
  }

  async create(input: CreateInlineTaskInput): Promise<InlineTask> {
    const note = await this.notes.read(input.noteId)
    if (!note) throw new Error(`Note not found for inline task: ${input.noteId}`)

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

    const created = parseInlineTasks(updated).find((task) => task.blockId === blockId)
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
    if (!note) throw new Error(`Note not found for inline task: ${identifier.noteId}`)

    const tasks = parseInlineTasks(note)
    const target = this.findTargetTask(tasks, identifier)
    if (!target) throw new Error("Inline task not found")

    const frontmatter = normalizeTaskFrontmatter({
      status: mutation.status ?? target.frontmatter.status,
      project:
        mutation.project !== undefined ? mutation.project : target.frontmatter.project,
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

    const blockId = mutation.blockId === undefined ? target.blockId : mutation.blockId

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

function statusToCheckbox(status: string): string {
  const normalized = status.trim().toLowerCase()
  if (["done", "complete", "completed"].includes(normalized)) return "x"
  if (["cancelled", "canceled"].includes(normalized)) return "-"
  if (["in-progress", "doing", "working", "started"].includes(normalized)) return ">"
  if (["waiting", "blocked", "hold"].includes(normalized)) return "~"
  return " "
}

function checkboxToStatus(checkbox: TaskCheckbox): string {
  switch (checkbox) {
    case "x":
    case "X":
      return "done"
    case "-":
      return "cancelled"
    case ">":
    case "~":
      return "in-progress"
    default:
      return "todo"
  }
}

interface ExtractedFields {
  fields: Record<string, string>
  text: string
}

function extractInlineFields(value: string): ExtractedFields {
  if (!value.trim()) {
    return { fields: {}, text: "" }
  }
  const matches = Array.from(value.matchAll(/(?<=^|\s)([A-Za-z0-9_-]+)::/g))
  if (matches.length === 0) {
    return { fields: {}, text: collapseWhitespace(value) }
  }
  const fields: Record<string, string> = {}
  let cursor = 0
  const textParts: string[] = []

  for (let i = 0; i < matches.length; i += 1) {
    const match = matches[i]
    const start = match.index ?? 0
    if (start > cursor) {
      textParts.push(value.slice(cursor, start))
    }
    const key = match[1]
    const valueStart = start + match[0].length
    const valueEnd =
      i + 1 < matches.length
        ? matches[i + 1]?.index ?? value.length
        : value.length
    const rawVal = value.slice(valueStart, valueEnd)
    fields[key] = collapseWhitespace(rawVal)
    cursor = valueEnd
  }
  if (cursor < value.length) {
    textParts.push(value.slice(cursor))
  }

  const text = collapseWhitespace(textParts.join(" "))
  return { fields, text }
}

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim()
}

function normalizeExtraFields(
  fields: Record<string, string | null | undefined> | undefined,
  omit: string[] = [],
): InlineTaskExtraFields {
  if (!fields) return {}
  const out: InlineTaskExtraFields = {}
  for (const [key, value] of Object.entries(fields)) {
    if (!value) continue
    if (omit.includes(key)) continue
    out[key] = collapseWhitespace(value)
  }
  return out
}

interface LineSet {
  lines: string[]
  trailingNewline: boolean
}

function toLineSet(body: string): LineSet {
  const normalized = body.replace(/\r\n/g, "\n")
  const trailingNewline = normalized.endsWith("\n")
  const content = trailingNewline ? normalized.slice(0, -1) : normalized
  const lines = content ? content.split("\n") : []
  return { lines, trailingNewline }
}

function appendLine(body: string, line: string): string {
  const set = toLineSet(body)
  set.lines.push(line)
  return fromLineSet(set.lines, true)
}

function replaceLine(body: string, index: number, line: string): string {
  const set = toLineSet(body)
  if (index < 0 || index >= set.lines.length) {
    throw new Error(`Inline task line index out of range: ${index}`)
  }
  set.lines[index] = line
  return fromLineSet(set.lines, true)
}

function removeLine(body: string, index: number): string {
  const set = toLineSet(body)
  if (index < 0 || index >= set.lines.length) {
    return body
  }
  set.lines.splice(index, 1)
  return fromLineSet(set.lines, set.lines.length > 0)
}

function fromLineSet(lines: string[], trailingNewline: boolean): string {
  if (lines.length === 0) return ""
  const joined = lines.join("\n")
  return trailingNewline ? `${joined}\n` : joined
}
