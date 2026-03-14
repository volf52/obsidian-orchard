import type { App } from 'obsidian'
import type {
  InlineTask,
  InlineTaskService,
  NoteId,
  TaskNote,
  TaskNoteService,
} from '@orchard/core'
import {
  ensureDirectory,
  ensureTaskBaseDefinition,
  ensureTaskIndexNote,
  expectedTaskFilePath,
  isVaultFile,
} from '@/utils/task-files'

/**
 * Orchestrates migration of task notes: ensures base structures, relocates notes to their expected paths, and synchronizes the inline task index.
 *
 * @param app - The application instance providing access to the vault
 * @param tasks - Service for listing and managing task notes
 * @param inlineTasks - Service for managing inline task entries (the index)
 * @param now - Reference timestamp used when computing expected file paths (defaults to current time)
 */
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

/**
 * Move a task note file in the vault to its expected path determined from the given date.
 *
 * Ensures the target directory exists and skips relocation when the note is already at the expected path
 * or when a different file occupies the target path to avoid overwriting.
 *
 * @param note - The TaskNote to relocate if its current id differs from the computed expected path.
 * @param now - Reference date used to compute the note's expected file path.
 */
async function relocateTaskNote(
  vault: App['vault'],
  note: TaskNote,
  now: Date,
): Promise<void> {
  const expected = expectedTaskFilePath(note, now)
  if (note.id === expected) return
  const file = vault.getAbstractFileByPath(note.id)
  if (!isVaultFile(file)) return
  const target = expected
  const targetDir = target.split('/').slice(0, -1).join('/')
  await ensureDirectory(vault, targetDir)
  const collision = vault.getAbstractFileByPath(target)
  if (isVaultFile(collision) && collision !== file) {
    // If there's already a file in the desired location, skip to avoid data loss.
    return
  }
  await vault.rename(file, target)
}

/**
 * Synchronizes the inline task index note with a set of TaskNote records.
 *
 * Ensures the index note (tasks/readme.md) contains one inline task per provided note by creating missing entries, updating existing entries with the note's title and frontmatter fields (status, project, due, priority, mcpSyncState), and deleting index entries that no longer correspond to any note. When updating, preserves existing block/line placement if present and stores a wiki-style link to the source note in the task's `extraFields.note`.
 *
 * @param inlineTasks - Service used to list, create, update, and delete inline tasks in the index note
 * @param notes - Array of TaskNote objects that should be represented in the inline task index
 */
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
        {
          noteId: indexNoteId,
          blockId: current.blockId ?? undefined,
          line: current.line,
        },
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

/**
 * Gets the canonical index note ID for the task index.
 *
 * @returns The fixed note ID "tasks/readme.md".
 */
function toIndexNoteId(): NoteId {
  return 'tasks/readme.md' as NoteId
}

/**
 * Normalize a note identifier into a lowercase key without a trailing `.md` extension.
 *
 * @param id - The note identifier or path (may include a `.md` extension)
 * @returns The normalized note key: lowercase and with a trailing `.md` removed
 */
function toNoteKey(id: string): string {
  return id.replace(/\.md$/i, '').toLowerCase()
}

/**
 * Format a note identifier as a wiki-style double-bracket link.
 *
 * @param id - The note identifier or file path (may include a trailing `.md`)
 * @returns A wiki link in the form `[[name]]` using the identifier with any trailing `.md` removed
 */
function formatNoteLink(id: string): string {
  const base = id.replace(/\.md$/i, '')
  return `[[${base}]]`
}

/**
 * Extracts a normalized note key from a raw string or wiki-style link.
 *
 * Accepts plain text, a filename (e.g., "Note.md"), or a wiki link of the form `[[name]]` or `[[name|text]]`.
 *
 * @param raw - The input string to parse; may be undefined.
 * @returns The normalized note key: the value lowercased with a trailing `.md` removed, or `null` if `raw` is undefined, empty, or contains no parsable value.
 */
function extractNoteKey(raw: string | undefined): string | null {
  if (!raw) return null
  const trimmed = raw.trim()
  const match = trimmed.match(/^\[\[([^\]|]+)(?:\|[^\]]*)?\]\]$/)
  const value = match ? match[1] : trimmed
  if (!value) return null
  return value.replace(/\.md$/i, '').toLowerCase()
}

/**
 * Derives a display title from a note id or file path.
 *
 * @param id - Note identifier or file path (may include directories and a trailing `.md`)
 * @returns The last path segment with any trailing `.md` removed
 */
function fallbackTitle(id: string): string {
  const base = id.replace(/\.md$/i, '')
  const segments = base.split('/')
  return segments[segments.length - 1] ?? base
}
