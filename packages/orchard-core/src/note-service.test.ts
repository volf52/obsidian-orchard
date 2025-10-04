import { describe, expect, it } from "bun:test"
import {
  computeNoteVersion,
  createEventBus,
  createMemoryAdapter,
  NoteService,
} from "@/index"

function _delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

describe("NoteService", () => {
  it("creates and reads a note", async () => {
    const adapter = createMemoryAdapter()
    const svc = new NoteService({ adapter })
    const created = await svc.create({ id: "Test", body: "Hello" })
    expect(created.id).toBe("test.md")
    const read = await svc.read("test.md")
    expect(read?.body).toBe("Hello")
    expect(read?.version).toBe(computeNoteVersion(created.frontmatter, "Hello"))
  })

  it("enforces optimistic concurrency on update", async () => {
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
    const adapter = createMemoryAdapter()
    const svc = new NoteService({ adapter })
    const n = await svc.create({ id: "a", body: "Body" })
    const updated = await svc.update("a.md", {}, n.version)
    expect(updated.version).toBe(n.version)
  })

  it("deletes with version check", async () => {
    const adapter = createMemoryAdapter()
    const svc = new NoteService({ adapter })
    const n = await svc.create({ id: "d", body: "Delete" })
    const ok = await svc.delete("d.md", n.version)
    expect(ok).toBe(true)
    const again = await svc.read("d.md")
    expect(again).toBeNull()
  })

  it("emits events", async () => {
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
})
