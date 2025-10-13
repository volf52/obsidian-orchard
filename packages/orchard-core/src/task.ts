import type { NoteService } from "./note-service"
import type {
  CreateNoteInput,
  Note,
  NoteFilters,
  NoteId,
  NoteVersion,
  UpdateNoteMutation,
} from "./types"

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

/**
 * Produce a normalized TaskFrontmatter object from a TaskFrontmatterInit.
 *
 * @returns A TaskFrontmatter with `type` set to `TASK_NOTE_TYPE` and normalized `status`, `project`, `due`, `priority`, and `mcpSyncState` fields.
 */
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

/**
 * Validate and normalize a raw task frontmatter object.
 *
 * @param raw - The raw frontmatter object to validate and normalize
 * @returns The normalized `TaskFrontmatter` with `type` set to `TASK_NOTE_TYPE`
 * @throws If `raw` is not an object or if `raw.type` is present and does not equal `TASK_NOTE_TYPE`
 */
export function validateTaskFrontmatter(
  raw: Record<string, unknown>,
): TaskFrontmatter {
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

/**
 * Produce a serializable frontmatter object and minimal body for creating a task note.
 *
 * @param init - Initial task frontmatter values to normalize
 * @returns An object with `frontmatter` set to the normalized task frontmatter and `body` set to the minimal task note body
 */
export function serializeTaskFrontmatter(
  init: TaskFrontmatterInit,
): Pick<CreateNoteInput, "frontmatter" | "body"> {
  return {
    frontmatter: normalizeTaskFrontmatter(init),
    body: TASK_NOTE_MINIMAL_BODY,
  }
}

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

/**
 * Normalize and validate a task status value.
 *
 * Trims leading and trailing whitespace and returns the resulting string.
 *
 * @param status - The value to validate and normalize as a task status
 * @returns The trimmed status string
 * @throws Error - If `status` is not a string (`"Task status must be a string"`) or if the trimmed string is empty (`"Task status cannot be empty"`)
 */
function normalizeStatus(status: unknown): string {
  if (typeof status !== "string") {
    throw new Error("Task status must be a string")
  }
  const trimmed = status.trim()
  if (!trimmed) throw new Error("Task status cannot be empty")
  return trimmed
}

/**
 * Normalize a possibly-null/empty value into a trimmed string or `null`.
 *
 * @param value - The input to normalize. `null` or `undefined` become `null`; strings are trimmed and empty or whitespace-only strings become `null`; other values are converted to a string.
 * @returns The trimmed string result, or `null` if the input was nullish or an empty/whitespace-only string.
 */
function normalizeOptionalString(value: unknown): string | null {
  if (value == null) return null
  if (typeof value === "string") {
    const trimmed = value.trim()
    return trimmed === "" ? null : trimmed
  }
  return String(value)
}

/**
 * Normalize a task due value into a date-only ISO string (YYYY-MM-DD) or `null`.
 *
 * @param value - Accepted inputs: `null`/`undefined`/empty string, a `Date` instance, a numeric timestamp, or a date string (either `YYYY-MM-DD` or any string parseable by `Date`). Strings are trimmed before parsing.
 * @returns A `YYYY-MM-DD` formatted date string if `value` represents a valid date, or `null` if `value` is `null`, an empty string, or an invalid `Date`/numeric timestamp.
 * @throws Error if `value` is a non-empty string that cannot be parsed as a date or if `value` is of an unsupported type.
 */
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

/**
 * Format a Date as an ISO date string (YYYY-MM-DD) using the date's UTC year, month, and day.
 *
 * @param date - The Date to format; its UTC date components are used.
 * @returns The UTC date portion formatted as `YYYY-MM-DD`.
 */
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

/**
 * Generate a unique block identifier for an inline task combining a compact timestamp and a short base-36 random suffix.
 *
 * @param date - Date to base the timestamp on; defaults to the current date/time.
 * @param randomFn - Function that returns a number in [0, 1); used to seed the random suffix. Defaults to Math.random.
 * @returns A string of the form `orchard-task-YYYYMMDDHHMMSSxxxx` where `xxxx` is a zero-padded base-36 random suffix.
 */
export function createInlineTaskBlockId(
  date = new Date(),
  randomFn: () => number = Math.random,
): string {
  const iso = date
    .toISOString()
    .replace(/[-:TZ.]/g, "")
    .slice(0, 14)
  const random = Math.floor(randomFn() * 36 ** 4)
    .toString(36)
    .padStart(4, "0")
  return `orchard-task-${iso}${random}`
}

/**
 * Formats an inline task into a single line suitable for storing in a note body.
 *
 * @param input - Formatting options including:
 *   - `text`: task text
 *   - `frontmatter`: task metadata (`status`, `project`, `due`, `priority`, `mcpSyncState`)
 *   - `indent` and `bullet`: leading whitespace and list bullet
 *   - `blockId`: optional block identifier appended as `^blockId`
 *   - `extraFields`: additional key:: value fields to include
 * @returns A single-line string representing the inline task, containing the list marker, checkbox, collapsed text, inline frontmatter fields, any extra fields (sorted by key), and an optional trailing `^blockId`.
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

/**
 * Parse inline checklist task lines from a note body into structured InlineTask objects.
 *
 * Only lines that match the checklist pattern (bullet + checkbox + fields) and include a `type` field
 * equal to `orchard-task` (case-insensitive) are returned.
 *
 * @param note - The note (id and body) to scan for inline tasks
 * @returns An array of `InlineTask` objects parsed from the note body, in document order
 */
export function parseInlineTasks(
  note: Pick<Note, "id" | "body">,
): InlineTask[] {
  const { lines } = toLineSet(note.body)
  const tasks: InlineTask[] = []
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    if (line == null) continue

    const match = line.match(/^(\s*)([-*])\s+\[([ xX>\-~])\]\s+(.*)$/)
    if (!match) continue

    const indent = match[1] ?? ""
    const bullet = match[2] === "*" ? "*" : "-"
    const checkbox = (match[3] ?? " ") as TaskCheckbox
    let remainder = match[4] ?? ""

    let blockId: string | null = null
    const blockMatch = remainder.match(/\s*\^([A-Za-z0-9-]+)\s*$/)
    if (blockMatch?.index !== undefined) {
      blockId = blockMatch[1] ?? null
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

/**
 * Map a task status string to the corresponding checkbox symbol.
 *
 * @param status - Status label (case-insensitive, leading/trailing whitespace ignored)
 * @returns `"x"` for completed statuses, `"-"` for cancelled statuses, `">"` for in-progress statuses, `"~"` for waiting/blocked statuses, or `" "` for any other status
 */
function statusToCheckbox(status: string): string {
  const normalized = status.trim().toLowerCase()
  if (["done", "complete", "completed"].includes(normalized)) return "x"
  if (["cancelled", "canceled"].includes(normalized)) return "-"
  if (["in-progress", "doing", "working", "started"].includes(normalized))
    return ">"
  if (["waiting", "blocked", "hold"].includes(normalized)) return "~"
  return " "
}

/**
 * Map an inline task checkbox character to its canonical task status.
 *
 * @param checkbox - A task checkbox symbol (`" "`, `"x"`, `"X"`, `"-"`, `">"`, or `"~"`)
 * @returns The canonical status: `done` for `"x"`/`"X"`, `cancelled` for `"-"`, `in-progress` for `">"`/`"~"`, and `todo` for any other checkbox
 */
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

/**
 * Extracts inline "key:: value" fields from a string and returns a map of those fields plus the remaining text.
 *
 * Recognizes keys matching [A-Za-z0-9_-] followed by `::`. Values for each key extend until the next key occurrence or end of string. Whitespace in extracted values and in the returned text is collapsed to single spaces and trimmed. An empty or whitespace-only input yields empty fields and an empty text.
 *
 * @param value - The input string that may contain `key:: value` pairs interleaved with free text.
 * @returns An object with `fields`, a map from each extracted key to its collapsed value, and `text`, the remaining collapsed text with all extracted field segments removed.
 */
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
    if (!match) continue

    const start = match.index ?? 0
    if (start > cursor) {
      textParts.push(value.slice(cursor, start))
    }
    const key = match[1]
    if (!key) continue
    const valueStart = start + match[0].length
    const valueEnd =
      i + 1 < matches.length
        ? (matches[i + 1]?.index ?? value.length)
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

/**
 * Collapse consecutive whitespace characters into single spaces and remove leading/trailing whitespace.
 *
 * @param value - The input string whose whitespace will be normalized
 * @returns The string with internal whitespace collapsed to single spaces and trimmed at both ends
 */
function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim()
}

/**
 * Filter and normalize a map of extra inline-task fields.
 *
 * Removes entries whose value is `null`, `undefined`, or the empty string, excludes any keys listed in `omit`,
 * and collapses internal whitespace in retained values.
 *
 * @param fields - Source map of extra fields (may be `undefined`)
 * @param omit - Keys to exclude from the result
 * @returns A map of normalized, non-empty extra fields with internal whitespace collapsed
 */
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

/**
 * Split a text body into an array of lines and determine if it ended with a trailing newline.
 *
 * The input is normalized from CRLF to LF before splitting; the returned `lines` contain the
 * body content without a final empty line, and `trailingNewline` is `true` if the original
 * input ended with a newline character.
 *
 * @returns A `LineSet` with `lines` (string[]) and `trailingNewline` (`true` if the original body ended with `\n`)
 */
function toLineSet(body: string): LineSet {
  const normalized = body.replace(/\r\n/g, "\n")
  const trailingNewline = normalized.endsWith("\n")
  const content = trailingNewline ? normalized.slice(0, -1) : normalized
  const lines = content ? content.split("\n") : []
  return { lines, trailingNewline }
}

/**
 * Appends a single line to a note body, preserving newline semantics.
 *
 * @param body - The original note body text
 * @param line - The line to append (without automatic newline)
 * @returns The updated body with `line` appended as a new line; the result always preserves a trailing newline after the appended line
 */
function appendLine(body: string, line: string): string {
  const set = toLineSet(body)
  set.lines.push(line)
  return fromLineSet(set.lines, true)
}

/**
 * Replace a specific line in a note body with a new line.
 *
 * @param body - The original multi-line string (note body)
 * @param index - Zero-based line index to replace
 * @param line - Replacement line content
 * @returns The updated body string with the specified line replaced; preserves trailing newline
 * @throws Error if `index` is negative or not less than the number of lines in `body`
 */
function replaceLine(body: string, index: number, line: string): string {
  const set = toLineSet(body)
  if (index < 0 || index >= set.lines.length) {
    throw new Error(`Inline task line index out of range: ${index}`)
  }
  set.lines[index] = line
  return fromLineSet(set.lines, true)
}

/**
 * Remove the line at the given zero-based index from a multiline body string.
 *
 * @param body - The full text body split into lines
 * @param index - The zero-based line index to remove
 * @returns The body with the specified line removed; if `index` is out of range, returns the original `body`
 */
function removeLine(body: string, index: number): string {
  const set = toLineSet(body)
  if (index < 0 || index >= set.lines.length) {
    return body
  }
  set.lines.splice(index, 1)
  return fromLineSet(set.lines, set.lines.length > 0)
}

/**
 * Reconstructs a text body from an array of lines, optionally preserving a trailing newline.
 *
 * @param lines - The lines to join into a single string; an empty array yields an empty string.
 * @param trailingNewline - If true, append a single trailing newline to the joined lines.
 * @returns The joined lines as a single string, with a trailing newline if `trailingNewline` is true.
 */
function fromLineSet(lines: string[], trailingNewline: boolean): string {
  if (lines.length === 0) return ""
  const joined = lines.join("\n")
  return trailingNewline ? `${joined}\n` : joined
}