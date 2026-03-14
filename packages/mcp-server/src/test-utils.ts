export interface RpcResult<TResult = unknown> {
  jsonrpc: string
  id: number
  result?: TResult
  error?: { code: number; message?: string }
}

const PROTOCOL_VERSION = '2024-11-05'
let sessionId: string | null = null

/**
 * Generates a pseudo-random request identifier.
 *
 * @returns An integer greater than or equal to 0 and less than 1e9
 */
function nextId() {
  return Math.floor(Math.random() * 1e9)
}

/**
 * Performs a JSON-RPC request against the local MCP server and returns the HTTP status together with the normalized RPC response.
 *
 * This may update the module-level sessionId from the response header if a session has not yet been established.
 *
 * @param key - Authentication or identification key appended to the request URL
 * @param method - RPC method name to invoke
 * @param params - Key/value map of RPC parameters to include in the request payload
 * @returns An object containing the HTTP response `status` and the RPC `body` where `jsonrpc` and `id` are normalized and `result` or `error` (with `code` and optional `message`) are propagated from the server response
 */
export async function rpcCall<TResult = unknown>(
  key: string,
  method: string,
  params: Record<string, unknown>,
): Promise<{ status: number; body: RpcResult<TResult> }> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json, text/event-stream',
  }
  if (sessionId) {
    headers['Mcp-Session-Id'] = sessionId
    headers['Mcp-Protocol-Version'] = PROTOCOL_VERSION
  }
  const res = await fetch(
    `http://localhost:27126/mcp?key=${encodeURIComponent(key)}`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({ jsonrpc: '2.0', id: nextId(), method, params }),
    },
  )
  let data: RpcResult<TResult>
  try {
    const parsed = (await res.json()) as Partial<RpcResult<TResult>>
    data = {
      jsonrpc: typeof parsed.jsonrpc === 'string' ? parsed.jsonrpc : '2.0',
      id: typeof parsed.id === 'number' ? parsed.id : -1,
      result: parsed.result,
      error: parsed.error,
    }
  } catch {
    data = {
      jsonrpc: '2.0',
      id: -1,
      error: { code: res.status, message: 'NonJSON' },
    }
  }
  const sid = res.headers.get('mcp-session-id')
  if (!sessionId && sid) sessionId = sid
  return { status: res.status, body: data }
}

/**
 * Start an MCP session for the test client using the configured protocol version.
 *
 * @param key - Authentication key appended to the MCP request URL
 * @returns The HTTP response status and the normalized JSON-RPC result body for the initialize call
 */
export async function initialize(key: string) {
  return rpcCall(key, 'initialize', {
    protocolVersion: PROTOCOL_VERSION,
    capabilities: {},
    clientInfo: { name: 'orchard-tests', version: '0.0.0' },
  })
}

/**
 * Invoke a named tool through the MCP endpoint and return the HTTP status and RPC response.
 *
 * @param key - Authentication or identification key used in the request URL
 * @param name - The tool name to invoke
 * @param args - Optional arguments to pass to the tool
 * @returns An object containing the HTTP response `status` and the RPC `body` (the `RpcResult` for the call)
 */
export async function callTool(
  key: string,
  name: string,
  args: Record<string, unknown> | undefined,
) {
  const { status, body } = await rpcCall(key, 'tools/call', {
    name,
    arguments: args,
  })
  return { status, body }
}

/**
 * Retrieve the list of available tools from the server.
 *
 * @param key - Authentication key included in the request URL
 * @returns An object with `status` set to the HTTP response code and `body` set to an `RpcResult` whose `result` contains the tools listing (or `error` on failure)
 */
export async function listTools(key: string) {
  return rpcCall(key, 'tools/list', {})
}

export interface ToolContent {
  type: string
  text?: string
  data?: unknown
}

export interface ToolResult {
  content?: ToolContent[]
  isError?: boolean
}

/**
 * Extracts JSON-like content from a tool result, preferring parsed text.
 *
 * Attempts to parse the first content item with type "text" as JSON; if parsing fails or no such
 * text item exists, returns the first content item with type "json"'s data. If neither are present,
 * returns the full content array. Returns `undefined` when `result` is `undefined`.
 *
 * @param result - The tool result to extract content from
 * @returns The parsed JSON value from a text item, the `data` of a JSON item, the content array, or `undefined`
 */
export function extractJsonContent(result: ToolResult | undefined): unknown {
  if (!result) return undefined
  const content = result.content ?? []
  const textPart = content.find(
    (c): c is ToolContent & { text: string } =>
      c.type === 'text' && typeof c.text === 'string',
  )
  if (textPart) {
    try {
      return JSON.parse(textPart.text)
    } catch {
      /* fallthrough */
    }
  }
  const jsonPart = content.find((c) => c.type === 'json')
  return jsonPart ? jsonPart.data : content
}

/**
 * Determine whether a tool result represents an error.
 *
 * @returns `true` if the provided `result` has its `isError` flag set, `false` otherwise.
 */
export function isErrorResult(result: ToolResult | undefined): boolean {
  return !!result?.isError
}

/**
 * Extracts the leading error code token from the first text content item in a tool result.
 *
 * @param result - The tool result to inspect; may be undefined
 * @returns The first whitespace-delimited token from the first content item with type `"text"`, or `undefined` if no such content exists
 */
export function extractErrorCode(
  result: ToolResult | undefined,
): string | undefined {
  if (!result) return undefined
  const part = (result.content || []).find(
    (c): c is ToolContent & { text: string } =>
      c.type === 'text' && typeof c.text === 'string',
  )
  if (!part) return undefined
  return part.text.split(/\s+/)[0]
}

/**
 * Clear the internal MCP session state used by tests.
 *
 * Resets the stored session identifier to `null` so subsequent test calls do not reuse an existing session.
 */
export function resetSessionForTests() {
  sessionId = null
}

export const TestProtocolVersion = PROTOCOL_VERSION
