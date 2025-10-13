import type { App } from "obsidian"
import type {
  InlineTask,
  InlineTaskService,
  NoteId,
  TaskNote,
  TaskNoteService,
} from "@orchard/core"
import {
  ensureDirectory,
  ensureTaskBaseDefinition,
  ensureTaskIndexNote,
  expectedTaskFilePath,
  isVaultFile,
} from "@/utils/task-files"

export async function migrateTaskNotes(
  app: App,
  tasks: TaskNoteService,
  inlineTasks: InlineTaskService,
  now = new Date(),
): Promise<void> {
  const { vault } = app
  await ensureTaskBaseDefinition(vault)
  const notes = await tasks.list()
  for (const note of notes) {
    await relocateTaskNote(vault, note, now)
  }
  await ensureTaskIndexNote(vault)
  await syncInlineTaskIndex(inlineTasks, notes)
}

async function relocateTaskNote(
  vault: App["vault"],
  note: TaskNote,
  now: Date,
): Promise<void> {
  const expected = expectedTaskFilePath(note, now)
  if (note.id === expected) return
  const file = vault.getAbstractFileByPath(note.id)
  if (!isVaultFile(file)) return
  const target = expected
  const targetDir = target.split("/").slice(0, -1).join("/")
  await ensureDirectory(vault, targetDir)
  const collision = vault.getAbstractFileByPath(target)
  if (isVaultFile(collision) && collision !== file) {
    // If there's already a file in the desired location, skip to avoid data loss.
    return
  }
  await vault.rename(file, target)
}

async function syncInlineTaskIndex(
  inlineTasks: InlineTaskService,
  notes: TaskNote[],
): Promise<void> {
  const indexNoteId = toIndexNoteId()
  const existing = await inlineTasks.list(indexNoteId)
  const existingByKey = new Map<string, InlineTask>()
  for (const task of existing) {
    const key = extractNoteKey(task.extraFields.note)
    if (key) existingByKey.set(key, task)
  }

  const desiredKeys = new Set<string>()
  for (const note of notes) {
    const key = toNoteKey(note.id)
    desiredKeys.add(key)
    const current = existingByKey.get(key)
    const noteLink = formatNoteLink(note.id)
    const text = note.title ?? fallbackTitle(note.id)
    const extraFields = { ...(current?.extraFields ?? {}), note: noteLink }
    if (current) {
      await inlineTasks.update(
        { noteId: indexNoteId, blockId: current.blockId ?? undefined, line: current.line },
        {
          text,
          status: note.frontmatter.status,
          project: note.frontmatter.project,
          due: note.frontmatter.due,
          priority: note.frontmatter.priority,
          mcpSyncState: note.frontmatter.mcpSyncState,
          extraFields,
        },
      )
    } else {
      await inlineTasks.create({
        noteId: indexNoteId,
        text,
        status: note.frontmatter.status,
        project: note.frontmatter.project,
        due: note.frontmatter.due,
        priority: note.frontmatter.priority,
        mcpSyncState: note.frontmatter.mcpSyncState,
        extraFields: { note: noteLink },
      })
    }
  }

  for (const task of existing) {
    const key = extractNoteKey(task.extraFields.note)
    if (key && !desiredKeys.has(key)) {
      await inlineTasks.delete({
        noteId: indexNoteId,
        blockId: task.blockId ?? undefined,
        line: task.line,
      })
    }
  }
}

function toIndexNoteId(): NoteId {
  return "tasks/readme.md" as NoteId
}

function toNoteKey(id: string): string {
  return id.replace(/\.md$/i, "").toLowerCase()
}

function formatNoteLink(id: string): string {
  const base = id.replace(/\.md$/i, "")
  return `[[${base}]]`
}

function extractNoteKey(raw: string | undefined): string | null {
  if (!raw) return null
  const trimmed = raw.trim()
  const match = trimmed.match(/^\[\[([^\]|]+)(?:\|[^\]]*)?\]\]$/)
  const value = match ? match[1] : trimmed
  if (!value) return null
  return value.replace(/\.md$/i, "").toLowerCase()
}

function fallbackTitle(id: string): string {
  const base = id.replace(/\.md$/i, "")
  const segments = base.split("/")
  return segments[segments.length - 1] ?? base
}
