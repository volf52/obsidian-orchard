import { McpServer as SdkMcpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js'
import { randomBytes, randomUUID } from 'node:crypto'
import { createServer, type IncomingHttpHeaders, type Server } from 'node:http'
import { z } from 'zod'
import type {
  EventBus,
  Note,
  NoteFilters,
  NoteId,
  NoteService,
  NoteVersion,
  UpdateNoteMutation,
  VaultAdapter,
} from '@orchard/core'
import { TaskToolService } from './task-service'

const colors = {
  reset: '\x1b[0m',
  cyan: (s: string) => `\x1b[36m${s}${colors.reset}`,
  green: (s: string) => `\x1b[32m${s}${colors.reset}`,
  yellow: (s: string) => `\x1b[33m${s}${colors.reset}`,
  red: (s: string) => `\x1b[31m${s}${colors.reset}`,
}

const log = {
  info: (m: string) => console.log(`ℹ️  ${colors.cyan(m)}`),
  start: (m: string) => console.log(`🚀 ${colors.green(m)}`),
  stop: (m: string) => console.log(`🛑 ${colors.yellow(m)}`),
  error: (m: string) => console.error(`❌ ${colors.red(m)}`),
}

const summarizeFrontmatter = (
  frontmatter: Record<string, unknown>,
): Record<string, unknown> | undefined => {
  const summary: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(frontmatter)) {
    if (key === 'title' || key === 'tags') continue
    if (value == null) continue
    if (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    ) {
      summary[key] = value
      continue
    }
    if (Array.isArray(value)) {
      const filtered = value.filter(
        (v): v is string | number =>
          typeof v === 'string' || typeof v === 'number',
      )
      if (filtered.length > 0) summary[key] = filtered.slice(0, 10)
    }
  }
  return Object.keys(summary).length > 0 ? summary : undefined
}

// Minimal MCP HTTP server exposing /health and /mcp (JSON-RPC + SSE)
export class McpServer {
  private httpServer: Server | null = null
  private readonly port: number
  private noteService: NoteService | null
  private taskTools: TaskToolService | null = null
  private apiKey: string | null
  private running = false
  private startedAt: number | null = null
  private readonly sdk: SdkMcpServer
  private readonly transport: StreamableHTTPServerTransport
  private readonly taskFolder: string
  private readonly taskBaseFile: string | null
  private unsubscribeEvents: (() => void) | null = null
  private readonly knownTaskIds = new Set<NoteId>()
  setApiKey(key: string) {
    this.apiKey = key
  }

  getApiKey(): string | null {
    return this.apiKey
  }

  constructor(
    opts: {
      port?: number
      noteService?: NoteService
      apiKey?: string
      taskFolder?: string
      taskBaseFile?: string | null
    } = {},
  ) {
    const envPort =
      typeof process !== 'undefined'
        ? Number(process.env.MCP_PORT || process.env.PORT)
        : undefined
    this.port =
      opts.port ?? (envPort && !Number.isNaN(envPort) ? envPort : 27126)
    const envKey =
      typeof process !== 'undefined'
        ? process.env.MCP_API_KEY || process.env.API_KEY
        : undefined
    this.noteService = opts.noteService ?? null
    this.apiKey = opts.apiKey ?? envKey ?? null

    const envTaskFolder =
      typeof process !== 'undefined' ? process.env.MCP_TASK_FOLDER : undefined
    const envTaskBase =
      typeof process !== 'undefined'
        ? process.env.MCP_TASK_BASE_FILE
        : undefined
    this.taskFolder = normalizeTaskFolder(opts.taskFolder ?? envTaskFolder)
    const baseFileSource =
      opts.taskBaseFile !== undefined ? opts.taskBaseFile : envTaskBase
    this.taskBaseFile = normalizeTaskBaseFile(baseFileSource)

    this.sdk = new SdkMcpServer({
      name: 'orchard-mcp',
      version: '0.1.0',
    })

    this.registerTools()

    // Streamable transport; JSON responses enabled for simple tool calls over POST
    this.transport = new StreamableHTTPServerTransport({
      enableJsonResponse: true,
      sessionIdGenerator: () => randomUUID(),
    })
  }

  setNoteService(svc: NoteService) {
    this.noteService = svc
    this.taskTools = null
    this.knownTaskIds.clear()
  }

  private requireService(): NoteService {
    if (!this.noteService)
      throw new McpError(ErrorCode.InternalError, 'NoteServiceUnavailable')
    return this.noteService
  }

  private requireTaskTools(): TaskToolService {
    const svc = this.requireService()
    if (!this.taskTools) {
      this.taskTools = new TaskToolService({
        noteService: svc,
        taskFolder: this.taskFolder,
        taskBaseFile: this.taskBaseFile,
      })
    }
    return this.taskTools
  }

  broadcast(event: string, params: Record<string, unknown>) {
    // Fire-and-forget notification to connected clients (SSE subscribers)
    const sdk = this.sdk as unknown as {
      notify?: (name: string, payload: Record<string, unknown>) => void
    }
    try {
      sdk.notify?.(event, params)
    } catch {
      // ignore
    }
  }

  attachEvents(events: EventBus) {
    this.events = events
    this.unsubscribeEvents?.()
    this.unsubscribeEvents = events.subscribe((evt) => {
      if (!evt || typeof evt !== 'object' || !('type' in evt)) return
      switch (evt.type) {
        case 'note.created':
          this.handleTaskEvent('task.created', evt.note)
          break
        case 'note.updated':
          this.handleTaskEvent('task.updated', evt.note, evt.previousVersion)
          break
        case 'note.deleted':
          this.handleTaskDeletion(evt.id, evt.previousVersion)
          break
        default:
          break
      }
    })
  }

  private handleTaskEvent(
    type: 'task.created' | 'task.updated',
    note: Note,
    previousVersion?: NoteVersion,
  ) {
    const tasks = this.requireTaskTools()
    const summary = tasks.tryConvertNote(note)
    if (!summary) return
    this.markTaskKnown(summary.id, tasks)
    const payload: Record<string, unknown> = { ...summary }
    if (previousVersion) payload.previousVersion = previousVersion
    this.broadcast(type, payload)
  }

  private handleTaskDeletion(id: NoteId, previousVersion: NoteVersion) {
    this.knownTaskIds.delete(id)
    const tasks = this.requireTaskTools()
    if (!tasks.isWithinTaskFolder(id)) return
    const payload: Record<string, unknown> = {
      id,
      previousVersion,
      links: tasks.buildLinks(id),
    }
    this.broadcast('task.deleted', payload)
  }

  private markTaskKnown(id: NoteId, tasks?: TaskToolService) {
    const svc = tasks ?? this.taskTools
    if (svc) {
      if (!svc.isWithinTaskFolder(id)) return
    } else if (!isWithinFolder(id, this.taskFolder)) {
      return
    }
    this.knownTaskIds.add(id)
  }

  private registerTools() {
    const formatError = (code: string, details?: Record<string, unknown>) => {
      if (!details || Object.keys(details).length === 0) return code
      // Append a compact JSON payload after a single space for optional details.
      return `${code} ${JSON.stringify(details)}`
    }

    const errorContent = (code: string, details?: Record<string, unknown>) => ({
      content: [{ type: 'text' as const, text: formatError(code, details) }],
      isError: true,
    })

    const mapError = (
      e: unknown,
    ): { code: string; details?: Record<string, unknown> } => {
      if (e && typeof e === 'object' && 'code' in e) {
        const codeValue = (e as { code?: unknown }).code
        const details = (e as { details?: unknown }).details
        return {
          code:
            typeof codeValue === 'string' && codeValue
              ? codeValue
              : 'UnknownError',
          details:
            details && typeof details === 'object'
              ? (details as Record<string, unknown>)
              : undefined,
        }
      }
      if (e instanceof McpError) return { code: e.message || 'McpError' }
      const msg = (e as Error)?.message || 'UnknownError'
      if (/already exists/i.test(msg)) return { code: 'NoteAlreadyExists' }
      if (/Note missing/i.test(msg)) return { code: 'NoteNotFound' }
      if (/VersionConflict/i.test(msg)) return { code: 'VersionConflict' }
      if (/NoteNotFound/i.test(msg)) return { code: 'NoteNotFound' }
      return {
        code:
          msg.replace(/[^A-Za-z0-9_.-]/g, '_').slice(0, 60) || 'UnknownError',
      }
    }

    // list_notes
    this.sdk.tool(
      'list_notes',
      { tag: z.string().optional(), search: z.string().optional() },
      async (args: { tag?: string; search?: string }) => {
        const svc = this.requireService()
        try {
          const filters: NoteFilters = {}
          if (args.tag) filters.tag = args.tag
          if (args.search) filters.search = args.search
          const notes = await svc.list(filters)
          const slim = notes.map((n) => {
            const frontmatterSummary = summarizeFrontmatter(n.frontmatter)
            return {
              id: n.id,
              title: n.title,
              version: n.version,
              updatedAt: n.updatedAt,
              tags: n.tags,
              ...(frontmatterSummary ? { frontmatterSummary } : {}),
            }
          })
          return {
            content: [{ type: 'text', text: JSON.stringify({ notes: slim }) }],
          }
        } catch (e) {
          const mapped = mapError(e)
          return errorContent(mapped.code, mapped.details)
        }
      },
    )

    const taskFrontmatterSchema = z
      .object({
        type: z.string().optional(),
        status: z.string(),
        project: z.union([z.string(), z.null()]).optional(),
        due: z.union([z.string(), z.null()]).optional(),
        priority: z.union([z.string(), z.null()]).optional(),
        mcpSyncState: z.union([z.string(), z.null()]).optional(),
      })
      .passthrough()

    // list_tasks
    this.sdk.tool(
      'list_tasks',
      {
        tag: z.string().optional(),
        search: z.string().optional(),
        status: z.string().optional(),
        project: z.string().optional(),
      },
      async (args: {
        tag?: string
        search?: string
        status?: string
        project?: string
      }) => {
        const tasks = this.requireTaskTools()
        try {
          const payload = await tasks.list({
            tag: args.tag,
            search: args.search,
            status: args.status,
            project: args.project,
          })
          return {
            content: [
              { type: 'text', text: JSON.stringify({ tasks: payload }) },
            ],
          }
        } catch (e) {
          const mapped = mapError(e)
          return errorContent(mapped.code, mapped.details)
        }
      },
    )

    // create_task
    this.sdk.tool(
      'create_task',
      {
        id: z.string(),
        title: z.string(),
        tags: z.array(z.string()).optional(),
        frontmatter: taskFrontmatterSchema,
      },
      async (args: {
        id: string
        title: string
        tags?: string[]
        frontmatter: Record<string, unknown>
      }) => {
        const tasks = this.requireTaskTools()
        try {
          const created = await tasks.create({
            id: args.id,
            title: args.title,
            tags: args.tags,
            frontmatter: args.frontmatter,
          })
          this.markTaskKnown(created.id, tasks)
          return {
            content: [
              { type: 'text', text: JSON.stringify({ task: created }) },
            ],
          }
        } catch (e) {
          const mapped = mapError(e)
          return errorContent(mapped.code, mapped.details)
        }
      },
    )

    // update_task
    this.sdk.tool(
      'update_task',
      {
        id: z.string(),
        version: z.string(),
        title: z.string().optional(),
        tags: z.array(z.string()).optional(),
        frontmatter: taskFrontmatterSchema,
      },
      async (args: {
        id: string
        version: string
        title?: string
        tags?: string[]
        frontmatter: Record<string, unknown>
      }) => {
        const tasks = this.requireTaskTools()
        try {
          const updated = await tasks.update({
            id: args.id,
            version: args.version as NoteVersion,
            title: args.title,
            tags: args.tags,
            frontmatter: args.frontmatter,
          })
          this.markTaskKnown(updated.id, tasks)
          return {
            content: [
              { type: 'text', text: JSON.stringify({ task: updated }) },
            ],
          }
        } catch (e) {
          const mapped = mapError(e)
          return errorContent(mapped.code, mapped.details)
        }
      },
    )

    // transition_task_status
    this.sdk.tool(
      'transition_task_status',
      {
        id: z.string(),
        version: z.string(),
        status: z.string(),
        project: z.union([z.string(), z.null()]).optional(),
        due: z.union([z.string(), z.null()]).optional(),
        priority: z.union([z.string(), z.null()]).optional(),
        mcpSyncState: z.union([z.string(), z.null()]).optional(),
      },
      async (args: {
        id: string
        version: string
        status: string
        project?: string | null
        due?: string | null
        priority?: string | null
        mcpSyncState?: string | null
      }) => {
        const tasks = this.requireTaskTools()
        try {
          const updated = await tasks.transition({
            id: args.id,
            version: args.version as NoteVersion,
            status: args.status,
            project: args.project,
            due: args.due,
            priority: args.priority,
            mcpSyncState: args.mcpSyncState,
          })
          this.markTaskKnown(updated.id, tasks)
          return {
            content: [
              { type: 'text', text: JSON.stringify({ task: updated }) },
            ],
          }
        } catch (e) {
          const mapped = mapError(e)
          return errorContent(mapped.code, mapped.details)
        }
      },
    )

    // list_tags
    this.sdk.tool('list_tags', {}, async () => {
      const svc = this.requireService()
      try {
        const notes = await svc.list()
        const counts = new Map<string, number>()
        for (const note of notes) {
          for (const tag of note.tags ?? []) {
            const current = counts.get(tag) ?? 0
            counts.set(tag, current + 1)
          }
        }
        const tags = Array.from(counts.entries())
          .map(([name, count]) => ({ name, count }))
          .sort((a, b) => a.name.localeCompare(b.name))
        return { content: [{ type: 'text', text: JSON.stringify({ tags }) }] }
      } catch (e) {
        const mapped = mapError(e)
        return errorContent(mapped.code, mapped.details)
      }
    })

    // get_note
    this.sdk.tool(
      'get_note',
      { id: z.string() },
      async (args: { id: string }) => {
        const svc = this.requireService()
        try {
          const noteId = args.id as NoteId
          const note = await svc.read(noteId)
          if (!note) return errorContent('NoteNotFound')
          return { content: [{ type: 'text', text: JSON.stringify({ note }) }] }
        } catch (e) {
          const mapped = mapError(e)
          return errorContent(mapped.code, mapped.details)
        }
      },
    )

    // create_note
    this.sdk.tool(
      'create_note',
      {
        id: z.string(),
        title: z.string().optional(),
        body: z.string().optional(),
        tags: z.array(z.string()).optional(),
        frontmatter: z.record(z.any()).optional(),
      },
      async (input: {
        id: string
        title?: string
        body?: string
        tags?: string[]
        frontmatter?: Record<string, unknown>
      }) => {
        const svc = this.requireService()
        try {
          const created = await svc.create({
            id: input.id as NoteId,
            title: input.title,
            body: input.body,
            tags: input.tags,
            frontmatter: input.frontmatter,
          })
          return {
            content: [
              { type: 'text', text: JSON.stringify({ note: created }) },
            ],
          }
        } catch (e) {
          const mapped = mapError(e)
          return errorContent(mapped.code, mapped.details)
        }
      },
    )

    // update_note
    this.sdk.tool(
      'update_note',
      {
        id: z.string(),
        version: z.string(),
        title: z.string().optional(),
        body: z.string().optional(),
        tags: z.array(z.string()).optional(),
        frontmatter: z.record(z.any()).optional(),
      },
      async (input: {
        id: string
        version: string
        title?: string
        body?: string
        tags?: string[]
        frontmatter?: Record<string, unknown>
      }) => {
        const svc = this.requireService()
        try {
          const noteId = input.id as NoteId
          const version = input.version as NoteVersion
          const mutation: UpdateNoteMutation = {}
          if (input.title !== undefined) mutation.title = input.title
          if (input.body !== undefined) mutation.body = input.body
          if (input.tags !== undefined) mutation.tags = input.tags
          if (input.frontmatter !== undefined)
            mutation.frontmatter = input.frontmatter
          const updated = await svc.update(noteId, mutation, version)
          return {
            content: [
              { type: 'text', text: JSON.stringify({ note: updated }) },
            ],
          }
        } catch (e) {
          const mapped = mapError(e)
          return errorContent(mapped.code, mapped.details)
        }
      },
    )

    // delete_note
    this.sdk.tool(
      'delete_note',
      { id: z.string(), version: z.string() },
      async (input: { id: string; version: string }) => {
        const svc = this.requireService()
        try {
          const noteId = input.id as NoteId
          const version = input.version as NoteVersion
          const ok = await svc.delete(noteId, version)
          if (!ok) return errorContent('NoteNotFound')
          return {
            content: [{ type: 'text', text: JSON.stringify({ ok: true }) }],
          }
        } catch (e) {
          const mapped = mapError(e)
          return errorContent(mapped.code, mapped.details)
        }
      },
    )

    // metrics
    this.sdk.tool('metrics', {}, async () => {
      const svc = this.requireService()
      const notes = await svc.list()
      const uptimeMs = this.startedAt ? Date.now() - this.startedAt : 0
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              notes: notes.length,
              uptimeMs,
              serverRunning: this.running,
            }),
          },
        ],
      }
    })
  }

  private authOk(url: URL, headers: Headers): boolean {
    if (!this.apiKey) return false // server not ready until key set
    const auth = headers.get('authorization') || ''
    const bearer = auth.toLowerCase().startsWith('bearer ')
      ? auth.slice(7).trim()
      : null
    const q = url.searchParams.get('key')
    const provided = bearer || q || null
    return !!provided && provided === this.apiKey
  }

  async start(): Promise<void> {
    if (!this.noteService) {
      log.info(
        'Starting without NoteService; /health ok=false until setNoteService().',
      )
    }
    if (this.running) return
    this.running = true

    // StreamableHTTPServerTransport start is handled by sdk.connect
    await this.sdk.connect(this.transport)

    this.httpServer = createServer((req, res) => {
      const url = new URL(req.url || '/', `http://localhost:${this.port}`)

      if (url.pathname === '/health') {
        const payload = {
          ok: !!this.noteService && !!this.apiKey,
          noteServiceReady: !!this.noteService,
          apiKeyConfigured: !!this.apiKey,
          running: this.running,
        }
        res.statusCode = payload.ok ? 200 : 503
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify(payload))
        return
      }

      if (url.pathname === '/config/key' && req.method === 'POST') {
        let body = ''
        req.on('data', (chunk) => {
          body += chunk
        })
        req.on('end', () => {
          if (!this.authOk(url, toHeaders(req.headers))) {
            res.statusCode = this.apiKey ? 401 : 503
            res.setHeader('Content-Type', 'application/json')
            res.end(
              JSON.stringify({
                error: {
                  code: this.apiKey ? 'Unauthorized' : 'ServerNotReady',
                },
              }),
            )
            return
          }
          try {
            const parsed = body ? JSON.parse(body) : {}
            const schema = z.object({
              rotate: z.boolean().optional(),
              newKey: z.string().optional(),
            })
            const cfg = schema.parse(parsed)
            if (cfg.rotate || cfg.newKey) {
              this.apiKey = cfg.newKey || randomBytes(32).toString('hex')
            }
            res.statusCode = 200
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ ok: true }))
          } catch {
            res.statusCode = 400
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: { code: 'BadRequest' } }))
          }
        })
        return
      }

      if (url.pathname === '/config/storage' && req.method === 'POST') {
        let body = ''
        req.on('data', (chunk) => {
          body += chunk
        })
        req.on('end', () => {
          if (!this.authOk(url, toHeaders(req.headers))) {
            res.statusCode = this.apiKey ? 401 : 503
            res.setHeader('Content-Type', 'application/json')
            res.end(
              JSON.stringify({
                error: {
                  code: this.apiKey ? 'Unauthorized' : 'ServerNotReady',
                },
              }),
            )
            return
          }
          try {
            const parsed = body ? JSON.parse(body) : {}
            const schema = z.object({ mode: z.enum(['memory', 'vault']) })
            const cfg = schema.parse(parsed)
            // Caller (plugin) will handle actual restart; here we just acknowledge
            res.statusCode = 200
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ ok: true, mode: cfg.mode }))
          } catch {
            res.statusCode = 400
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: { code: 'BadRequest' } }))
          }
        })
        return
      }

      if (url.pathname === '/mcp') {
        if (!this.authOk(url, toHeaders(req.headers))) {
          res.statusCode = this.apiKey ? 401 : 503
          res.setHeader('Content-Type', 'application/json')
          res.end(
            JSON.stringify({
              error: { code: this.apiKey ? 'Unauthorized' : 'ServerNotReady' },
            }),
          )
          return
        }
        // Delegate to SDK transport (handles JSON-RPC + SSE if Accept header)
        this.transport.handleRequest(req, res)
        return
      }

      res.statusCode = 404
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ error: { code: 'NotFound' } }))
    })

    this.httpServer.listen(this.port, '0.0.0.0', () => {
      this.startedAt = Date.now()
      log.start(`MCP server (SDK) listening http://localhost:${this.port}`)
      log.info(`Health: http://localhost:${this.port}/health`)
      log.info(`MCP: http://localhost:${this.port}/mcp`)
    })
  }

  async stop(): Promise<void> {
    if (!this.running) return
    this.running = false
    await this.sdk.close()
    this.unsubscribeEvents?.()
    this.unsubscribeEvents = null
    await new Promise<void>((resolve) =>
      this.httpServer?.close(() => resolve()),
    )
    this.httpServer = null
    this.startedAt = null
    log.stop('MCP server stopped')
  }
}

/**
 * Convert Node.js IncomingHttpHeaders into a standard Fetch `Headers` instance.
 *
 * @param init - The raw `IncomingHttpHeaders` object (header names to string or string[] values)
 * @returns A `Headers` populated with the same header names; string[] values are joined with ", ". Non-string, non-array values are ignored.
 */
function toHeaders(init: IncomingHttpHeaders): Headers {
  const headers = new Headers()
  for (const [key, value] of Object.entries(init)) {
    if (typeof value === 'string') {
      headers.set(key, value)
    } else if (Array.isArray(value)) {
      headers.set(key, value.join(', '))
    }
  }
  return headers
}

export interface CreateMcpServerOptions {
  port?: number
  apiKey?: string
  noteService?: NoteService
  createAdapter?: () => { adapter: VaultAdapter; events?: EventBus }
  taskFolder?: string
  taskBaseFile?: string | null
}

/**
 * Create and configure an MCP server instance, ensuring a NoteService is available.
 *
 * If `opts.noteService` is omitted, the function attempts to dynamically import
 * `@orchard/core` and construct an in-memory NoteService (or uses `opts.createAdapter`
 * to customize adapter/event bus creation). The returned object exposes the server
 * instance, the NoteService in use, and convenience `start`/`stop` helpers.
 *
 * @param opts - Optional configuration for the server. Relevant fields:
 *   - `port`, `apiKey`, `noteService`, `createAdapter`
 * @returns An object containing:
 *   - `server`: the configured `McpServer` instance
 *   - `noteService`: the `NoteService` backing the server
 *   - `start`: convenience function to start the server
 *   - `stop`: convenience function to stop the server
 * @throws Error if the function fails to construct a NoteService when one is not provided.
 */
export async function createMcpServer(opts: CreateMcpServerOptions = {}) {
  let noteService = opts.noteService || null
  if (!noteService) {
    try {
      const core = await import('@orchard/core')
      const adapterFactory: () => { adapter: VaultAdapter; events?: EventBus } =
        opts.createAdapter ||
        (() => ({
          adapter: core.createMemoryAdapter(),
          events: core.createEventBus(),
        }))
      const { adapter, events } = adapterFactory()
      noteService = new core.NoteService({ adapter, events })
    } catch (e) {
      throw new Error(
        `Failed to construct NoteService for MCP server: ${(e as Error).message}`,
      )
    }
  }
  const server = new McpServer({
    port: opts.port,
    apiKey: opts.apiKey,
    noteService,
    taskFolder: opts.taskFolder,
    taskBaseFile: opts.taskBaseFile ?? undefined,
  })
  if (events) server.attachEvents(events)
  return {
    server,
    noteService,
    start: () => server.start(),
    stop: () => server.stop(),
  } as const
}

function isWithinFolder(id: NoteId, folder: string): boolean {
  if (!folder) return true
  if (id === folder) return true
  const prefix = `${folder}/`
  return id.startsWith(prefix)
}

function normalizeTaskFolder(input?: string | null): string {
  if (input == null) return 'tasks'
  const trimmed = input.trim().replace(/^\/+|\/+$/g, '')
  if (!trimmed) return ''
  return trimmed.replace(/\\+/g, '/').toLowerCase()
}

function normalizeTaskBaseFile(input?: string | null): string | null {
  if (input == null) return '.obsidian/bases/orchard-tasks.base.json'
  const trimmed = input.trim()
  if (!trimmed) return null
  return trimmed.replace(/\\+/g, '/')
}
