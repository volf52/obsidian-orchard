import { describe, expect, it, beforeAll, afterAll } from "bun:test"
import { McpServer } from "./mcp-server"
import { NoteService, createMemoryAdapter } from "@orchard/core"

describe("McpServer", () => {
  let server: McpServer
  let svc: NoteService
  let testKey: string

  // Helper to fetch JSON (auto attach key after testKey assigned)
  async function j(method: string, path: string, body?: unknown, key?: string) {
    const url = `http://localhost:27126${path}${path.includes("?") ? "&" : "?"}key=${encodeURIComponent(key ?? testKey)}`
    const res = await fetch(url , {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    })
    const txt = await res.text()
    let parsed: any
    try { parsed = JSON.parse(txt) } catch { parsed = txt }
    return { status: res.status, body: parsed }
  }

  beforeAll(async () => {
    svc = new NoteService({ adapter: createMemoryAdapter() })
    testKey = "testkey1234567890"
    server = new McpServer({ noteService: svc, apiKey: testKey })
    await server.start()
    // tiny delay to ensure listening
    await new Promise((r) => setTimeout(r, 50))
  })

  afterAll(async () => {
    await server.stop()
  })

  it("health endpoint responds", async () => {
    const res = await fetch("http://localhost:27126/health")
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.ok).toBe(true)
  })

  it("rejects unauthorized access", async () => {
    // manual fetch without key
    const res = await fetch("http://localhost:27126/mcp/notes")
    expect(res.status).toBe(401)
    const bad = await res.json()
    expect(bad.error).toBe("Unauthorized")
  })

  it("creates and lists notes", async () => {
    const c = await j("POST", "/mcp/notes", { id: "Alpha", body: "Hello", tags: ["tagA"] })
    expect(c.status).toBe(201)
    expect(c.body.note.id).toBe("alpha.md")

    // additional notes for filtering
    const c2 = await j("POST", "/mcp/notes", { id: "Beta", body: "Searchable Body", tags: ["tagB"] })
    expect(c2.status).toBe(201)
    const c3 = await j("POST", "/mcp/notes", { id: "Gamma", body: "Mixed Search Text", tags: ["tagA", "tagB"] })
    expect(c3.status).toBe(201)

    const list = await j("GET", "/mcp/notes")
    expect(list.status).toBe(200)
    expect(Array.isArray(list.body.notes)).toBe(true)
    expect(list.body.notes.find((n: any) => n.id === "alpha.md")).toBeTruthy()
    expect(list.body.notes.length).toBeGreaterThanOrEqual(3)

    // tag filter
    const tagAList = await j("GET", "/mcp/notes?tag=tagA")
    expect(tagAList.status).toBe(200)
    expect(tagAList.body.notes.every((n: any) => ["alpha.md", "gamma.md"].includes(n.id))).toBe(true)

    const tagBList = await j("GET", "/mcp/notes?tag=tagB")
    expect(tagBList.status).toBe(200)
    expect(tagBList.body.notes.every((n: any) => ["beta.md", "gamma.md"].includes(n.id))).toBe(true)

    // search filter (case-insensitive substring)
    const searchList = await j("GET", "/mcp/notes?search=search")
    expect(searchList.status).toBe(200)
    // should include beta + gamma (body contains 'Search' or 'search')
    const ids = searchList.body.notes.map((n: any) => n.id).sort()
    expect(ids).toEqual(["beta.md", "gamma.md"]) // alpha excluded
  })

  it("reads a note", async () => {
    const r = await j("GET", "/mcp/notes/alpha.md")
    expect(r.status).toBe(200)
    expect(r.body.note.body).toBe("Hello")
  })

  it("denies wrong key", async () => {
    const wrong = await j("GET", "/mcp/notes/alpha.md", undefined, "badkey")
    expect(wrong.status).toBe(401)
  })

  it("updates a note and enforces version", async () => {
    const current = await j("GET", "/mcp/notes/alpha.md")
    const v = current.body.note.version
    const u = await j("PUT", "/mcp/notes/alpha.md", { version: v, body: "Hello2" })
    expect(u.status).toBe(200)
    expect(u.body.note.body).toBe("Hello2")

    // version conflict using old version
    const conflict = await j("PUT", "/mcp/notes/alpha.md", { version: v, body: "Fail" })
    expect(conflict.status).toBe(409)
    expect(conflict.body.error).toContain("VersionConflict")
  })

  it("deletes a note with version", async () => {
    const current = await j("GET", "/mcp/notes/alpha.md")
    const v = current.body.note.version
    const del = await j("DELETE", "/mcp/notes/alpha.md?version=" + encodeURIComponent(v))
    expect(del.status).toBe(200)
    expect(del.body.ok).toBe(true)

    const missing = await j("GET", "/mcp/notes/alpha.md")
    expect(missing.status).toBe(404)
  })

  it("SSE connection emits ready + receives broadcast", async () => {
    const events: string[] = []
    const controller = new AbortController()
    const resp = await fetch(`http://localhost:27126/mcp/events?key=${encodeURIComponent(testKey)}`, { signal: controller.signal })
    const reader = resp.body!.getReader()

    // collect a couple of chunks
    const received = new Promise<void>((resolve) => {
      const decoder = new TextDecoder()
      let buffer = ""
      const pump = () => reader.read().then(({ done, value }) => {
        if (done) return
        buffer += decoder.decode(value, { stream: true })
        const parts = buffer.split("\n\n")
        for (const p of parts.slice(0, -1)) {
          if (p.trim().length === 0) continue
          const lines = p.split("\n")
          let ev: string | null = null
            let data: string | null = null
          for (const l of lines) {
            if (l.startsWith("event:")) ev = l.slice(6).trim()
            if (l.startsWith("data:")) data = l.slice(5).trim()
          }
          if (ev) events.push(ev)
          if (ev === "ready") {
            // trigger a broadcast after ready
            server.broadcast("note.created", { id: "z.md", version: "v" })
          }
          if (events.includes("note.created")) {
            resolve()
            controller.abort()
            return
          }
        }
        buffer = parts[parts.length - 1]
        pump()
      })
      pump()
    })

    await Promise.race([
      received,
      new Promise((_r, rej) => setTimeout(() => rej(new Error("Timeout waiting for SSE")), 3000)),
    ])

    expect(events).toContain("ready")
    expect(events).toContain("note.created")
  })
})
