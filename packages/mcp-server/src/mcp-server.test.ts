import { describe, expect, it, beforeAll, afterAll } from "bun:test";
import { McpServer } from "./mcp-server";
import { NoteService, createMemoryAdapter } from "@orchard/core";

interface RpcResult {
  jsonrpc: string;
  id: number;
  result?: any;
  error?: { code: number; message: string };
}

let sessionId: string | null = null;

async function rpcCall(key: string, method: string, params: any) {
  const headers: Record<string, string> = { "Content-Type": "application/json", Accept: "application/json, text/event-stream" };
  if (sessionId) {
    headers["Mcp-Session-Id"] = sessionId;
    headers["Mcp-Protocol-Version"] = "2024-11-05";
  }
  const res = await fetch(`http://localhost:27126/mcp?key=${encodeURIComponent(key)}`, {
    method: "POST",
    headers,
    body: JSON.stringify({ jsonrpc: "2.0", id: Math.floor(Math.random() * 1e9), method, params }),
  });
  const data = (await res.json()) as RpcResult;
  // (diagnostics removed)
  const sid = res.headers.get("mcp-session-id");
  if (!sessionId && sid) sessionId = sid;
  return { status: res.status, body: data };
}

async function initialize(key: string) {
  return rpcCall(key, "initialize", { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "orchard-tests", version: "0.0.0" } });
}

function extractJsonContent(result: any): any {
  if (!result) return undefined;
  const content = result.content ?? [];
  const jsonPart = content.find((c: any) => c.type === "json");
  if (jsonPart) return jsonPart.data;
  const textPart = content.find((c: any) => c.type === "text" && typeof c.text === "string" && c.text.trim().startsWith("{"));
  if (textPart) {
    try { return JSON.parse(textPart.text); } catch { /* ignore */ }
  }
  return content;
}

function isErrorResult(result: any): boolean {
  return !!result?.isError;
}

// Helper wrappers for tools/call
async function callTool(key: string, name: string, args?: any) {
  const { status, body } = await rpcCall(key, "tools/call", { name, arguments: args });
  return { status, body };
}

async function listTools(key: string) {
  return rpcCall(key, "tools/list", {});
}

describe("McpServer (MCP SDK HTTP Transport)", () => {
  let server: McpServer;
  let svc: NoteService;
  let testKey: string;

  beforeAll(async () => {
    svc = new NoteService({ adapter: createMemoryAdapter() });
    testKey = "testkey1234567890";
    server = new McpServer({ noteService: svc, apiKey: testKey });
    await server.start();
    await new Promise((r) => setTimeout(r, 40));
  });

  afterAll(async () => {
    await server.stop();
  });

  it("health endpoint responds", async () => {
    const res = await fetch("http://localhost:27126/health");
    expect(res.status).toBe(200);
    const data: any = await res.json();
    expect(data.ok).toBe(true);
  });

  it("initializes then lists tools", async () => {
    const init = await initialize(testKey);

    expect(init.body.result?.protocolVersion || init.body.result?.serverInfo).toBeTruthy();
    const { body } = await listTools(testKey);
    expect(body.result?.tools?.some((t: any) => t.name === "create_note")).toBe(true);
  });

  it("creates notes and lists via list_notes filters", async () => {
    const c = await callTool(testKey, "create_note", { id: "Alpha", body: "Hello", tags: ["tagA"] });

    const createdData = extractJsonContent(c.body.result);
    expect(createdData.note.id).toBe("alpha.md");

    await callTool(testKey, "create_note", { id: "Beta", body: "Searchable Body", tags: ["tagB"] });
    await callTool(testKey, "create_note", { id: "Gamma", body: "Mixed Search Text", tags: ["tagA", "tagB"] });

    const listAll = await callTool(testKey, "list_notes", {});
    const listAllData = extractJsonContent(listAll.body.result);
    expect(Array.isArray(listAllData.notes)).toBe(true);
    expect(listAllData.notes.find((n: any) => n.id === "alpha.md")).toBeTruthy();

    const tagA = await callTool(testKey, "list_notes", { tag: "tagA" });
    const tagAData = extractJsonContent(tagA.body.result);
    expect(tagAData.notes.every((n: any) => ["alpha.md", "gamma.md"].includes(n.id))).toBe(true);

    const search = await callTool(testKey, "list_notes", { search: "search" });
    const searchData = extractJsonContent(search.body.result);
    const ids = searchData.notes.map((n: any) => n.id).sort();
    expect(ids).toEqual(["beta.md", "gamma.md"]);
  });

  it("gets a note", async () => {
    const r = await callTool(testKey, "get_note", { id: "alpha.md" });
    const data = extractJsonContent(r.body.result);
    expect(data.note.body).toBe("Hello");
  });

  it("normalizes id case + extension on create", async () => {
    const created = await callTool(testKey, "create_note", { id: "MixedCase", body: "C" });
    const createdData = extractJsonContent(created.body.result);
    expect(createdData.note.id).toBe("mixedcase.md");
    const dup = await callTool(testKey, "create_note", { id: "MixedCase", body: "C" });
    expect(isErrorResult(dup.body.result)).toBe(true);
  });

  it("updates note with version and enforces conflicts", async () => {
    const current = await callTool(testKey, "get_note", { id: "alpha.md" });
    const currentData = extractJsonContent(current.body.result);
    const v = currentData.note.version;
    const upd = await callTool(testKey, "update_note", { id: "alpha.md", version: v, body: "Hello2" });
    const updData = extractJsonContent(upd.body.result);
    expect(updData.note.body).toBe("Hello2");
    const conflict = await callTool(testKey, "update_note", { id: "alpha.md", version: v, body: "X" });
    expect(isErrorResult(conflict.body.result)).toBe(true);
  });

  it("deletes note with version", async () => {
    const current = await callTool(testKey, "get_note", { id: "alpha.md" });
    const v = extractJsonContent(current.body.result).note.version;
    const del = await callTool(testKey, "delete_note", { id: "alpha.md", version: v });
    const delData = extractJsonContent(del.body.result);
    expect(delData.ok).toBe(true);
    const missing = await callTool(testKey, "get_note", { id: "alpha.md" });
    expect(isErrorResult(missing.body.result)).toBe(true);
  });

  it("metrics tool returns counts", async () => {
    const m = await callTool(testKey, "metrics", {});
    const mData = extractJsonContent(m.body.result);
    expect(typeof mData.notes).toBe("number");
    expect(typeof mData.uptimeMs).toBe("number");
  });
});
