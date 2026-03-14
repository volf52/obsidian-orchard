import type { Note, NoteId } from '../types'

// Constants
export const TASK_NOTE_TYPE = 'orchard-task' as const

// Types
export type TaskSyncState = 'pending' | 'synced' | 'error' | (string & {})

export interface TaskFrontmatter extends Record<string, unknown> {
  type: typeof TASK_NOTE_TYPE
  status: string
  project: string | null
  due: string | null
  priority: string | null
  mcpSyncState: TaskSyncState | null
}

export interface TaskFrontmatterInit {
  status: unknown
  project?: unknown
  due?: unknown
  priority?: unknown
  mcpSyncState?: unknown
}

export type TaskCheckbox = ' ' | 'x' | 'X' | '-' | '>' | '~'

export interface InlineTaskExtraFields extends Record<string, string> {}

export interface InlineTask {
  noteId: NoteId
  line: number
  indent: string
  bullet: '-' | '*'
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
  bullet?: '-' | '*'
  blockId?: string | null
  extraFields?: InlineTaskExtraFields
}

/**
 * Format an inline task into a single-line string representation.
 *
 * This function creates a checklist line with inline Dataview-style fields that can be
 * parsed back into a structured task. The format includes:
 * - List marker with checkbox
 * - Task text
 * - Inline fields for task metadata
 * - Optional block identifier
 *
 * @param input - Formatting options including:
 *   - `text`: task text
 *   - `frontmatter`: task metadata (`status`, `project`, `due`, `priority`, `mcpSyncState`)
 *   - `indent` and `bullet`: leading whitespace and list bullet
 *   - `blockId`: optional block identifier appended as `^blockId`
 *   - `extraFields`: additional key:: value fields to include
 * @returns A single-line string representing the inline task, containing the list marker, checkbox, collapsed text, inline frontmatter fields, any extra fields (sorted by key), and an optional trailing `^blockId`.
 */
// Utility functions
function normalizeTaskFrontmatter(input: TaskFrontmatterInit): TaskFrontmatter {
  return {
    type: TASK_NOTE_TYPE,
    status: normalizeStatus(input.status),
    project: normalizeOptionalString(input.project),
    due: normalizeDue(input.due),
    priority: normalizeOptionalString(input.priority),
    mcpSyncState: normalizeOptionalString(
      input.mcpSyncState,
    ) as TaskSyncState | null,
  }
}

function normalizeStatus(status: unknown): string {
  if (typeof status === 'string') {
    return status.trim()
  }
  return 'todo'
}

function normalizeOptionalString(value: unknown): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed === '' ? null : trimmed
  }
  return null
}

function normalizeDue(due: unknown): string | null {
  if (typeof due === 'string') {
    const trimmed = due.trim()
    return trimmed === '' ? null : trimmed
  }
  if (due instanceof Date) {
    return toDateOnly(due)
  }
  if (typeof due === 'number') {
    const date = new Date(due)
    if (!Number.isNaN(date.getTime())) {
      return toDateOnly(date)
    }
  }
  return null
}

function toDateOnly(date: Date): string {
  return date.toISOString().split('T')[0] ?? ''
}

function statusToCheckbox(status: string): TaskCheckbox {
  switch (status.toLowerCase()) {
    case 'done':
    case 'completed':
    case 'x':
      return 'x'
    case 'in_progress':
    case 'progress':
    case '>':
      return '>'
    case 'cancelled':
    case 'canceled':
    case '-':
      return '-'
    case 'deferred':
    case 'defer':
    case '~':
      return '~'
    default:
      return ' '
  }
}

function checkboxToStatus(checkbox: TaskCheckbox): string {
  switch (checkbox) {
    case 'x':
    case 'X':
      return 'done'
    case '>':
      return 'in_progress'
    case '-':
      return 'cancelled'
    case '~':
      return 'deferred'
    default:
      return 'todo'
  }
}

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

function normalizeExtraFields(
  fields: Record<string, string | null | undefined> | undefined,
): InlineTaskExtraFields {
  if (!fields) return {}
  const out: InlineTaskExtraFields = {}
  for (const [key, value] of Object.entries(fields)) {
    if (value != null && value !== '') {
      out[key] = collapseWhitespace(value)
    }
  }
  return out
}

interface LineSet {
  lines: string[]
  trailingNewline: boolean
}

function toLineSet(body: string): LineSet {
  const lines = body.split('\n')
  const trailingNewline = body.endsWith('\n') && lines.length > 0
  if (trailingNewline && lines.at(-1) === '') {
    lines.pop()
  }
  return { lines, trailingNewline }
}

export function formatInlineTaskLine(input: InlineTaskFormatInput): string {
  const frontmatter = normalizeTaskFrontmatter({
    status: input.frontmatter.status,
    project: input.frontmatter.project,
    due: input.frontmatter.due,
    priority: input.frontmatter.priority,
    mcpSyncState: input.frontmatter.mcpSyncState,
  })

  const indent = input.indent ?? ''
  const bullet = input.bullet ?? '-'
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

  let line = segments.join(' ')
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
  note: Pick<Note, 'id' | 'body'>,
): InlineTask[] {
  const { lines } = toLineSet(note.body)
  const tasks: InlineTask[] = []
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    if (line == null) continue

    const match = line.match(/^(\s*)([-*])\s+\[([ xX>\-~])\]\s+(.*)$/)
    if (!match) continue

    const indent = match[1] ?? ''
    const bullet = match[2] as '-' | '*'
    const checkbox = match[3] as TaskCheckbox
    const content = match[4] ?? ''

    // Extract block ID if present (format: ^blockId at end of line)
    const blockIdMatch = content.match(/\s+ \^([a-zA-Z0-9_-]+)\s*$/)
    const blockId = blockIdMatch?.[1] ?? null
    const contentWithoutBlockId = blockIdMatch
      ? content.slice(0, blockIdMatch.index).trim()
      : content

    // Extract inline fields (format: key:: value)
    const extractedFields = extractInlineFields(contentWithoutBlockId)
    const frontmatter = normalizeTaskFrontmatter({
      status: checkboxToStatus(checkbox),
      project: extractedFields.project,
      due: extractedFields.due,
      priority: extractedFields.priority,
      mcpSyncState: extractedFields.mcpSyncState,
    })

    // Only include lines that have the correct task type
    if (extractedFields.type?.toLowerCase() !== TASK_NOTE_TYPE) continue

    // Extract task text (everything before the first inline field)
    const textMatch = contentWithoutBlockId.match(/^(.+?)\s+\w+::/)
    const text = textMatch
      ? (textMatch[1]?.trim() ?? '')
      : contentWithoutBlockId.trim()

    tasks.push({
      noteId: note.id,
      line: index,
      indent,
      bullet,
      checkbox,
      text,
      blockId,
      frontmatter,
      extraFields: extractedFields.extra,
      raw: line,
    })
  }
  return tasks
}

interface ExtractedFields {
  type?: string
  status?: string
  project?: string
  due?: string
  priority?: string
  mcpSyncState?: string
  extra: InlineTaskExtraFields
}

/**
 * Extract inline Dataview-style fields from a line of text.
 *
 * Fields are in the format `key:: value` and can appear anywhere in the line.
 * This function extracts all fields and returns them as a structured object.
 *
 * @param line - The line to extract fields from
 * @returns An object containing extracted fields and any remaining extra fields
 */
function extractInlineFields(line: string): ExtractedFields {
  const fields: ExtractedFields = {
    extra: {},
  }

  // Match all inline fields in the format key:: value
  // This regex handles escaped colons and quoted values
  const fieldRegex = /(\w+(?:\.\w+)*)\s*::\s*([^=]+?)(?=\s+\w+::|\s*$)/g
  let match

  while ((match = fieldRegex.exec(line)) !== null) {
    const key = match[1]!
    let value = match[2]?.trim() ?? ''

    // Remove surrounding quotes if present
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }

    switch (key) {
      case 'type':
        fields.type = value
        break
      case 'status':
        fields.status = value
        break
      case 'project':
        fields.project = value
        break
      case 'due':
        fields.due = value
        break
      case 'priority':
        fields.priority = value
        break
      case 'mcpSyncState':
        fields.mcpSyncState = value
        break
      default:
        if (key) {
          fields.extra[key] = value
        }
        break
    }
  }

  return fields
}
