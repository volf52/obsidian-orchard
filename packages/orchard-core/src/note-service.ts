import { computeNoteVersion } from "./hash"
import type {
  CreateNoteInput,
  EventBus,
  Note,
  NoteContent,
  NoteFilters,
  NoteId,
  NoteVersion,
  UpdateNoteMutation,
  VaultAdapter,
} from "./types"

/**
 * Normalize a note identifier into the canonical NoteId form.
 *
 * @param id - The input identifier or path to normalize
 * @returns The identifier normalized to use forward slashes, ensured to end with `.md`, and lowercased
 */
function normalizeId(id: string): NoteId {
  let n = id.trim()
  if (!n.endsWith(".md")) n = `${n}.md`
  n = n.replace(/\\+/g, "/")
  n = n.toLowerCase()
  return n as NoteId
}

interface ConstructDeps {
  adapter: VaultAdapter
  events?: EventBus
  clock?: () => number
}

export class NoteService {
  private adapter: VaultAdapter
  private events?: EventBus
  private clock: () => number

  constructor(deps: ConstructDeps) {
    this.adapter = deps.adapter
    this.events = deps.events
    this.clock = deps.clock ?? (() => Date.now())
  }

  async list(filters?: NoteFilters): Promise<Note[]> {
    const infos = await this.adapter.list()
    const out: Note[] = []
    for (const info of infos) {
      const raw = await this.adapter.readFile(info.id)
      if (raw == null) continue
      const parsed = parseRaw(raw)
      const note: Note = {
        id: info.id,
        title:
          parsed.frontmatter.title?.toString() ??
          deriveTitle(info.id, parsed.body),
        tags: Array.isArray(parsed.frontmatter.tags)
          ? parsed.frontmatter.tags.filter((t) => typeof t === "string")
          : [],
        updatedAt: info.mtime,
        frontmatter: parsed.frontmatter,
        body: parsed.body,
        version: computeNoteVersion(parsed.frontmatter, parsed.body),
      }
      if (applyFilters(note, filters)) out.push(note)
    }
    return out
  }

  async read(id: NoteId): Promise<Note | null> {
    const norm = normalizeId(id)
    const raw = await this.adapter.readFile(norm)
    if (raw == null) return null
    const info = await this.adapter.fileInfo(norm)
    if (!info) return null
    const parsed = parseRaw(raw)
    return {
      id: norm,
      title:
        parsed.frontmatter.title?.toString() ?? deriveTitle(norm, parsed.body),
      tags: Array.isArray(parsed.frontmatter.tags)
        ? parsed.frontmatter.tags.filter((t) => typeof t === "string")
        : [],
      updatedAt: info.mtime,
      frontmatter: parsed.frontmatter,
      body: parsed.body,
      version: computeNoteVersion(parsed.frontmatter, parsed.body),
    }
  }

  async create(input: CreateNoteInput): Promise<Note> {
    const id = normalizeId(input.id)
    const existing = await this.adapter.readFile(id)
    if (existing != null) {
      throw new Error(`Note already exists: ${id}`)
    }
    const frontmatter = { ...(input.frontmatter ?? {}) }
    if (input.title) frontmatter.title = input.title
    if (input.tags) frontmatter.tags = input.tags
    const body = input.body ?? ""
    const raw = serialize(frontmatter, body)
    await this.adapter.writeFile(id, raw)
    const note = await this.read(id)
    if (!note) throw new Error("Failed to read back created note")
    this.events?.publish({ type: "note.created", note })
    return note
  }

  async update(
    id: NoteId,
    mutation: UpdateNoteMutation,
    expectedVersion: NoteVersion,
  ): Promise<Note> {
    const current = await this.read(id)
    if (!current) throw new Error(`Note missing: ${id}`)
    if (current.version !== expectedVersion) {
      throw new Error("VersionConflict: stale version provided")
    }
    const frontmatter = { ...current.frontmatter }
    if (mutation.frontmatter) Object.assign(frontmatter, mutation.frontmatter)
    if (mutation.title !== undefined) frontmatter.title = mutation.title
    if (mutation.tags !== undefined) frontmatter.tags = mutation.tags
    const body = mutation.body !== undefined ? mutation.body : current.body

    const newVersion = computeNoteVersion(frontmatter, body)
    if (newVersion === current.version) {
      return current // idempotent no-op
    }
    const raw = serialize(frontmatter, body)
    await this.adapter.writeFile(current.id, raw)
    const updated = await this.read(current.id)
    if (!updated) throw new Error("Failed to read back updated note")
    this.events?.publish({
      type: "note.updated",
      note: updated,
      previousVersion: current.version,
    })
    return updated
  }

  async delete(id: NoteId, expectedVersion: NoteVersion): Promise<boolean> {
    const current = await this.read(id)
    if (!current) return false
    if (current.version !== expectedVersion) {
      throw new Error("VersionConflict: stale version provided")
    }
    const ok = await this.adapter.deleteFile(current.id)
    if (ok) {
      this.events?.publish({
        type: "note.deleted",
        id: current.id,
        previousVersion: current.version,
      })
    }
    return ok
  }
}

/**
 * Determines whether a note matches the provided filters.
 *
 * If `filters` is omitted, the note always matches. When `filters.tag` is set the note must include that tag. When `filters.search` is set the query is matched case-insensitively against the note's title and body.
 *
 * @param note - The note to test
 * @param filters - Optional filters to apply (`tag` and/or `search`)
 * @returns `true` if the note satisfies all provided filters, `false` otherwise.
 */
function applyFilters(note: Note, filters?: NoteFilters): boolean {
  if (!filters) return true
  if (filters.tag && !note.tags.includes(filters.tag)) return false
  if (filters.search) {
    const q = filters.search.toLowerCase()
    if (
      !note.title.toLowerCase().includes(q) &&
      !note.body.toLowerCase().includes(q)
    )
      return false
  }
  return true
}

interface ParsedRaw extends NoteContent {}

/**
 * Parses a note file into a frontmatter object and the remaining body text.
 *
 * Recognizes an optional YAML-like frontmatter block delimited by `---\n` and a closing `\n---\n`. Frontmatter lines use `key: value` syntax and are converted to JavaScript values: `true`/`false` become booleans, numeric tokens become numbers, empty values become `""`, and inline JSON arrays/objects (e.g. `["a","b"]` or `{"k":1}`) are parsed into their corresponding structures; other values remain strings.
 *
 * @param raw - The full file content to parse, possibly including a frontmatter block followed by body text.
 * @returns An object with `frontmatter` (a record of parsed keys to values) and `body` (the text after the frontmatter or the original `raw` if no frontmatter is present).
 */
function parseRaw(raw: string): ParsedRaw {
  if (raw.startsWith("---\n")) {
    const end = raw.indexOf("\n---\n", 4)
    if (end !== -1) {
      const fmBlock = raw.slice(4, end)
      const body = raw.slice(end + 5) // skip closing ---\n
      const frontmatter: Record<string, unknown> = {}
      for (const line of fmBlock.split(/\n/)) {
        const m = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/)
        if (!m || !m[1]) continue
        const key = m[1] as string // regex ensures group 1
        let value: unknown = m[2]
        if (value === "") value = ""
        else if (value === "true") value = true
        else if (value === "false") value = false
        else if (!Number.isNaN(Number(value))) value = Number(value)
        // Support JSON arrays/objects stored inline (e.g. tags: ["a","b"]).
        else if (typeof value === "string" && /^(\[|\{)/.test(value.trim())) {
          try {
            const parsed = JSON.parse(value)
            value = parsed
          } catch {
            // leave as string if JSON.parse fails
          }
        }
        frontmatter[key] = value
      }
      return { frontmatter, body }
    }
  }
  return { frontmatter: {}, body: raw }
}

/**
 * Serialize a frontmatter object and body into a markdown-like document with a YAML-style frontmatter block.
 *
 * @param frontmatter - Mapping of frontmatter keys to values; if empty, no frontmatter block is included.
 * @param body - The document body that appears after the frontmatter block.
 * @returns The document string consisting of a `---` delimited frontmatter section (keys sorted) followed by the body, or just the body when `frontmatter` is empty.
 */
function serialize(frontmatter: Record<string, unknown>, body: string): string {
  const keys = Object.keys(frontmatter)
  if (keys.length === 0) return body
  const lines: string[] = ["---"]
  for (const k of keys.sort()) {
    const v = frontmatter[k]
    lines.push(`${k}: ${primitiveToString(v)}`)
  }
  lines.push("---", body)
  return lines.join("\n")
}

/**
 * Converts a value into its string representation suitable for frontmatter serialization.
 *
 * @param v - The value to serialize (may be primitive, object, null, or undefined)
 * @returns An empty string for `null`/`undefined`, JSON for objects, or the result of `String(v)` for other values
 */
function primitiveToString(v: unknown): string {
  if (v == null) return ""
  if (typeof v === "object") return JSON.stringify(v)
  return String(v)
}

/**
 * Derives a human-readable title for a note from its id and body.
 *
 * Uses the first non-empty line of `body` (trimmed) up to 120 characters; if no such line exists, returns `id` with a trailing `.md` removed.
 *
 * @param id - Note identifier (file name, typically ending with `.md`).
 * @param body - Raw note content.
 * @returns The first non-empty line of `body` (trimmed and truncated to 120 characters) or the `id` without a `.md` suffix.
 */
function deriveTitle(id: string, body: string): string {
  const base = id.replace(/\.md$/, "")
  const firstLine = body.split(/\n/)[0]?.trim()
  if (firstLine && firstLine.length > 0) return firstLine.slice(0, 120)
  return base
}
