// Orchard MCP Server (Hono-based) exposing minimal HTTP + SSE surface.
// Provides note CRUD and event streaming for MCP tooling.

import { Hono } from "hono"
import { serve } from "@hono/node-server"
import { streamSSE } from "hono/streaming"
import type { NoteService } from "@orchard/core"

// Simple colored logger with emojis
const colors = {
  reset: "\x1b[0m",
  cyan: (s: string) => `\x1b[36m${s}${colors.reset}`,
  green: (s: string) => `\x1b[32m${s}${colors.reset}`,
  yellow: (s: string) => `\x1b[33m${s}${colors.reset}`,
  red: (s: string) => `\x1b[31m${s}${colors.reset}`,
  magenta: (s: string) => `\x1b[35m${s}${colors.reset}`,
}

const log = {
  info: (m: string) => console.log(`ℹ️  ${colors.cyan(m)}`),
  start: (m: string) => console.log(`🚀 ${colors.green(m)}`),
  stop: (m: string) => console.log(`🛑 ${colors.yellow(m)}`),
  event: (m: string) => console.log(`📢 ${colors.magenta(m)}`),
  error: (m: string) => console.error(`❌ ${colors.red(m)}`),
}

interface SseClient {
  stream: any // hono's writeSSE stream (untyped here to avoid import issues)
  ping: ReturnType<typeof setInterval>
}

export class McpServer {
  private server: ReturnType<typeof serve> | null = null
  private readonly port: number
  private noteService: NoteService | null
  private apiKey: string | null
  private readonly app = new Hono()
  private readonly clients = new Set<SseClient>()
  private running = false

  constructor(opts: { port?: number; noteService?: NoteService; apiKey?: string } = {}) {
    this.port = opts.port ?? 27126
    this.noteService = opts.noteService ?? null
    this.apiKey = opts.apiKey ?? null
    this.configureRoutes()
  }

  setNoteService(svc: NoteService) { this.noteService = svc }

  private configureRoutes() {
    // Health (no auth)
    this.app.get("/health", (c) => c.json({ ok: true }))

    // Auth middleware for /mcp/* (except health)
    this.app.use("/mcp/*", async (c, next) => {
      if (!this.apiKey) return c.json({ error: "ServerNotReady" }, 503)
      const auth = c.req.header("authorization") || ""
      const bearer = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : null
      const q = c.req.query("key")
      const provided = bearer || q || null
      if (!provided || provided !== this.apiKey) return c.json({ error: "Unauthorized" }, 401)
      await next()
    })

    // List notes
    this.app.get("/mcp/notes", async (c) => {
      if (!this.noteService) return c.json({ error: "NoteServiceUnavailable" }, 503)
      const notes = await this.noteService.list()
      const slim = notes.map((n) => ({ id: n.id, title: n.title, version: n.version }))
      return c.json({ notes: slim })
    })

    // Read note
    this.app.get("/mcp/notes/:id", async (c) => {
      if (!this.noteService) return c.json({ error: "NoteServiceUnavailable" }, 503)
      const id = decodeURIComponent(c.req.param("id"))
      const note = await this.noteService.read(id as any)
      if (!note) return c.json({ error: "NotFound" }, 404)
      return c.json({ note })
    })

    // Create note
    this.app.post("/mcp/notes", async (c) => {
      if (!this.noteService) return c.json({ error: "NoteServiceUnavailable" }, 503)
      let body: any
      try { body = await c.req.json() } catch { return c.json({ error: "InvalidBody" }, 400) }
      const { id, title, tags, frontmatter, body: content } = body || {}
      if (typeof id !== "string" || id.trim() === "") return c.json({ error: "MissingId" }, 400)
      try {
        const created = await this.noteService.create({
          id,
            title: typeof title === "string" ? title : undefined,
          tags: Array.isArray(tags) ? (tags.filter((t) => typeof t === "string") as string[]) : undefined,
          frontmatter: typeof frontmatter === "object" && frontmatter ? (frontmatter as Record<string, unknown>) : undefined,
          body: typeof content === "string" ? content : undefined,
        })
        return c.json({ note: created }, 201)
      } catch (e) {
        return c.json({ error: (e as Error).message }, 409)
      }
    })

    // Update note
    this.app.put("/mcp/notes/:id", async (c) => {
      if (!this.noteService) return c.json({ error: "NoteServiceUnavailable" }, 503)
      let body: any
      try { body = await c.req.json() } catch { return c.json({ error: "InvalidBody" }, 400) }
      const id = decodeURIComponent(c.req.param("id"))
      const { version, title, tags, frontmatter, body: content } = body || {}
      if (typeof version !== "string") return c.json({ error: "MissingVersion" }, 400)
      try {
        const updated = await this.noteService.update(id as any, {
          title: typeof title === "string" ? title : undefined,
          tags: Array.isArray(tags) ? (tags.filter((t) => typeof t === "string") as string[]) : undefined,
          frontmatter: typeof frontmatter === "object" && frontmatter ? (frontmatter as Record<string, unknown>) : undefined,
          body: typeof content === "string" ? content : undefined,
        }, version as any)
        return c.json({ note: updated })
      } catch (e) {
        const msg = (e as Error).message
        if (msg.startsWith("VersionConflict")) return c.json({ error: msg }, 409)
        if (msg.includes("Note missing")) return c.json({ error: msg }, 404)
        return c.json({ error: msg }, 500)
      }
    })

    // Delete note
    this.app.delete("/mcp/notes/:id", async (c) => {
      if (!this.noteService) return c.json({ error: "NoteServiceUnavailable" }, 503)
      const id = decodeURIComponent(c.req.param("id"))
      const version = c.req.query("version")
      if (!version) return c.json({ error: "MissingVersion" }, 400)
      try {
        const ok = await this.noteService.delete(id as any, version as any)
        if (!ok) return c.json({ error: "NotFound" }, 404)
        return c.json({ ok: true })
      } catch (e) {
        const msg = (e as Error).message
        if (msg.startsWith("VersionConflict")) return c.json({ error: msg }, 409)
        return c.json({ error: msg }, 500)
      }
    })

    // SSE events
    this.app.get("/mcp/events", (c) => streamSSE(c, async (stream) => {
      const client: SseClient = {
        stream,
        ping: setInterval(() => {
          stream.writeSSE({ event: "ping", data: Date.now().toString() }).catch(() => {})
        }, 30_000),
      }
      this.clients.add(client)
      stream.writeSSE({ event: "ready", data: "{}" }).catch(() => {})
      log.info(`SSE client connected (total=${this.clients.size})`)

      const abort = c.req.raw.signal
      abort.addEventListener("abort", () => this.dropClient(client))

      // Keep open indefinitely
      await new Promise(() => {})
    }))
  }

  private dropClient(client: SseClient) {
    if (!this.clients.has(client)) return
    clearInterval(client.ping)
    try { client.stream.close() } catch {}
    this.clients.delete(client)
    log.info(`SSE client disconnected (total=${this.clients.size})`)
  }

  async start(): Promise<void> {
    if (this.running) return
    this.running = true
    this.server = serve({
      fetch: this.app.fetch,
      port: this.port,
      hostname: "0.0.0.0",
    }, (info) => {
       log.start(`MCP server listening http://localhost:${info.port}`)
       log.info(`Health: http://localhost:${info.port}/health`)
       if (this.apiKey) {
         const tail = this.apiKey.slice(-6)
         log.info(`Events: http://localhost:${info.port}/mcp/events?key=***${tail}`)
       } else {
         log.info(`Events: http://localhost:${info.port}/mcp/events (no-key)`)
       }
     })
   }


  async stop(): Promise<void> {
    if (!this.running) return
    this.running = false
    for (const c of [...this.clients]) this.dropClient(c)
    this.server?.close()
    this.server = null
    log.stop("MCP server stopped")
  }

  // Broadcast utility for note events
  broadcast(event: string, payload: unknown) {
    const data = JSON.stringify(payload)
    for (const c of this.clients) {
      c.stream.writeSSE({ event, data }).catch(() => this.dropClient(c))
    }
    log.event(`${event} -> ${this.clients.size} clients`)
  }
}

