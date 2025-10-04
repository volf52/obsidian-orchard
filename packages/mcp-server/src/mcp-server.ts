import { Hono } from "hono";
import { serve } from "@hono/node-server";
import type { NoteService } from "@orchard/core";
import { z } from "zod";

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

interface ToolDef<Input> {
  name: string;
  description: string;
  schema?: z.ZodTypeAny; // input schema
  execute: (input: Input) => Promise<any>;
}

export class McpServer {
  private server: ReturnType<typeof serve> | null = null;
  private readonly port: number;
  private noteService: NoteService | null;
  private apiKey: string | null;
  private readonly app = new Hono();
  private running = false;
  private tools: Record<string, ToolDef<any>> = {};

  constructor(opts: { port?: number; noteService?: NoteService; apiKey?: string } = {}) {
    const envPort = typeof process !== "undefined" ? Number(process.env.MCP_PORT || process.env.PORT) : undefined;
    this.port = opts.port ?? (envPort && !Number.isNaN(envPort) ? envPort : 27126);
    const envKey = typeof process !== "undefined" ? (process.env.MCP_API_KEY || process.env.API_KEY) : undefined;
    this.noteService = opts.noteService ?? null;
    this.apiKey = opts.apiKey ?? envKey ?? null;
    this.registerTools();
    this.configureRoutes();
  }

  setNoteService(svc: NoteService) { this.noteService = svc; }

  private requireService(): NoteService {
    if (!this.noteService) throw new Error("NoteServiceUnavailable");
    return this.noteService;
  }

  private addTool<Input>(def: ToolDef<Input>) {
    this.tools[def.name] = def;
  }

  private registerTools() {
    // list_notes
    this.addTool({
      name: "list_notes",
      description: "List notes (optional tag/search filters). Returns slim metadata.",
      schema: z.object({ tag: z.string().optional(), search: z.string().optional() }).optional(),
      execute: async ({ tag, search }: any) => {
        const svc = this.requireService();
        const notes = await svc.list({ tag, search } as any);
        const slim = notes.map((n) => ({ id: n.id, title: n.title, version: n.version }));
        return { content: [{ type: "json", data: { notes: slim } }] };
      },
    });

    // get_note
    this.addTool({
      name: "get_note",
      description: "Fetch full note by id.",
      schema: z.object({ id: z.string() }),
      execute: async ({ id }: any) => {
        const svc = this.requireService();
        const note = await svc.read(id as any);
        if (!note) throw new Error("NotFound");
        return { content: [{ type: "json", data: { note } }] };
      },
    });

    // create_note
    this.addTool({
      name: "create_note",
      description: "Create a note; id normalized + .md appended if missing.",
      schema: z.object({
        id: z.string(),
        title: z.string().optional(),
        body: z.string().optional(),
        tags: z.array(z.string()).optional(),
        frontmatter: z.record(z.any()).optional(),
      }),
      execute: async (input: any) => {
        const svc = this.requireService();
        try {
          const created = await svc.create({
            id: input.id,
            title: input.title,
            body: input.body,
            tags: input.tags,
            frontmatter: input.frontmatter as any,
          });
          return { content: [{ type: "json", data: { note: created } }], isError: false };
        } catch (e) {
          const msg = (e as Error).message;
          return { content: [{ type: "text", text: msg }], isError: true };
        }
      },
    });

    // update_note
    this.addTool({
      name: "update_note",
      description: "Update fields of a note with optimistic version.",
      schema: z.object({
        id: z.string(),
        version: z.string(),
        title: z.string().optional(),
        body: z.string().optional(),
        tags: z.array(z.string()).optional(),
        frontmatter: z.record(z.any()).optional(),
      }),
      execute: async (input: any) => {
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
          const msg = (e as Error).message;
          return { content: [{ type: "text", text: msg }], isError: true };
        }
      },
    });

    // delete_note
    this.addTool({
      name: "delete_note",
      description: "Delete a note by id+version.",
      schema: z.object({ id: z.string(), version: z.string() }),
      execute: async (input: any) => {
        const svc = this.requireService();
        try {
          const ok = await svc.delete(input.id as any, input.version as any);
          if (!ok) return { content: [{ type: "text", text: "NotFound" }], isError: true };
          return { content: [{ type: "json", data: { ok: true } }] };
        } catch (e) {
          const msg = (e as Error).message;
          return { content: [{ type: "text", text: msg }], isError: true };
        }
      },
    });

    // metrics
    this.addTool({
      name: "metrics",
      description: "Basic metrics: note count + uptime.",
      execute: async () => {
        const svc = this.requireService();
        const notes = await svc.list({} as any);
        return { content: [{ type: "json", data: { notes: notes.length, uptimeMs: Date.now(), serverRunning: this.running } }] };
      },
    });
  }

  private configureRoutes() {
    // Health (unauthenticated)
    this.app.get("/health", (c) => c.json({ ok: true }));

    // Single JSON-RPC endpoint supporting tools/list and tools/call
    this.app.post("/mcp", async (c) => {
      if (!this.apiKey) return c.json({ error: { code: "ServerNotReady" } }, 503);
      const auth = c.req.header("authorization") || "";
      const bearer = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : null;
      const q = c.req.query("key");
      const provided = bearer || q || null;
      if (!provided || provided !== this.apiKey) return c.json({ error: { code: "Unauthorized" } }, 401);

      try {
        const bodyText = await c.req.text();
        const req = JSON.parse(bodyText);
        const jsonrpc = req.jsonrpc || "2.0";
        const id = req.id;
        if (!req.method) {
          return c.json({ jsonrpc, id, error: { code: -32600, message: "Invalid Request" } }, 400);
        }
        if (req.method === "tools/list") {
          const tools = Object.values(this.tools).map(t => ({ name: t.name, description: t.description }));
          return c.json({ jsonrpc, id, result: { tools } });
        }
        if (req.method === "tools/call") {
          const name = req.params?.name;
          const args = req.params?.arguments;
          if (typeof name !== "string") return c.json({ jsonrpc, id, error: { code: -32602, message: "Missing tool name" } }, 400);
          const tool = this.tools[name];
          if (!tool) return c.json({ jsonrpc, id, error: { code: -32601, message: "Tool not found" } }, 404);
          try {
            const parsed = tool.schema ? tool.schema.parse(args) : args;
            const res = await tool.execute(parsed);
            return c.json({ jsonrpc, id, result: res });
          } catch (e) {
            return c.json({ jsonrpc, id, result: { content: [{ type: "text", text: (e as Error).message }], isError: true } });
          }
        }
        return c.json({ jsonrpc, id, error: { code: -32601, message: "Method not found" } }, 404);
      } catch (e) {
        log.error(`MCP handler error: ${(e as Error).message}`);
        return c.json({ error: { code: "InternalError", message: (e as Error).message } }, 500);
      }
    });
  }

  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;
    this.server = serve({
      fetch: this.app.fetch,
      port: this.port,
      hostname: "0.0.0.0",
    }, (info) => {
      log.start(`MCP server listening http://localhost:${info.port}`);
      log.info(`Health: http://localhost:${info.port}/health`);
      log.info(`/mcp: http://localhost:${info.port}/mcp`);
    });
  }

  async stop(): Promise<void> {
    if (!this.running) return;
    this.running = false;
    this.server?.close();
    this.server = null;
    log.stop("MCP server stopped");
  }
}
