import { describe, expect, it } from "bun:test"
import { createMemoryAdapter } from "@/memory-adapter"
import { NoteService } from "@/note-service"
import {
  formatInlineTaskLine,
  InlineTaskService,
  normalizeTaskFrontmatter,
  parseInlineTasks,
  TASK_NOTE_MINIMAL_BODY,
  TASK_NOTE_TYPE,
  TaskNoteService,
} from "@/task"

describe("task note utilities", () => {
  it("normalizes task frontmatter", () => {
    const fm = normalizeTaskFrontmatter({
      status: "todo",
      project: " Alpha Project ",
      due: new Date("2024-05-10T12:34:56Z"),
      priority: " high ",
      mcpSyncState: " pending ",
    })

    expect(fm.type).toBe(TASK_NOTE_TYPE)
    expect(fm.status).toBe("todo")
    expect(fm.project).toBe("Alpha Project")
    expect(fm.due).toBe("2024-05-10")
    expect(fm.priority).toBe("high")
    expect(fm.mcpSyncState).toBe("pending")
  })

  it("coerces due strings and numbers", () => {
    const fromString = normalizeTaskFrontmatter({
      status: "todo",
      due: "2024/05/11",
    })
    expect(fromString.due).toBe("2024-05-11")

    const fromEpoch = normalizeTaskFrontmatter({
      status: "todo",
      due: Date.UTC(2024, 4, 12),
    })
    expect(fromEpoch.due).toBe("2024-05-12")
  })

  it("creates task notes with consistent body", async () => {
    const adapter = createMemoryAdapter()
    const noteService = new NoteService({ adapter })
    const tasks = new TaskNoteService(noteService)

    const created = await tasks.create({
      id: "Task Alpha", // uppercase and spaces -> normalized by NoteService
      title: "Task Alpha",
      status: "todo",
      project: "Test",
    })

    expect(created.id).toBe("task alpha.md")
    expect(created.frontmatter.type).toBe(TASK_NOTE_TYPE)
    expect(created.frontmatter.status).toBe("todo")
    expect(created.body).toBe(TASK_NOTE_MINIMAL_BODY)
  })

  it("lists only task notes", async () => {
    const adapter = createMemoryAdapter()
    const noteService = new NoteService({ adapter })
    const tasks = new TaskNoteService(noteService)

    await noteService.create({ id: "random-note", body: "hello" })
    await tasks.create({
      id: "Task Beta",
      title: "Task Beta",
      status: "in-progress",
      project: "Project",
    })

    const listed = await tasks.list()
    expect(listed).toHaveLength(1)
    expect(listed[0]?.frontmatter.status).toBe("in-progress")
  })

  it("updates task notes with normalized frontmatter", async () => {
    const adapter = createMemoryAdapter()
    const noteService = new NoteService({ adapter })
    const tasks = new TaskNoteService(noteService)

    const created = await tasks.create({
      id: "Task Gamma",
      title: "Task Gamma",
      status: "todo",
    })

    const updated = await tasks.update(
      created.id,
      { status: "done", due: "2024-05-15" },
      created.version,
    )

    expect(updated.frontmatter.status).toBe("done")
    expect(updated.frontmatter.due).toBe("2024-05-15")
    expect(updated.body).toBe(TASK_NOTE_MINIMAL_BODY)
  })

  it("formats and parses inline tasks with dataview fields", () => {
    const line = formatInlineTaskLine({
      text: "Follow up with client",
      frontmatter: {
        status: "todo",
        project: "Client A",
        due: "2024-05-21",
        priority: "high",
        mcpSyncState: "pending",
      },
      extraFields: { source: "[[ClientA]]" },
      blockId: "inline-test",
    })

    expect(line).toContain("type:: orchard-task")
    expect(line).toContain("project:: Client A")
    expect(line).toContain("source:: [[ClientA]]")
    expect(line).toContain("^inline-test")

    const parsed = parseInlineTasks({ id: "tasks/test.md", body: `${line}\n` })
    expect(parsed).toHaveLength(1)
    const [task] = parsed
    expect(task?.frontmatter.project).toBe("Client A")
    expect(task?.frontmatter.due).toBe("2024-05-21")
    expect(task?.extraFields.source).toBe("[[ClientA]]")
    expect(task?.blockId).toBe("inline-test")
    expect(task?.text).toBe("Follow up with client")
  })

  it("creates, updates, and deletes inline tasks", async () => {
    const adapter = createMemoryAdapter()
    const noteService = new NoteService({ adapter })
    const inlineTasks = new InlineTaskService(noteService, {
      createBlockId: () => "inline-id",
    })

    await noteService.create({ id: "Projects/alpha", body: "" })

    const created = await inlineTasks.create({
      noteId: "Projects/alpha", // should normalize id casing
      text: "Draft launch plan",
      status: "todo",
      project: "Alpha",
      due: "2024-06-01",
      priority: "medium",
    })

    expect(created.blockId).toBe("inline-id")
    expect(created.frontmatter.status).toBe("todo")

    const updated = await inlineTasks.update(
      { noteId: created.noteId, blockId: created.blockId },
      {
        status: "done",
        priority: "high",
        extraFields: { context: "[[Alpha Launch]]" },
      },
    )

    expect(updated.frontmatter.status).toBe("done")
    expect(updated.extraFields.context).toBe("[[Alpha Launch]]")

    const deleted = await inlineTasks.delete({
      noteId: created.noteId,
      blockId: created.blockId,
    })

    expect(deleted).toBe(true)
    const remaining = await inlineTasks.list(created.noteId)
    expect(remaining).toHaveLength(0)
  })
})
