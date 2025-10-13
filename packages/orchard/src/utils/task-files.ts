import type { NoteId, TaskNote } from "@orchard/core"
import type { TFile, Vault } from "obsidian"

export const TASKS_ROOT_DIR = "tasks"
export const TASKS_INDEX_NOTE = "Tasks/README.md"
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

const TASK_INDEX_HEADER = `---
title: Orchard Tasks
---
# Orchard Tasks

Orchard manages task notes under the \`${TASKS_ROOT_DIR}/\` folder and mirrors them as inline tasks using Dataview metadata.

- [[${TASKS_BASE_PATH}|Open the Orchard Tasks Base]]

## Inline Tasks
`

export function generateTaskNoteId(title: string, date = new Date()): NoteId {
  const year = date.getUTCFullYear()
  const baseSlug = slugifyTaskSegment(title)
  const slug = baseSlug || "task"
  const suffix = timestampSuffix(date)
  const fileName = `${slug}-${suffix}`.toLowerCase()
  return `${TASKS_ROOT_DIR}/${year}/${fileName}.md` as NoteId
}

export function expectedTaskFilePath(
  note: Pick<TaskNote, "id" | "title" | "updatedAt">,
  now = new Date(),
): NoteId {
  const year = resolveYear(note.updatedAt, now)
  const baseName = extractBasename(note.id) ?? note.title ?? "task"
  const baseSlug =
    slugifyTaskSegment(baseName) || slugifyTaskSegment(note.title) || "task"
  const suffix = hashSuffix(note.id)
  const slug = suffix ? `${baseSlug}-${suffix}` : baseSlug
  return `${TASKS_ROOT_DIR}/${year}/${slug}.md`.toLowerCase() as NoteId
}

export async function ensureTaskBaseDefinition(
  vault: Vault,
): Promise<TaskBaseDefinition> {
  await ensureDirectory(vault, getDirname(TASKS_BASE_PATH))
  const adapter = vault.adapter
  const path = normalizeVaultPath(TASKS_BASE_PATH)
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

export async function ensureTaskIndexNote(vault: Vault): Promise<void> {
  const path = normalizeVaultPath(TASKS_INDEX_NOTE)
  await ensureDirectory(vault, getDirname(path))
  const file = vault.getAbstractFileByPath(path)
  if (isVaultFile(file)) {
    const existing = await vault.read(file)
    if (existing.startsWith(TASK_INDEX_HEADER)) return
    const preserved = extractInlineTasksSection(existing)
    const nextContent = `${TASK_INDEX_HEADER}${preserved}`
    await vault.modify(file, nextContent)
    return
  }
  await vault.create(path, `${TASK_INDEX_HEADER}\n`)
}

function extractInlineTasksSection(content: string): string {
  const marker = "## Inline Tasks"
  const index = content.indexOf(marker)
  if (index === -1) return "\n"
  const afterMarker = content.slice(index + marker.length)
  return `\n${afterMarker.replace(/^\r?\n?/, "")}`
}

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

function deepEqual(a: unknown, b: unknown): boolean {
  return stableStringify(a) === stableStringify(b)
}

function stableStringify(value: unknown): string {
  return JSON.stringify(sortValue(value), null, 2)
}

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

function timestampSuffix(date: Date): string {
  const year = date.getUTCFullYear()
  const month = `${date.getUTCMonth() + 1}`.padStart(2, "0")
  const day = `${date.getUTCDate()}`.padStart(2, "0")
  const hour = `${date.getUTCHours()}`.padStart(2, "0")
  const minute = `${date.getUTCMinutes()}`.padStart(2, "0")
  const second = `${date.getUTCSeconds()}`.padStart(2, "0")
  return `${year}${month}${day}${hour}${minute}${second}`
}

function resolveYear(updatedAt: number, now: Date): number {
  if (Number.isFinite(updatedAt)) {
    const date = new Date(updatedAt)
    if (!Number.isNaN(date.getTime())) {
      return date.getFullYear()
    }
  }
  return now.getFullYear()
}

function extractBasename(id: string): string | null {
  const normalized = id.replace(/\\+/g, "/")
  const parts = normalized.split("/")
  const last = parts[parts.length - 1]
  if (!last) return null
  return last.replace(/\.md$/i, "")
}

function hashSuffix(value: string): string {
  if (!value) return ""
  let hash = 0
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 33 + value.charCodeAt(i)) >>> 0
  }
  return hash.toString(36).slice(0, 6)
}

function getDirname(path: string): string {
  const normalized = normalizeVaultPath(path)
  const idx = normalized.lastIndexOf("/")
  return idx === -1 ? "" : normalized.slice(0, idx)
}

export function isVaultFile(file: unknown): file is TFile {
  if (!file || typeof file !== "object") return false
  return (
    typeof (file as { path?: unknown }).path === "string" &&
    typeof (file as { stat?: unknown }).stat === "object" &&
    (file as { stat?: unknown }).stat !== null
  )
}

function normalizeVaultPath(path: string): string {
  if (!path) return ""
  let normalized = path.trim()
  normalized = normalized.replace(/\\+/g, "/")
  normalized = normalized.replace(/\/+/g, "/")
  if (normalized.startsWith("./")) normalized = normalized.slice(2)
  if (normalized.endsWith("/")) normalized = normalized.slice(0, -1)
  return normalized
}
