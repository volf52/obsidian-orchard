import type { McpServer } from "./mcp-server";

export interface RpcResult {
  jsonrpc: string;
  id: number;
  result?: any;
  error?: { code: number; message?: string };
}

const PROTOCOL_VERSION = "2024-11-05";
let sessionId: string | null = null;

function nextId() {
  return Math.floor(Math.random() * 1e9);
}

export async function rpcCall(key: string, method: string, params: any) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
  };
  if (sessionId) {
    headers["Mcp-Session-Id"] = sessionId;
    headers["Mcp-Protocol-Version"] = PROTOCOL_VERSION;
  }
  const res = await fetch(`http://localhost:27126/mcp?key=${encodeURIComponent(key)}`, {
    method: "POST",
    headers,
    body: JSON.stringify({ jsonrpc: "2.0", id: nextId(), method, params }),
  });
  let data: RpcResult;
  try {
    data = (await res.json()) as RpcResult;
  } catch {
    data = { jsonrpc: "2.0", id: -1, error: { code: res.status, message: "NonJSON" } };
  }
  const sid = res.headers.get("mcp-session-id");
  if (!sessionId && sid) sessionId = sid;
  return { status: res.status, body: data };
}

export async function initialize(key: string) {
  return rpcCall(key, "initialize", {
    protocolVersion: PROTOCOL_VERSION,
    capabilities: {},
    clientInfo: { name: "orchard-tests", version: "0.0.0" },
  });
}

export async function callTool(key: string, name: string, args?: any) {
  const { status, body } = await rpcCall(key, "tools/call", { name, arguments: args });
  return { status, body };
}

export async function listTools(key: string) {
  return rpcCall(key, "tools/list", {});
}

export function extractJsonContent(result: any): any {
  if (!result) return undefined;
  const content = result.content ?? [];
  const textPart = content.find((c: any) => c.type === "text");
  if (textPart && typeof textPart.text === "string") {
    try { return JSON.parse(textPart.text); } catch { /* fallthrough */ }
  }
  const jsonPart = content.find((c: any) => c.type === "json");
  return jsonPart ? jsonPart.data : content;
}

export function isErrorResult(result: any): boolean {
  return !!result?.isError;
}

export function extractErrorCode(result: any): string | undefined {
  if (!result) return undefined;
  const part = (result.content || []).find((c: any) => c.type === "text");
  if (!part || typeof part.text !== "string") return undefined;
  return part.text.split(/\s+/)[0];
}

export function resetSessionForTests() {
  sessionId = null;
}

export const TestProtocolVersion = PROTOCOL_VERSION;
