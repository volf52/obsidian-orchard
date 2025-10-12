import { describe, expect, it } from "bun:test"

import {
  NoteService,
  TaskService,
  assertTaskVersion,
  canTransitionTaskStatus,
  createEventBus,
  createMemoryAdapter,
  taskMatchesFilters,
} from "@/index"

const c = {
  cyan: (s: string) => `\x1b[36m${s}\x1b[0m`,
}

function banner(title: string) {
  // eslint-disable-next-line no-console
  console.log(c.cyan(`\n=== ${title} ===`))
}

describe("TaskService", () => {
  it("creates, reads, and emits events", async () => {
    banner("create/read/events")
    const adapter = createMemoryAdapter()
    const bus = createEventBus()
    const events: string[] = []
    bus.subscribe((event) => {
      events.push(event.type)
    })
    const noteSvc = new NoteService({ adapter, events: bus })
    const taskSvc = new TaskService({ noteService: noteSvc, events: bus })
    const created = await taskSvc.create({
      id: "buy-milk",
      title: "Buy milk",
      body: "Remember to buy milk",
      tags: ["home"],
      dueAt: 1_700_000_000_000,
    })
    expect(created.id).toBe("buy-milk")
    expect(created.noteId).toBe("tasks/buy-milk.md")
    const read = await taskSvc.read("buy-milk")
    expect(read?.body).toBe("Remember to buy milk")
    expect(read?.dueAt).toBe(1_700_000_000_000)
    expect(events).toContain("task.created")
  })

  it("lists tasks scoped to folder and applies filters", async () => {
    banner("list/filters")
    const adapter = createMemoryAdapter()
    const noteSvc = new NoteService({ adapter })
    const taskSvc = new TaskService({ noteService: noteSvc })
    await taskSvc.create({
      id: "alpha",
      title: "Alpha",
      status: "todo",
      tags: ["work"],
      body: "First body",
      dueAt: 10,
    })
    await taskSvc.create({
      id: "beta",
      title: "Beta",
      status: "in-progress",
      tags: ["home"],
      body: "Second body mention",
      dueAt: 20,
    })
    await taskSvc.create({
      id: "gamma",
      title: "Gamma",
      status: "done",
      tags: ["work"],
      body: "Third entry",
      dueAt: 30,
    })
    await noteSvc.create({ id: "notes/outside", body: "Not a task" })
    const all = await taskSvc.list()
    expect(all.map((t) => t.id).sort()).toEqual(["alpha", "beta", "gamma"])
    const statusFiltered = await taskSvc.list({ status: "done" })
    expect(statusFiltered.map((t) => t.id)).toEqual(["gamma"])
    const tagFiltered = await taskSvc.list({ tag: "work" })
    expect(tagFiltered.map((t) => t.id).sort()).toEqual(["alpha", "gamma"])
    const searchFiltered = await taskSvc.list({ search: "third" })
    expect(searchFiltered.map((t) => t.id)).toEqual(["gamma"])
    const dueFiltered = await taskSvc.list({ dueBefore: 25 })
    expect(dueFiltered.map((t) => t.id).sort()).toEqual(["alpha", "beta"])
  })

  it("updates tasks with optimistic concurrency and transitions", async () => {
    banner("update")
    const adapter = createMemoryAdapter()
    const noteSvc = new NoteService({ adapter })
    const taskSvc = new TaskService({ noteService: noteSvc })
    const created = await taskSvc.create({ id: "flow", title: "Flow" })
    const inProgress = await taskSvc.update(
      "flow",
      { status: "in-progress" },
      created.version,
    )
    expect(inProgress.status).toBe("in-progress")
    const done = await taskSvc.update(
      "flow",
      { status: "done", title: "Flow complete" },
      inProgress.version,
    )
    expect(done.status).toBe("done")
    await expect(
      taskSvc.update("flow", { body: "again" }, inProgress.version),
    ).rejects.toThrow("VersionConflict")
    await expect(
      taskSvc.update("flow", { status: "in-progress" }, done.version),
    ).rejects.toThrow(/Invalid task status transition/)
  })

  it("deletes tasks with version enforcement", async () => {
    banner("delete")
    const adapter = createMemoryAdapter()
    const noteSvc = new NoteService({ adapter })
    const taskSvc = new TaskService({ noteService: noteSvc })
    const created = await taskSvc.create({ id: "remove", title: "Remove" })
    const ok = await taskSvc.delete("remove", created.version)
    expect(ok).toBe(true)
    const read = await taskSvc.read("remove")
    expect(read).toBeNull()
    const again = await taskSvc.delete("remove", created.version)
    expect(again).toBe(false)
  })

  it("supports custom folders and default status", async () => {
    banner("custom folder")
    const adapter = createMemoryAdapter()
    const noteSvc = new NoteService({ adapter })
    const taskSvc = new TaskService({
      noteService: noteSvc,
      folder: "/Area/Todos/",
      defaultStatus: "blocked",
    })
    const created = await taskSvc.create({ id: "x", title: "Custom" })
    expect(created.noteId).toBe("area/todos/x.md")
    expect(created.status).toBe("blocked")
  })
})

describe("task helpers", () => {
  it("matches filters and enforces version", () => {
    banner("helpers")
    const task = {
      id: "helper",
      noteId: "tasks/helper.md",
      title: "Helper",
      status: "todo" as const,
      tags: ["x"],
      dueAt: 5,
      body: "Body",
      updatedAt: 1,
      version: "v1",
      frontmatter: {},
    }
    expect(taskMatchesFilters(task, { status: "todo" })).toBe(true)
    expect(taskMatchesFilters(task, { status: "done" })).toBe(false)
    expect(taskMatchesFilters(task, { search: "body" })).toBe(true)
    expect(taskMatchesFilters(task, { dueAfter: 10 })).toBe(false)
    assertTaskVersion(task, "v1")
    expect(() => assertTaskVersion(task, "v2")).toThrow("VersionConflict")
  })

  it("checks allowed status transitions", () => {
    banner("status transitions")
    expect(canTransitionTaskStatus("todo", "in-progress")).toBe(true)
    expect(canTransitionTaskStatus("done", "todo")).toBe(true)
    expect(canTransitionTaskStatus("done", "in-progress")).toBe(false)
  })
})
