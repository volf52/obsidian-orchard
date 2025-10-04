import { createServer, type Server } from "node:http";
import type { NoteService } from "@orchard/core";
import { z } from "zod";
import { McpServer as SdkMcpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";

const colors = {
  reset: "\x1b[0m",
  cyan: (s: string) => `\x1b[36m${s}${colors.reset}`,
  green: (s: string) => `\x1b[32m${s}${colors.reset}`,
  yellow: (s: string) => `\x1b[33m${s}${colors.reset}`,
  red: (s: string) => `\x1b[31m${s}${colors.reset}`,
};

const log = {
  info: (m: string) => console.log(`ℹ️  ${colors.cyan(m)}`),
  start: (m: string) => console.log(`🚀 ${colors.green(m)}`),
  stop: (m: string) => console.log(`🛑 ${colors.yellow(m)}`),
  error: (m: string) => console.error(`❌ ${colors.red(m)}`),
};

// Minimal MCP HTTP server exposing /health and /mcp (JSON-RPC + SSE)
export class McpServer {
  private httpServer: Server | null = null;
  private readonly port: number;
  private noteService: NoteService | null;
  private apiKey: string | null;
  private running = false;
  private readonly sdk: SdkMcpServer;
  private readonly transport: StreamableHTTPServerTransport;

  constructor(opts: { port?: number; noteService?: NoteService; apiKey?: string } = {}) {
    const envPort = typeof process !== "undefined" ? Number(process.env.MCP_PORT || process.env.PORT) : undefined;
    this.port = opts.port ?? (envPort && !Number.isNaN(envPort) ? envPort : 27126);
    const envKey = typeof process !== "undefined" ? (process.env.MCP_API_KEY || process.env.API_KEY) : undefined;
    this.noteService = opts.noteService ?? null;
    this.apiKey = opts.apiKey ?? envKey ?? null;

    this.sdk = new SdkMcpServer({
      name: "orchard-mcp",
      version: "0.1.0",
    });

    this.registerTools();

    // Streamable transport; JSON responses enabled for simple tool calls over POST
    this.transport = new StreamableHTTPServerTransport({ enableJsonResponse: true, sessionIdGenerator: () => Math.random().toString(36).slice(2) });
  }

  setNoteService(svc: NoteService) { this.noteService = svc; }

  private requireService(): NoteService {
    if (!this.noteService) throw new McpError(ErrorCode.InternalError, "NoteServiceUnavailable");
    return this.noteService;
  }

  broadcast(event: string, params: Record<string, unknown>) {
    // Fire-and-forget notification to connected clients (SSE subscribers)
    try {
      (this.sdk as any).notify?.(event as any, params);
    } catch {
      // ignore
    }
  }

  private registerTools() {
    // list_notes
    this.sdk.tool(
      "list_notes",
      "List notes (optional tag/search filters). Returns slim metadata.",
       { tag: z.string().optional(), search: z.string().optional() },
      async (args: { tag?: string; search?: string }) => {
        const svc = this.requireService();
        const notes = await svc.list({ tag: args.tag, search: args.search } as any);
        const slim = notes.map((n) => ({ id: n.id, title: n.title, version: n.version }));
        return { content: [{ type: "json", data: { notes: slim } }] };
      },
    );

    // get_note
    this.sdk.tool(
      "get_note",
      "Fetch full note by id.",
       { id: z.string() },
      async (args: { id: string }) => {
        const svc = this.requireService();
        const note = await svc.read(args.id as any);
        if (!note) throw new McpError(ErrorCode.InvalidParams, "NoteNotFound");
        return { content: [{ type: "json", data: { note } }] };
      },
    );

    // create_note
    this.sdk.tool(
      "create_note",
      "Create a note; id normalized + .md appended if missing.",
       {
        id: z.string(),
        title: z.string().optional(),
        body: z.string().optional(),
        tags: z.array(z.string()).optional(),
        frontmatter: z.record(z.any()).optional(),
      },
      async (input: { id: string; title?: string; body?: string; tags?: string[]; frontmatter?: Record<string, unknown> }) => {
        const svc = this.requireService();
        try {
          const created = await svc.create({
            id: input.id,
            title: input.title,
            body: input.body,
            tags: input.tags,
            frontmatter: input.frontmatter as any,
          });
          return { content: [{ type: "json", data: { note: created } }] };
        } catch (e) {
          return { content: [{ type: "text", text: (e as Error).message }], isError: true };
        }
      },
    );

    // update_note
    this.sdk.tool(
      "update_note",
      "Update fields of a note with optimistic version.",
       {
        id: z.string(),
        version: z.string(),
        title: z.string().optional(),
        body: z.string().optional(),
        tags: z.array(z.string()).optional(),
        frontmatter: z.record(z.any()).optional(),
      },
      async (input: { id: string; version: string; title?: string; body?: string; tags?: string[]; frontmatter?: Record<string, unknown> }) => {
        const svc = this.requireService();
        try {
          const updated = await svc.update(input.id as any, {
            title: input.title,
            body: input.body,
            tags: input.tags,
            frontmatter: input.frontmatter as any,
          }, input.version as any);
          return { content: [{ type: "json", data: { note: updated } }] };
        } catch (e) {
          return { content: [{ type: "text", text: (e as Error).message }], isError: true };
        }
      },
    );

    // delete_note
    this.sdk.tool(
      "delete_note",
      "Delete a note by id+version.",
       { id: z.string(), version: z.string() },
      async (input: { id: string; version: string }) => {
        const svc = this.requireService();
        try {
          const ok = await svc.delete(input.id as any, input.version as any);
            if (!ok) return { content: [{ type: "text", text: "NoteNotFound" }], isError: true };
            return { content: [{ type: "json", data: { ok: true } }] };
        } catch (e) {
          return { content: [{ type: "text", text: (e as Error).message }], isError: true };
        }
      },
    );

    // metrics
    this.sdk.tool(
      "metrics",
      "Basic metrics: note count + uptime.",
      {},
      async () => {
        const svc = this.requireService();
        const notes = await svc.list({} as any);
        return { content: [{ type: "json", data: { notes: notes.length, uptimeMs: Date.now(), serverRunning: this.running } }] };
      },
    );
  }

  private authOk(url: URL, headers: Headers): boolean {
    if (!this.apiKey) return false; // server not ready until key set
    const auth = headers.get("authorization") || "";
    const bearer = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : null;
    const q = url.searchParams.get("key");
    const provided = bearer || q || null;
    return !!provided && provided === this.apiKey;
  }

  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;

    // StreamableHTTPServerTransport start is handled by sdk.connect
    await this.sdk.connect(this.transport as any);

    this.httpServer = createServer((req, res) => {
      const url = new URL(req.url || "/", `http://localhost:${this.port}`);

      if (url.pathname === "/health") {
        res.statusCode = 200;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ ok: true }));
        return;
      }

      if (url.pathname === "/mcp") {
        if (!this.authOk(url, new Headers(req.headers as any))) {
          res.statusCode = this.apiKey ? 401 : 503;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: { code: this.apiKey ? "Unauthorized" : "ServerNotReady" } }));
          return;
        }
        // Delegate to SDK transport (handles JSON-RPC + SSE if Accept header)
        this.transport.handleRequest(req, res);
        return;
      }

      res.statusCode = 404;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: { code: "NotFound" } }));
    });

    this.httpServer.listen(this.port, "0.0.0.0", () => {
      log.start(`MCP server (SDK) listening http://localhost:${this.port}`);
      log.info(`Health: http://localhost:${this.port}/health`);
      log.info(`MCP: http://localhost:${this.port}/mcp`);
    });
  }

  async stop(): Promise<void> {
    if (!this.running) return;
    this.running = false;
    await this.sdk.close();
    await new Promise<void>((resolve) => this.httpServer?.close(() => resolve()));
    this.httpServer = null;
    log.stop("MCP server stopped");
  }
}
