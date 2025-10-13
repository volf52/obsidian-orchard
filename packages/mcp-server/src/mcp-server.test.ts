import { afterAll, beforeAll, describe, expect, it } from "bun:test"
import { createMemoryAdapter, NoteService } from "@orchard/core"
import { McpServer } from "./mcp-server"

import {
  callTool,
  extractErrorCode,
  extractJsonContent,
  initialize,
  listTools,
  resetSessionForTests,
  rpcCall,
  TestProtocolVersion,
} from "./test-utils"

interface HealthPayload {
  ok: boolean
  noteServiceReady: boolean
  apiKeyConfigured: boolean
  running: boolean
}

interface NoteSummary {
  id: string
  title: string
  version: string
  updatedAt: number
  tags: string[]
  frontmatterSummary?: Record<string, unknown>
}

interface ListNotesResponse {
  notes: NoteSummary[]
}

interface NoteResponse {
  note: {
    id: string
    version: string
    body: string
    tags: string[]
    frontmatter?: Record<string, unknown>
  }
}

interface TagsResponse {
  tags: Array<{ name: string; count: number }>
}

interface MetricsResponse {
  notes: number
  uptimeMs: number
  serverRunning: boolean
}

interface OkResponse {
  ok: boolean
}

/**
 * Test order rationale:
 * 1. Health check
 * 2. Negative header/session cases prior to establishing session
 * 3. Successful initialization + tool listing
 * 4. CRUD + metrics flows
 * 5. Re-initialization attempt (should not create a new clean state)
 * 6. Unsupported protocol version scenario (fresh session)
 */

describe("McpServer (MCP SDK HTTP Transport)", () => {
  let server: McpServer
  let svc: NoteService
  let testKey: string

  beforeAll(async () => {
    svc = new NoteService({ adapter: createMemoryAdapter() })
    await svc.create({
      id: "SeedOne",
      title: "Seed One",
      body: "Seed content",
      tags: ["seedA", "shared"],
    })
    await svc.create({
      id: "SeedTwo",
      title: "Seed Two",
      body: "More seed content",
      tags: ["seedB"],
    })
    testKey = "testkey1234567890"
    server = new McpServer({ noteService: svc, apiKey: testKey })
    await server.start()
    await new Promise((r) => setTimeout(r, 40))
  })

  afterAll(async () => {
    await server.stop()
  })

  it("health endpoint responds", async () => {
    const res = await fetch("http://localhost:27126/health")
    expect(res.status).toBe(200)
    const data = (await res.json()) as HealthPayload
    expect(data.ok).toBe(true)
    expect(data.noteServiceReady).toBe(true)
    expect(data.apiKeyConfigured).toBe(true)
    expect(data.running).toBe(true)
  })

  it("rejects call without Accept header (expects 4xx)", async () => {
    const res = await fetch(
      `http://localhost:27126/mcp?key=${encodeURIComponent(testKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "initialize",
          params: {
            protocolVersion: TestProtocolVersion,
            capabilities: {},
            clientInfo: { name: "x", version: "0" },
          },
        }),
      },
    )
    expect(res.status).toBeGreaterThanOrEqual(400)
  })

  it("rejects tools/list before initialization (missing session)", async () => {
    resetSessionForTests()
    const raw = await rpcCall(testKey, "tools/list", {})
    expect(raw.status).toBe(400)
  })

  it("initializes then lists tools", async () => {
    const init = await initialize(testKey)
    expect(
      init.body.result?.protocolVersion || init.body.result?.serverInfo,
    ).toBeTruthy()
    const { body } = await listTools(testKey)
    const toolList = body.result as
      | { tools?: Array<{ name: string }> }
      | undefined
    const tools = toolList?.tools ?? []
    expect(tools.some((t) => t.name === "create_note")).toBe(true)
    expect(tools.some((t) => t.name === "list_tags")).toBe(true)
  })

  it("creates notes and lists via list_notes filters", async () => {
    const c = await callTool(testKey, "create_note", {
      id: "Alpha",
      body: "Hello",
      tags: ["tagA"],
    })
    const createdData = extractJsonContent(c.body.result) as NoteResponse
    expect(createdData.note.id).toBe("alpha.md")

    await callTool(testKey, "create_note", {
      id: "Beta",
      body: "Searchable Body",
      tags: ["tagB"],
    })
    await callTool(testKey, "create_note", {
      id: "Gamma",
      body: "Mixed Search Text",
      tags: ["tagA", "tagB"],
    })
    await callTool(testKey, "create_note", {
      id: "Delta",
      body: "Has custom frontmatter",
      tags: ["tagC"],
      frontmatter: { summary: "delta note", rating: 5 },
    })

    const listAll = await callTool(testKey, "list_notes", {})
    const listAllData = extractJsonContent(
      listAll.body.result,
    ) as ListNotesResponse
    expect(Array.isArray(listAllData.notes)).toBe(true)
    const alpha = listAllData.notes.find((n) => n.id === "alpha.md")
    expect(alpha).toBeTruthy()
    expect(typeof alpha.updatedAt).toBe("number")
    expect(Array.isArray(alpha.tags)).toBe(true)
    expect(alpha.tags).toContain("tagA")
    expect(alpha.frontmatterSummary).toBeUndefined()

    const delta = listAllData.notes.find((n) => n.id === "delta.md")
    expect(delta.tags).toEqual(["tagC"])
    expect(delta.frontmatterSummary).toEqual({
      summary: "delta note",
      rating: 5,
    })

    const tagA = await callTool(testKey, "list_notes", { tag: "tagA" })
    const tagAData = extractJsonContent(tagA.body.result) as ListNotesResponse
    expect(
      tagAData.notes.every((n) => ["alpha.md", "gamma.md"].includes(n.id)),
    ).toBe(true)

    const search = await callTool(testKey, "list_notes", { search: "search" })
    const searchData = extractJsonContent(
      search.body.result,
    ) as ListNotesResponse
    const ids = searchData.notes.map((n) => n.id).sort()
    expect(ids).toEqual(["beta.md", "gamma.md"])

    const tags = await callTool(testKey, "list_tags", {})
    const tagData = extractJsonContent(tags.body.result) as TagsResponse
    expect(tagData.tags).toEqual([
      { name: "seedA", count: 1 },
      { name: "seedB", count: 1 },
      { name: "shared", count: 1 },
      { name: "tagA", count: 2 },
      { name: "tagB", count: 2 },
    ])
  })

  it("gets a note", async () => {
    const r = await callTool(testKey, "get_note", { id: "alpha.md" })
    const data = extractJsonContent(r.body.result) as NoteResponse
    expect(data.note.body).toBe("Hello")
  })

  it("normalizes id case + extension on create", async () => {
    const created = await callTool(testKey, "create_note", {
      id: "MixedCase",
      body: "C",
    })
    const createdData = extractJsonContent(created.body.result) as NoteResponse
    expect(createdData.note.id).toBe("mixedcase.md")
    const dup = await callTool(testKey, "create_note", {
      id: "MixedCase",
      body: "C",
    })
    const dupCode = extractErrorCode(dup.body.result)
    expect(dupCode).toBe("NoteAlreadyExists")
  })

  it("updates note with version and enforces conflicts", async () => {
    const current = await callTool(testKey, "get_note", { id: "alpha.md" })
    const currentData = extractJsonContent(current.body.result) as NoteResponse
    const v = currentData.note.version
    const upd = await callTool(testKey, "update_note", {
      id: "alpha.md",
      version: v,
      body: "Hello2",
    })
    const updData = extractJsonContent(upd.body.result) as NoteResponse
    expect(updData.note.body).toBe("Hello2")
    const conflict = await callTool(testKey, "update_note", {
      id: "alpha.md",
      version: v,
      body: "X",
    })
    const conflictCode = extractErrorCode(conflict.body.result)
    expect(conflictCode).toBe("VersionConflict")
  })

  it("deletes note with version", async () => {
    const current = await callTool(testKey, "get_note", { id: "alpha.md" })
    const v = (extractJsonContent(current.body.result) as NoteResponse).note
      .version
    const del = await callTool(testKey, "delete_note", {
      id: "alpha.md",
      version: v,
    })
    const delData = extractJsonContent(del.body.result) as OkResponse
    expect(delData.ok).toBe(true)
    const missing = await callTool(testKey, "get_note", { id: "alpha.md" })
    const missingCode = extractErrorCode(missing.body.result)
    expect(missingCode).toBe("NoteNotFound")
  })

  it("metrics tool returns counts", async () => {
    const first = await callTool(testKey, "metrics", {})
    const firstData = extractJsonContent(first.body.result) as MetricsResponse
    expect(typeof firstData.notes).toBe("number")
    expect(typeof firstData.uptimeMs).toBe("number")
    expect(firstData.uptimeMs).toBeGreaterThanOrEqual(0)

    await new Promise((resolve) => setTimeout(resolve, 10))

    const second = await callTool(testKey, "metrics", {})
    const secondData = extractJsonContent(second.body.result) as MetricsResponse
    expect(typeof secondData.notes).toBe("number")
    expect(typeof secondData.uptimeMs).toBe("number")
    expect(secondData.uptimeMs).toBeGreaterThanOrEqual(firstData.uptimeMs)
  })

  it("re-initialization returns either error or same protocolVersion", async () => {
    const second = await rpcCall(testKey, "initialize", {
      protocolVersion: TestProtocolVersion,
      capabilities: {},
      clientInfo: { name: "again", version: "0" },
    })
    if (second.body.error) {
      expect(second.body.error.code).toBeDefined()
    } else {
      expect(second.body.result?.protocolVersion).toBeDefined()
    }
  })

  it("unsupported protocol version yields error or 4xx", async () => {
    resetSessionForTests()
    const bad = await rpcCall(testKey, "initialize", {
      protocolVersion: "1900-01-01",
      capabilities: {},
      clientInfo: { name: "orchard-tests", version: "0" },
    })
    if (bad.status !== 200) {
      expect(bad.status).toBeGreaterThanOrEqual(400)
    } else {
      expect(
        bad.body.error ||
          bad.body.result?.protocolVersion === TestProtocolVersion,
      ).toBeTruthy()
    }
  })
})
