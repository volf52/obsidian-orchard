import type { NoteId, TaskNote } from "@orchard/core"
import type { TFile, Vault } from "obsidian"

export const TASKS_ROOT_DIR = "tasks"
export const TASKS_INDEX_NOTE = "tasks/readme.md"
export const TASKS_BASE_PATH = ".obsidian/bases/orchard-tasks.base.json"

export interface TaskBaseColumn {
  key: string
  label: string
  type: string
}

export interface TaskBaseDefinition extends Record<string, unknown> {
  name: string
  version: number
  description: string
  columns: TaskBaseColumn[]
}

const TASK_BASE_COLUMNS: TaskBaseColumn[] = [
  { key: "status", label: "Status", type: "text" },
  { key: "project", label: "Project", type: "text" },
  { key: "due", label: "Due", type: "date" },
  { key: "priority", label: "Priority", type: "text" },
  { key: "mcpSyncState", label: "MCP Sync State", type: "text" },
]

const DEFAULT_TASK_BASE: TaskBaseDefinition = {
  name: "Orchard Tasks",
  version: 1,
  description: "Managed tasks created by the Orchard plugin.",
  columns: TASK_BASE_COLUMNS,
}

const createTaskIndexHeader = (
  rootDir: string,
  basePath: string,
): string => `---
title: Orchard Tasks
---
# Orchard Tasks

Orchard manages task notes under the \`${rootDir}/\` folder and mirrors them as inline tasks using Dataview metadata.

- [[${basePath}|Open the Orchard Tasks Base]]

## Inline Tasks
`

/**
 * Builds a normalized task note identifier (path) from a title and date.
 *
 * Falls back to "task" when the title produces an empty slug and uses the UTC year and a timestamp suffix derived from `date`.
 *
 * @param title - The task title used to create a URL-safe slug segment
 * @param date - The date used to determine the UTC year and timestamp suffix; defaults to the current date
 * @param rootDir - Root directory for task notes; defaults to TASKS_ROOT_DIR
 * @returns A lowercase vault-relative path of the form `<root>/<YYYY>/<slug>-<YYYYMMDDHHMMSS>.md`
 */
export function generateTaskNoteId(
  title: string,
  date = new Date(),
  rootDir: string = TASKS_ROOT_DIR,
): NoteId {
  const year = date.getUTCFullYear()
  const baseSlug = slugifyTaskSegment(title)
  const slug = baseSlug || "task"
  const suffix = timestampSuffix(date)
  const fileName = `${slug}-${suffix}`.toLowerCase()
  const normalizedRoot = normalizeRootDir(rootDir)
  return `${normalizedRoot}/${year}/${fileName}.md`.toLowerCase() as NoteId
}

/**
 * Compute the expected vault file path for a task note based on its id, title, and update timestamp.
 *
 * @param note - Object containing `id`, `title`, and `updatedAt`; these fields are used to determine the filename slug and year directory.
 * @param now - Fallback reference date used when `note.updatedAt` is missing or invalid.
 * @param rootDir - Root directory for task notes (defaults to the package's tasks root).
 * @returns The normalized, lowercase vault path for the task note in the form `<root>/<year>/<slug>.md`.
 */
export function expectedTaskFilePath(
  note: Pick<TaskNote, "id" | "title" | "updatedAt">,
  now = new Date(),
  rootDir: string = TASKS_ROOT_DIR,
): NoteId {
  const year = resolveYear(note.updatedAt, now)
  const baseName = extractBasename(note.id) ?? note.title ?? "task"
  const baseSlug =
    slugifyTaskSegment(baseName) || slugifyTaskSegment(note.title) || "task"
  const suffix = hashSuffix(note.id)
  const slug = suffix ? `${baseSlug}-${suffix}` : baseSlug
  const normalizedRoot = normalizeRootDir(rootDir)
  return `${normalizedRoot}/${year}/${slug}.md`.toLowerCase() as NoteId
}

/**
 * Ensure the task base definition file exists in the vault and contains the normalized Orchard Tasks base.
 *
 * Creates any missing parent directories, reads and parses an existing JSON definition if present,
 * normalizes the definition, and writes the normalized definition to `basePath` when it is missing
 * or differs from the normalized current file. Returns the normalized (desired) TaskBaseDefinition.
 *
 * @param basePath - Vault path where the task base definition will be stored (defaults to TASKS_BASE_PATH)
 * @returns The normalized TaskBaseDefinition that is present in the vault after the operation
 */
export async function ensureTaskBaseDefinition(
  vault: Vault,
  basePath: string = TASKS_BASE_PATH,
): Promise<TaskBaseDefinition> {
  await ensureDirectory(vault, getDirname(basePath))
  const adapter = vault.adapter
  const path = normalizeVaultPath(basePath)
  let existing: TaskBaseDefinition | undefined
  if (await adapter.exists(path)) {
    try {
      const raw = await adapter.read(path)
      existing = JSON.parse(raw) as TaskBaseDefinition
    } catch {
      existing = undefined
    }
  }

  const desired = normalizeBaseDefinition({ ...existing })
  const currentNormalized = existing ? normalizeBaseDefinition(existing) : null
  if (!currentNormalized || !deepEqual(currentNormalized, desired)) {
    await adapter.write(path, `${JSON.stringify(desired, null, 2)}\n`)
  }
  return desired
}

/**
 * Ensure the task index note exists and begins with the standard Orchard Tasks header while preserving any inline tasks section.
 *
 * If the index note already exists and its content starts with the expected header, no change is made. If the file exists but the header is missing or different, the function prepends the standard header and preserves the existing "Inline Tasks" section. If the file does not exist, it is created with the standard header.
 *
 * @param indexPath - Vault path for the task index note (defaults to TASKS_INDEX_NOTE)
 * @param basePath - Path to the task base definition referenced by the header (defaults to TASKS_BASE_PATH)
 * @param rootDir - Root directory used to generate links inside the header (defaults to TASKS_ROOT_DIR)
 */
export async function ensureTaskIndexNote(
  vault: Vault,
  indexPath: string = TASKS_INDEX_NOTE,
  basePath: string = TASKS_BASE_PATH,
  rootDir: string = TASKS_ROOT_DIR,
): Promise<void> {
  const path = normalizeVaultPath(indexPath).toLowerCase()
  await ensureDirectory(vault, getDirname(path))
  const file = vault.getAbstractFileByPath(path)
  const header = createTaskIndexHeader(rootDir, basePath)
  if (isVaultFile(file)) {
    const existing = await vault.read(file)
    if (existing.startsWith(header)) return
    const preserved = extractInlineTasksSection(existing)
    const nextContent = `${header}${preserved}`
    await vault.modify(file, nextContent)
    return
  }
  if (await vault.adapter.exists(path)) return
  await vault.create(path, `${header}\n`)
}

/**
 * Extracts the content that follows the "## Inline Tasks" section marker from a note.
 *
 * @param content - The full text content of the note
 * @returns The text after the "## Inline Tasks" heading, starting with a single leading newline; returns a single newline if the marker is not present
 */
function extractInlineTasksSection(content: string): string {
  const marker = "## Inline Tasks"
  const index = content.indexOf(marker)
  if (index === -1) return "\n"
  const afterMarker = content.slice(index + marker.length)
  return `\n${afterMarker.replace(/^\r?\n?/, "")}`
}

/**
 * Ensure a folder path exists in the vault, creating any missing directories.
 *
 * Normalizes `dir` (handles backslashes, redundant slashes, leading "./", and trims),
 * then creates each path segment as a folder. Treats `null`, `undefined`, empty string,
 * and "." as no-ops. Folder creation errors for already-existing paths are suppressed.
 *
 * @param dir - Vault path to ensure (may be null or undefined). Leading/trailing slashes and "./" are tolerated.
 */
export async function ensureDirectory(
  vault: Vault,
  dir: string | null | undefined,
) {
  const normalized = normalizeVaultPath(dir ?? "")
  if (!normalized || normalized === ".") return
  const segments = normalized.split("/")
  let current = ""
  for (const segment of segments) {
    if (!segment) continue
    current = current ? `${current}/${segment}` : segment
    try {
      const exists = await vault.adapter.exists(current)
      if (!exists) {
        await vault.createFolder(current)
      }
    } catch {
      try {
        await vault.createFolder(current)
      } catch {
        // Ignore folder creation errors for existing paths
      }
    }
  }
}

/**
 * Produce a normalized TaskBaseDefinition by merging provided values with the default base.
 *
 * @param input - An optional existing base definition or arbitrary object whose top-level keys will override defaults
 * @returns The resulting TaskBaseDefinition with all default fields applied and `columns` set to a fresh copy of the default columns
 */
function normalizeBaseDefinition(
  input: TaskBaseDefinition | Record<string, unknown> | undefined,
): TaskBaseDefinition {
  const base: TaskBaseDefinition = {
    ...DEFAULT_TASK_BASE,
    ...((input ?? {}) as Record<string, unknown>),
    columns: TASK_BASE_COLUMNS.map((col) => ({ ...col })),
  }
  return base
}

/**
 * Determines whether two values are deeply equal.
 *
 * This comparison is based on a stable, deterministic JSON serialization that
 * normalizes object key order and nested structures so semantically equal
 * values compare equal even if object keys are ordered differently.
 *
 * @returns `true` if the values are deeply equal, `false` otherwise.
 */
function deepEqual(a: unknown, b: unknown): boolean {
  return stableStringify(a) === stableStringify(b)
}

/**
 * Serializes a value to JSON using a deterministic key order for stable comparisons.
 *
 * @param value - The value to serialize; object keys are recursively sorted to produce a stable representation.
 * @returns A pretty-printed JSON string of `value` with stable ordering.
 */
function stableStringify(value: unknown): string {
  return JSON.stringify(sortValue(value), null, 2)
}

/**
 * Produce a deep copy of the input with object keys sorted lexicographically at every level.
 *
 * @returns The input value transformed so that plain objects have their keys sorted (recursively). Arrays preserve their original order but have each element processed recursively; primitive values are returned unchanged.
 */
function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortValue)
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(
      ([keyA], [keyB]) => keyA.localeCompare(keyB),
    )
    const sorted: Record<string, unknown> = {}
    for (const [key, val] of entries) {
      sorted[key] = sortValue(val)
    }
    return sorted
  }
  return value
}

/**
 * Converts a string into a filesystem-friendly lowercase slug suitable for task file names.
 *
 * The result contains only ASCII letters, numbers, and hyphens; collapses internal whitespace/underscores/dashes to single hyphens; and has no leading or trailing hyphens.
 *
 * @param input - The source text to convert into a slug
 * @returns The resulting slug; an empty string if no valid characters remain
 */
function slugifyTaskSegment(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9\s-]/g, "")
    .trim()
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
}

/**
 * Creates a UTC timestamp suffix for a date in YYYYMMDDHHMMSS format.
 *
 * @param date - The date to convert (UTC components are used).
 * @returns The timestamp string formatted as `YYYYMMDDHHMMSS`.
 */
function timestampSuffix(date: Date): string {
  const year = date.getUTCFullYear()
  const month = `${date.getUTCMonth() + 1}`.padStart(2, "0")
  const day = `${date.getUTCDate()}`.padStart(2, "0")
  const hour = `${date.getUTCHours()}`.padStart(2, "0")
  const minute = `${date.getUTCMinutes()}`.padStart(2, "0")
  const second = `${date.getUTCSeconds()}`.padStart(2, "0")
  return `${year}${month}${day}${hour}${minute}${second}`
}

/**
 * Normalize a task root directory path and fall back to the default when no value is provided.
 *
 * @param rootDir - The input root directory; leading and trailing slashes will be removed. If falsy, the default `TASKS_ROOT_DIR` is returned.
 * @returns The normalized root directory with no leading or trailing slashes, or `TASKS_ROOT_DIR` when `rootDir` is falsy.
 */
function normalizeRootDir(rootDir: string): string {
  if (!rootDir) return TASKS_ROOT_DIR
  return rootDir.replace(/^\/+|\/+$/g, "")
}

/**
 * Determine the year from an updated timestamp or fall back to a provided date.
 *
 * @param updatedAt - Millisecond epoch timestamp to derive the year from; ignored if not a finite, valid date
 * @param now - Fallback `Date` whose year is used when `updatedAt` is not a valid timestamp
 * @returns The four-digit year extracted from `updatedAt` when valid, otherwise the year of `now`
 */
function resolveYear(updatedAt: number, now: Date): number {
  if (Number.isFinite(updatedAt)) {
    const date = new Date(updatedAt)
    if (!Number.isNaN(date.getTime())) {
      return date.getFullYear()
    }
  }
  return now.getFullYear()
}

/**
 * Extracts the final path segment from a note id or path, excluding a trailing `.md` extension.
 *
 * @param id - A file path or note identifier (may use forward or backslashes)
 * @returns The basename without a `.md` extension, or `null` if no final segment exists
 */
function extractBasename(id: string): string | null {
  const normalized = id.replace(/\\+/g, "/")
  const parts = normalized.split("/")
  const last = parts[parts.length - 1]
  if (!last) return null
  return last.replace(/\.md$/i, "")
}

/**
 * Produce a short, deterministic base36 hash suffix for a string.
 *
 * @param value - The input string; if empty or falsy, an empty string is returned.
 * @returns A lowercase base36 string up to 6 characters derived from `value`, or an empty string when `value` is falsy.
 */
function hashSuffix(value: string): string {
  if (!value) return ""
  let hash = 0
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 33 + value.charCodeAt(i)) >>> 0
  }
  return hash.toString(36).slice(0, 6)
}

/**
 * Get the directory portion of a normalized vault path.
 *
 * @param path - The input path to normalize and extract the directory from.
 * @returns The directory portion of `path` using forward slashes, or an empty string if no directory exists.
 */
function getDirname(path: string): string {
  const normalized = normalizeVaultPath(path)
  const idx = normalized.lastIndexOf("/")
  return idx === -1 ? "" : normalized.slice(0, idx)
}

/**
 * Determines whether a value appears to be an Obsidian vault file (TFile).
 *
 * @param file - The value to test
 * @returns `true` if `file` has a string `path` property and a non-null `stat` object, `false` otherwise.
 */
export function isVaultFile(file: unknown): file is TFile {
  if (!file || typeof file !== "object") return false
  return (
    typeof (file as { path?: unknown }).path === "string" &&
    typeof (file as { stat?: unknown }).stat === "object" &&
    (file as { stat?: unknown }).stat !== null
  )
}

/**
 * Normalize a vault-style path by cleaning separators and trimming leading/trailing markers.
 *
 * Trims whitespace, converts backslashes to forward slashes, collapses consecutive slashes into one,
 * removes a leading "./" if present, and strips a trailing "/" if present. Returns an empty string for
 * falsy or empty input.
 *
 * @param path - The path to normalize
 * @returns The normalized vault path
 */
function normalizeVaultPath(path: string): string {
  if (!path) return ""
  let normalized = path.trim()
  normalized = normalized.replace(/\\+/g, "/")
  normalized = normalized.replace(/\/+/g, "/")
  if (normalized.startsWith("./")) normalized = normalized.slice(2)
  if (normalized.endsWith("/")) normalized = normalized.slice(0, -1)
  return normalized
}