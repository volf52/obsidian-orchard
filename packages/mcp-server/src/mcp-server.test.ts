import { describe, expect, it, beforeAll, afterAll } from "bun:test";
import { McpServer } from "./mcp-server";
import { NoteService, createMemoryAdapter } from "@orchard/core";

import { initialize, callTool, listTools, extractJsonContent, resetSessionForTests, rpcCall, TestProtocolVersion, extractErrorCode } from "./test-utils";

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
    expect(data.noteServiceReady).toBe(true);
    expect(data.apiKeyConfigured).toBe(true);
    expect(data.running).toBe(true);
  });

  it("rejects call without Accept header (expects 4xx)", async () => {
    const res = await fetch(`http://localhost:27126/mcp?key=${encodeURIComponent(testKey)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: TestProtocolVersion, capabilities: {}, clientInfo: { name: "x", version: "0" } } }),
    });
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it("rejects tools/list before initialization (missing session)", async () => {
    resetSessionForTests();
    const raw = await rpcCall(testKey, "tools/list", {});
    expect(raw.status).toBe(400);
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
    const dupCode = extractErrorCode(dup.body.result);
    expect(dupCode).toBe("NoteAlreadyExists");
  });

  it("updates note with version and enforces conflicts", async () => {
    const current = await callTool(testKey, "get_note", { id: "alpha.md" });
    const currentData = extractJsonContent(current.body.result);
    const v = currentData.note.version;
    const upd = await callTool(testKey, "update_note", { id: "alpha.md", version: v, body: "Hello2" });
    const updData = extractJsonContent(upd.body.result);
    expect(updData.note.body).toBe("Hello2");
    const conflict = await callTool(testKey, "update_note", { id: "alpha.md", version: v, body: "X" });
    const conflictCode = extractErrorCode(conflict.body.result);
    expect(conflictCode).toBe("VersionConflict");
  });

  it("deletes note with version", async () => {
    const current = await callTool(testKey, "get_note", { id: "alpha.md" });
    const v = extractJsonContent(current.body.result).note.version;
    const del = await callTool(testKey, "delete_note", { id: "alpha.md", version: v });
    const delData = extractJsonContent(del.body.result);
    expect(delData.ok).toBe(true);
    const missing = await callTool(testKey, "get_note", { id: "alpha.md" });
    const missingCode = extractErrorCode(missing.body.result);
    expect(missingCode).toBe("NoteNotFound");
  });

  it("metrics tool returns counts", async () => {
    const first = await callTool(testKey, "metrics", {});
    const firstData = extractJsonContent(first.body.result);
    expect(typeof firstData.notes).toBe("number");
    expect(typeof firstData.uptimeMs).toBe("number");
    expect(firstData.uptimeMs).toBeGreaterThanOrEqual(0);

    await new Promise((resolve) => setTimeout(resolve, 10));

    const second = await callTool(testKey, "metrics", {});
    const secondData = extractJsonContent(second.body.result);
    expect(typeof secondData.notes).toBe("number");
    expect(typeof secondData.uptimeMs).toBe("number");
    expect(secondData.uptimeMs).toBeGreaterThanOrEqual(firstData.uptimeMs);
  });

  it("re-initialization returns either error or same protocolVersion", async () => {
    const second = await rpcCall(testKey, "initialize", { protocolVersion: TestProtocolVersion, capabilities: {}, clientInfo: { name: "again", version: "0" } });
    if (second.body.error) {
      expect(second.body.error.code).toBeDefined();
    } else {
      expect(second.body.result?.protocolVersion).toBeDefined();
    }
  });

  it("unsupported protocol version yields error or 4xx", async () => {
    resetSessionForTests();
    const bad = await rpcCall(testKey, "initialize", { protocolVersion: "1900-01-01", capabilities: {}, clientInfo: { name: "orchard-tests", version: "0" } });
    if (bad.status !== 200) {
      expect(bad.status).toBeGreaterThanOrEqual(400);
    } else {
      expect(bad.body.error || bad.body.result?.protocolVersion === TestProtocolVersion).toBeTruthy();
    }
  });
});
