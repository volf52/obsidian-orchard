import { Hono } from "hono";
import { serve } from "@hono/node-server";
import type { NoteService } from "@orchard/core";
import { z } from "zod";
import { McpServer as SdkMcpServer } from "@modelcontextprotocol/sdk/server/mcp";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp";
import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types";

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

export class McpServer {
  private httpServer: ReturnType<typeof serve> | null = null;
  private readonly port: number;
  private noteService: NoteService | null;
  private apiKey: string | null;
  private readonly app = new Hono();
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

    // register tools with SDK
    this.registerTools();

    // streamable HTTP transport; enable JSON responses for POST convenience
    this.transport = new StreamableHTTPServerTransport({ enableJsonResponse: true });

    this.configureRoutes();
  }

  setNoteService(svc: NoteService) { this.noteService = svc; }

  private requireService(): NoteService {
    if (!this.noteService) throw new McpError(ErrorCode.InternalError, "NoteServiceUnavailable");
    return this.noteService;
  }

  private registerTools() {
    // list_notes
    this.sdk.tool(
      "list_notes",
      "List notes (optional tag/search filters). Returns slim metadata.",
      { tag: z.string().optional(), search: z.string().optional() },
      async (args) => {
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
      async (args) => {
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
      async (input) => {
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
      async (input) => {
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
      async (input) => {
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

  private configureRoutes() {
    this.app.get("/health", (c) => c.json({ ok: true }));

    // Streamable HTTP transport endpoints: we forward GET/POST/DELETE to transport handler
    this.app.all("/mcp", async (c) => {
      if (!this.apiKey) return c.json({ error: { code: "ServerNotReady" } }, 503);
      const auth = c.req.header("authorization") || "";
      const bearer = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : null;
      const q = c.req.query("key");
      const provided = bearer || q || null;
      if (!provided || provided !== this.apiKey) return c.json({ error: { code: "Unauthorized" } }, 401);

      // Hono provides Request/Response; transport expects Node req/res, so we drop to Node handler
      // Workaround: Use c.env.incoming? Not available. Instead create a Node-like adapter not ideal; simplest is to bypass and manually use internal handler via fetch semantics.
      // For now, we respond with 501 directing clients to use raw HTTP server (since full adapter is non-trivial in this context).
      return c.json({ error: { code: "NotImplemented", message: "Direct /mcp via Hono not yet wired to StreamableHTTPServerTransport" } }, 501);
    });
  }

  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;

    // Start transport (no-op) then connect SDK (needs a transport)
    await this.transport.start();

    // We host the raw transport handlers under /mcp internally by accessing Node req/res via server's fetch callback.
    // So we create a custom fetch that intercepts /mcp and passes to transport.handleRequest.
    const originalFetch = this.app.fetch;
    const transport = this.transport; // capture
    const sdk = this.sdk;

    // Ensure tool handlers registered
    (sdk as any).setToolRequestHandlers?.();

    const wrappedFetch: typeof originalFetch = async (req, env, execCtx) => {
      const url = new URL(req.url);
      if (url.pathname === "/mcp") {
        // We need Node's IncomingMessage/ServerResponse; Bun's fetch provides Request only.
        // Fallback: accept only POST initialize + tool requests via transport JSON mode not available here; thus we manually parse and dispatch using sdk.server.
        // For simplicity: emulate minimal subset by forwarding JSON-RPC to sdk.server.request
        try {
          const body = req.method === "POST" ? await req.json() : null;
          if (req.method === "POST") {
            const response = await (sdk as any).server.handleRequest(body); // internal API (not public) may differ
            return new Response(JSON.stringify(response), { status: 200, headers: { "Content-Type": "application/json" } });
          }
          if (req.method === "GET") {
            return new Response(JSON.stringify({ error: { code: "MethodNotAllowed" } }), { status: 405 });
          }
          return new Response(JSON.stringify({ error: { code: "MethodNotAllowed" } }), { status: 405 });
        } catch (e) {
          return new Response(JSON.stringify({ error: { code: "InternalError", message: (e as Error).message } }), { status: 500 });
        }
      }
      return originalFetch(req, env, execCtx);
    };

    this.httpServer = serve({
      fetch: wrappedFetch,
      port: this.port,
      hostname: "0.0.0.0",
    }, (info) => {
      log.start(`MCP server (SDK) listening http://localhost:${info.port}`);
      log.info(`Health: http://localhost:${info.port}/health`);
      log.info(`MCP: http://localhost:${info.port}/mcp`);
    });

    // Connect SDK to transport placeholder (no actual underlying streams yet)
    await this.sdk.connect(this.transport as any);
  }

  async stop(): Promise<void> {
    if (!this.running) return;
    this.running = false;
    await this.sdk.close();
    this.httpServer?.close();
    this.httpServer = null;
    log.stop("MCP server stopped");
  }
}
