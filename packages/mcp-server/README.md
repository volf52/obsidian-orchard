# Orchard MCP Server

Minimal HTTP JSON-RPC endpoint exposing Orchard note CRUD via MCP Streamable HTTP transport (JSON-RPC + session + optional SSE-ready).

## Features
- Health check: `GET /health` (no auth)
- Single authenticated JSON-RPC endpoint: `POST /mcp` (API key via `?key=` or `Authorization: Bearer <key>`)
- Supported JSON-RPC methods:
  - `tools/list` → lists available tools
  - `tools/call` → invoke a tool by name with arguments
- Tools implemented:
  - `list_notes` (filters: `tag`, `search`)
  - `list_tags` (unique tags with usage counts)
  - `get_note` (id)
  - `create_note` (id, title?, body?, tags?, frontmatter?)
  - `update_note` (id, version, optional fields)
  - `delete_note` (id, version)
  - `metrics` (note count + uptime flag)

### Health Endpoint
`GET /health` returns readiness fields:
```jsonc
{ "ok": true, "noteServiceReady": true, "apiKeyConfigured": true, "running": true }
```
`ok` is true only if both note service and API key are configured. If `ok` is false the status code is 503.

### Standalone Note Service
The MCP Obsidian plugin is now fully standalone: it always provisions its own `NoteService` on startup.

Storage modes:
- `vault` (default): Uses the active Obsidian vault (markdown files reflect create/update/delete operations).
- `memory`: Ephemeral in-memory adapter (no files written). Useful for transient experimentation.

Health semantics:
- `/health` returns `200` (`ok: true`) once both the API key and internal note service are initialized (normally immediate).
- `noteServiceReady` should always be `true` unless something failed catastrophically during initialization.

To switch storage mode (future): adjust plugin settings (planned). Currently the default is `vault`.

If embedding outside Obsidian you can still construct a server with your own adapter via `createMcpServer` or by instantiating `McpServer` directly.

## Environment Variables
| Name | Purpose | Default |
|------|---------|---------|
| `MCP_PORT` / `PORT` | Listening port | `27126` |
| `MCP_API_KEY` / `API_KEY` | API key for auth | (none) |

Constructor options override env vars.

## Session & Protocol

The server uses the MCP Streamable HTTP transport which requires a two-phase interaction:
1. Initialize: Send `initialize` request without `Mcp-Session-Id` header; server returns a `mcp-session-id` response header.
2. Subsequent RPC: Include `Mcp-Session-Id` and `Mcp-Protocol-Version` headers for all follow-up JSON-RPC calls (`tools/list`, `tools/call`, etc.).

Required headers for POST requests:
- `Accept: application/json, text/event-stream` (server enforces acceptable media types)
- `Content-Type: application/json`
- `Mcp-Session-Id: <value>` (after initialize only)
- `Mcp-Protocol-Version: 2024-11-05` (after initialize only)

If you omit the session headers after initialization, the server returns `400`. A request without an `Accept` header may be rejected (`>=406`).

Unsupported protocol versions will be rejected or ignored (see tests for expected behavior).

### Initialize Example (xh)
```bash
xh post :27126/mcp key==devkey \
  Accept:'application/json, text/event-stream' \
  Content-Type:application/json \
  jsonrpc=2.0 id=1 method=initialize \
  params:='{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"demo","version":"0"}}' -v
# capture mcp-session-id header from response
```

### Subsequent Tool Call
```bash
SESSION=... # value from mcp-session-id header
xh post :27126/mcp key==devkey \
  Accept:'application/json, text/event-stream' \
  Content-Type:application/json \
  Mcp-Session-Id:$SESSION \
  Mcp-Protocol-Version:2024-11-05 \
  jsonrpc=2.0 id=2 method=tools/list params:='{}'
```

## JSON-RPC Request Format
Send a POST to `/mcp` with body:
```jsonc
{ "jsonrpc": "2.0", "id": 1, "method": "tools/call", "params": { "name": "create_note", "arguments": { "id": "Test", "body": "Hello" } } }
```

List tools:
```jsonc
{ "jsonrpc": "2.0", "id": 2, "method": "tools/list", "params": {} }
```

Responses follow standard JSON-RPC 2.0. Tool results embed a `result` with shape `{ content: [...], isError? }`.

Note: Success responses now always use a single `text` content part whose `text` field is a JSON string. This avoids SDK type overloading issues with `{ type: "json" }` parts while keeping payloads consistent. Parse the string as JSON client-side.

### Response Content Format
All tool success responses emit exactly one text content part whose `text` value is a JSON string:
```jsonc
{
  "jsonrpc": "2.0",
  "id": 7,
  "result": {
    "content": [ { "type": "text", "text": "{\"note\":{...}}" } ]
  }
}
```
Client helpers should extract the first text part and `JSON.parse` it.

### Error Format
Tool errors use a single `text` content part plus `isError: true`.
The first token of the text string is a machine-stable error code; any additional JSON (optional) after a space may contain details.
Example:
```jsonc
{
  "jsonrpc": "2.0",
  "id": 8,
  "result": {
    "content": [ { "type": "text", "text": "NoteNotFound" } ],
    "isError": true
  }
}
```
Common error codes:
- `NoteAlreadyExists`
- `NoteNotFound`
- `VersionConflict`
- `NoteServiceUnavailable`
Other unexpected errors are normalized (non-alphanumeric replaced by `_`).

## Development
```
bun test packages/mcp-server/src/mcp-server.test.ts
bun run build.ts
```

## Example Usage
```bash
API_KEY=devkey bun node ./dist/mcp-server.js &
# list tools
xh post :27126/mcp key==devkey jsonrpc=2.0 id=1 method=tools/list params:='{}'
# create note
xh post :27126/mcp key==devkey jsonrpc=2.0 id=2 method=tools/call params:='{"name":"create_note","arguments":{"id":"Alpha","body":"Hello"}}'
# get note
xh post :27126/mcp key==devkey jsonrpc=2.0 id=3 method=tools/call params:='{"name":"get_note","arguments":{"id":"alpha.md"}}'
```

### Factory Helper
You can bootstrap an in-memory server quickly:
```ts
import { createMcpServer } from "@orchard/mcp-server";

const { server, noteService, start, stop } = await createMcpServer({ apiKey: process.env.MCP_API_KEY });
await start();
console.log("Health at http://localhost:27126/health");
// Later: await stop();
```
Provide `noteService` directly or a custom `createAdapter` if you need a different backing store.

## Roadmap Ideas
- Adopt official MCP transport once stable in this context
- Reintroduce real-time events via SSE or MCP notifications
- Pagination & detailed list variant
- Multi-tag filtering semantics
- Structured type exports for event payloads
- Optional rate limiting / metrics expansion
