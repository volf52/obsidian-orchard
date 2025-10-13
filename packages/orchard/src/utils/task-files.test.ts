import { describe, expect, it } from "bun:test"
import {
  TASKS_BASE_PATH,
  TASKS_INDEX_NOTE,
  TASKS_ROOT_DIR,
  ensureTaskBaseDefinition,
  ensureTaskIndexNote,
  expectedTaskFilePath,
  generateTaskNoteId,
} from "@/utils/task-files"
import type { TaskNote } from "@orchard/core"
import type { Vault } from "obsidian"

class MockAdapter {
  private vault: MockVault

  constructor(vault: MockVault) {
    this.vault = vault
  }

  async exists(path: string): Promise<boolean> {
    return this.vault.hasPath(path)
  }

  async read(path: string): Promise<string> {
    const data = this.vault.readRaw(path)
    if (data == null) throw new Error(`Missing file: ${path}`)
    return data
  }

  async write(path: string, data: string): Promise<void> {
    this.vault.writeRaw(path, data)
  }
}

class MockVault {
  adapter: MockAdapter
  private files = new Map<string, { data: string; file: MockFile }>()
  private folders = new Set<string>()

  constructor() {
    this.adapter = new MockAdapter(this)
  }

  getAbstractFileByPath(path: string) {
    const normalized = normalize(path)
    return this.files.get(normalized)?.file ?? null
  }

  async create(path: string, data: string) {
    const normalized = normalize(path)
    const file = createMockFile(normalized)
    this.files.set(normalized, { data, file })
    return file
  }

  async read(file: MockFile): Promise<string> {
    return this.files.get(file.path)?.data ?? ""
  }

  async modify(file: MockFile, data: string): Promise<void> {
    const stored = this.files.get(file.path)
    if (!stored) throw new Error("missing file")
    stored.data = data
  }

  async createFolder(path: string): Promise<void> {
    const normalized = normalize(path)
    this.folders.add(normalized)
  }

  hasPath(path: string): boolean {
    const normalized = normalize(path)
    return this.files.has(normalized) || this.folders.has(normalized)
  }

  readRaw(path: string): string | null {
    const normalized = normalize(path)
    return this.files.get(normalized)?.data ?? null
  }

  writeRaw(path: string, data: string): void {
    const normalized = normalize(path)
    let entry = this.files.get(normalized)
    if (!entry) {
      entry = { data: "", file: createMockFile(normalized) }
      this.files.set(normalized, entry)
    }
    entry.data = data
  }
}

interface MockFile {
  path: string
  name: string
  basename: string
  extension: string
  stat: { ctime: number; mtime: number; size: number }
  vault: Vault | null
  parent: null
}

function createMockFile(path: string): MockFile {
  const normalized = normalize(path)
  const name = normalized.split("/").pop() ?? normalized
  return {
    path: normalized,
    name,
    basename: name.replace(/\.md$/, ""),
    extension: name.split(".").pop() ?? "md",
    stat: { ctime: Date.now(), mtime: Date.now(), size: 0 },
    vault: null,
    parent: null,
  }
}

function normalize(path: string): string {
  if (!path) return ""
  let normalized = path.trim()
  normalized = normalized.replace(/\\+/g, "/")
  normalized = normalized.replace(/\/+/g, "/")
  if (normalized.startsWith("./")) normalized = normalized.slice(2)
  if (normalized.endsWith("/")) normalized = normalized.slice(0, -1)
  return normalized
}

describe("task file helpers", () => {
  it("generates task note ids", () => {
    const date = new Date("2025-03-04T05:06:07Z")
    const id = generateTaskNoteId("My Task", date)
    expect(id).toBe(`${TASKS_ROOT_DIR}/2025/my-task-20250304050607.md`)
  })

  it("derives expected task file paths", () => {
    const note = {
      id: "Projects/My Task.md",
      title: "My Task",
      updatedAt: new Date("2024-02-15T10:00:00Z").getTime(),
    } as TaskNote
    const expected = expectedTaskFilePath(note, new Date("2024-01-01T00:00:00Z"))
    expect(expected).toMatch(/^tasks\/2024\/my-task-[a-z0-9]+\.md$/)
  })

  it("ensures base definition with required columns", async () => {
    const vault = new MockVault()
    const base = await ensureTaskBaseDefinition(vault as unknown as Vault)
    expect(base.columns.map((c) => c.key)).toEqual([
      "status",
      "project",
      "due",
      "priority",
      "mcpSyncState",
    ])
    const stored = vault.readRaw(TASKS_BASE_PATH)
    expect(stored).toContain("\"status\"")
    expect(stored).toContain("\"mcpSyncState\"")
  })

  it("creates and updates the task index note", async () => {
    const vault = new MockVault()
    await ensureTaskIndexNote(vault as unknown as Vault)
    const file = vault.getAbstractFileByPath(TASKS_INDEX_NOTE)
    expect(file).not.toBeNull()
    const content = await vault.read(file as MockFile)
    expect(content).toContain("## Inline Tasks")

    // Append inline tasks and ensure they are preserved when syncing the header
    const augmented = `${content.trim()}\n- [ ] Sample inline type:: orchard-task status:: todo note:: [[tasks/sample]]\n`
    await vault.modify(file as MockFile, augmented)
    await ensureTaskIndexNote(vault as unknown as Vault)
    const updated = await vault.read(file as MockFile)
    const lines = content.split("\n")
    const headerEnd = lines.indexOf("## Inline Tasks")
    const headerPrefix = lines.slice(0, headerEnd + 1).join("\n")
    expect(updated.startsWith(headerPrefix)).toBe(true)
    expect(updated).toContain("note:: [[tasks/sample]]")
  })
})
