import { describe, expect, it } from "bun:test"
import {
  computeNoteVersion,
  createEventBus,
  createMemoryAdapter,
  NoteService,
} from "@/index"

const c = {
  magenta: (s: string) => `\x1b[35m${s}\x1b[0m`,
}

function banner(title: string) {
  // eslint-disable-next-line no-console
  console.log(c.magenta(`\n=== ${title} ===`))
}

describe("NoteService", () => {
  it("creates and reads a note", async () => {
    banner("create/read")
    const adapter = createMemoryAdapter()
    const svc = new NoteService({ adapter })
    const created = await svc.create({ id: "Test", body: "Hello" })
    expect(created.id).toBe("test.md")
    const read = await svc.read("test.md")
    expect(read?.body).toBe("Hello")
    expect(read?.version).toBe(computeNoteVersion(created.frontmatter, "Hello"))
  })

  it("hash stability & ordering", () => {
    banner("hash ordering")
    const fm1 = { b: 2, a: 1 }
    const fm2 = { a: 1, b: 2 }
    const body1 = "Line1\nLine2"
    const body2 = "Line1\r\nLine2" // CRLF variant
    const h1 = computeNoteVersion(fm1, body1)
    const h2 = computeNoteVersion(fm2, body1)
    const h3 = computeNoteVersion(fm2, body2)
    expect(h1).toBe(h2)
    expect(h2).toBe(h3)
  })

  it("enforces optimistic concurrency on update", async () => {
    banner("update concurrency")
    const adapter = createMemoryAdapter()
    const svc = new NoteService({ adapter })
    const n1 = await svc.create({ id: "t", body: "One" })
    const n2 = await svc.read("t.md")
    expect(n2).not.toBeNull()
    const updated = await svc.update("t.md", { body: "Two" }, n1.version)
    expect(updated.body).toBe("Two")
    await expect(
      svc.update("t.md", { body: "Three" }, n1.version),
    ).rejects.toThrow("VersionConflict")
  })

  it("is idempotent when no changes", async () => {
    banner("idempotent update")
    const adapter = createMemoryAdapter()
    const svc = new NoteService({ adapter })
    const n = await svc.create({ id: "a", body: "Body" })
    const updated = await svc.update("a.md", {}, n.version)
    expect(updated.version).toBe(n.version)
  })

  it("no event on idempotent update", async () => {
    banner("idempotent no event")
    const adapter = createMemoryAdapter()
    const bus = createEventBus()
    const events: string[] = []
    bus.subscribe((e) => events.push(e.type))
    const svc = new NoteService({ adapter, events: bus })
    const n = await svc.create({ id: "same", body: "Body" })
    await svc.update("same.md", {}, n.version)
    expect(events).toEqual(["note.created"]) // no note.updated
  })

  it("deletes with version check", async () => {
    banner("delete")
    const adapter = createMemoryAdapter()
    const svc = new NoteService({ adapter })
    const n = await svc.create({ id: "d", body: "Delete" })
    const ok = await svc.delete("d.md", n.version)
    expect(ok).toBe(true)
    const again = await svc.read("d.md")
    expect(again).toBeNull()
  })

  it("emit events for create/update/delete", async () => {
    banner("events")
    const adapter = createMemoryAdapter()
    const events: string[] = []
    const bus = createEventBus()
    bus.subscribe((e) => events.push(e.type))
    const svc = new NoteService({ adapter, events: bus })
    const n = await svc.create({ id: "e", body: "Event" })
    await svc.update("e.md", { body: "Event2" }, n.version)
    const final = await svc.read("e.md")
    if (!final) throw new Error("missing")
    await svc.delete("e.md", final.version)
    expect(events).toEqual(["note.created", "note.updated", "note.deleted"])
  })

  it("rejects duplicate create", async () => {
    banner("duplicate create")
    const svc = new NoteService({ adapter: createMemoryAdapter() })
    await svc.create({ id: "dup", body: "one" })
    await expect(svc.create({ id: "dup", body: "two" })).rejects.toThrow(
      /already exists/i,
    )
  })

  it("delete returns false on missing note", async () => {
    banner("delete missing")
    const svc = new NoteService({ adapter: createMemoryAdapter() })
    const ok = await svc.delete("missing.md" as any, "v" as any)
    expect(ok).toBe(false)
  })

  it("list applies tag & search filters", async () => {
    banner("filters")
    const adapter = createMemoryAdapter()
    const svc = new NoteService({ adapter })
    await svc.create({ id: "TagA", tags: ["alpha", "beta"], body: "First body" })
    await svc.create({ id: "TagB", tags: ["beta"], body: "Second body with word" })
    const tagFiltered = await svc.list({ tag: "alpha" })
    expect(tagFiltered.length).toBe(1)
    const tagMatch = tagFiltered[0]!
    expect(tagMatch.id).toBe("taga.md")
    const searchFiltered = await svc.list({ search: "second" })
    expect(searchFiltered.length).toBe(1)
    const searchMatch = searchFiltered[0]!
    expect(searchMatch.id).toBe("tagb.md")
  })

  it("list preserves array/object frontmatter", async () => {
    banner("list frontmatter parse")
    const adapter = createMemoryAdapter()
    const svc = new NoteService({ adapter })
    await svc.create({ id: "Complex", body: "Hello", tags: ["one", "two"], frontmatter: { meta: { deep: true }, count: 3 } })
    const listed = await svc.list({ search: "hello" })
    expect(listed.length).toBe(1)
    const first = listed[0]!
    const fm = first.frontmatter as any
    expect(Array.isArray(first.tags)).toBe(true)
    expect(first.tags).toEqual(["one", "two"])
    expect(fm.meta).toEqual({ deep: true })
    expect(fm.count).toBe(3)
  })
})
