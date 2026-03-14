import type {
  InlineTaskExtraFields,
  TaskFrontmatter,
  TaskFrontmatterInit,
} from './inline-task'
import type { CreateNoteInput } from './types'
import { TASK_NOTE_MINIMAL_BODY, TASK_NOTE_TYPE } from './task'

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
  if (!raw || typeof raw !== 'object') {
    throw new Error('Task frontmatter must be an object')
  }
  const typeValue = 'type' in raw ? raw.type : undefined
  if (typeValue != null && typeValue !== TASK_NOTE_TYPE) {
    throw new Error(`Expected task note type "${TASK_NOTE_TYPE}"`)
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
): Pick<CreateNoteInput, 'frontmatter' | 'body'> {
  return {
    frontmatter: normalizeTaskFrontmatter(init),
    body: TASK_NOTE_MINIMAL_BODY,
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
  if (typeof status !== 'string') {
    throw new Error('Task status must be a string')
  }
  const trimmed = status.trim()
  if (!trimmed) throw new Error('Task status cannot be empty')
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
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed === '' ? null : trimmed
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
  if (value == null || value === '') return null
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null
    return toDateOnly(value)
  }
  if (typeof value === 'number') {
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return null
    return toDateOnly(date)
  }
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return null
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed
    const date = new Date(trimmed)
    if (Number.isNaN(date.getTime())) {
      throw new Error(`Invalid task due date: ${value}`)
    }
    return toDateOnly(date)
  }
  throw new Error('Invalid type for task due date')
}

/**
 * Format a Date as an ISO date string (YYYY-MM-DD) using the date's UTC year, month, and day.
 *
 * @param date - The Date to format; its UTC date components are used.
 * @returns The UTC date portion formatted as `YYYY-MM-DD`.
 */
function toDateOnly(date: Date): string {
  const year = date.getUTCFullYear()
  const month = `${date.getUTCMonth() + 1}`.padStart(2, '0')
  const day = `${date.getUTCDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
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
    .replace(/[-:TZ.]/g, '')
    .slice(0, 14)
  const random = Math.floor(randomFn() * 36 ** 4)
    .toString(36)
    .padStart(4, '0')
  return `orchard-task-${iso}${random}`
}

/**
 * Convert a task status string to a checkbox character.
 *
 * @param status - The task status to convert
 * @returns A checkbox character representing the status
 */
export function _statusToCheckbox(status: string): string {
  const normalized = status.trim().toLowerCase()
  if (['done', 'complete', 'completed'].includes(normalized)) return 'x'
  if (['cancelled', 'canceled'].includes(normalized)) return '-'
  if (['in-progress', 'doing', 'working', 'started'].includes(normalized))
    return '>'
  if (['waiting', 'blocked', 'hold'].includes(normalized)) return '~'
  return ' '
}

/**
 * Convert a checkbox character to a task status string.
 *
 * @param checkbox - The checkbox character to convert
 * @returns A task status string
 */
export function checkboxToStatus(checkbox: string): string {
  switch (checkbox) {
    case 'x':
    case 'X':
      return 'done'
    case '-':
      return 'cancelled'
    case '>':
    case '~':
      return 'in_progress'
    default:
      return 'todo'
  }
}

/**
 * Collapse consecutive whitespace characters into single spaces and remove leading/trailing whitespace.
 *
 * @param value - The input string whose whitespace will be normalized
 * @returns The string with internal whitespace collapsed to single spaces and trimmed at both ends
 */
export function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
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
export function normalizeExtraFields(
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

export interface LineSet {
  lines: string[]
  trailingNewline: boolean
}

/**
 * Parse a text body into a structured representation of its lines.
 *
 * Normalizes line endings to LF and preserves whether the original body ended with a newline.
 *
 * @param body - The text body to parse into lines
 * @returns A `LineSet` containing the parsed lines and whether the original body had a trailing newline
 */
export function toLineSet(body: string): LineSet {
  const normalized = body.replace(/\r\n/g, '\n')
  const trailingNewline = normalized.endsWith('\n')
  const content = trailingNewline ? normalized.slice(0, -1) : normalized
  const lines = content ? content.split('\n') : []
  return { lines, trailingNewline }
}

/**
 * Append a line to a text body.
 *
 * @param body - The original text body
 * @param line - The line to append
 * @returns The updated text body with the line appended
 */
export function appendLine(body: string, line: string): string {
  const set = toLineSet(body)
  set.lines.push(line)
  return fromLineSet(set.lines, true)
}

/**
 * Replace a line at a specific index in a text body.
 *
 * @param body - The original text body
 * @param index - The index of the line to replace (0-based)
 * @param line - The new line content
 * @returns The updated text body with the line replaced
 * @throws If the index is out of range
 */
export function replaceLine(body: string, index: number, line: string): string {
  const set = toLineSet(body)
  if (index < 0 || index >= set.lines.length) {
    throw new Error(`Inline task line index out of range: ${index}`)
  }
  set.lines[index] = line
  return fromLineSet(set.lines, true)
}

/**
 * Remove a line at a specific index from a text body.
 *
 * @param body - The original text body
 * @param index - The index of the line to remove (0-based)
 * @returns The updated text body with the line removed, or the original body if the index is out of range
 */
export function removeLine(body: string, index: number): string {
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
  if (lines.length === 0) return ''
  const joined = lines.join('\n')
  return trailingNewline ? `${joined}\n` : joined
}
