# Orchard MCP Server

Minimal HTTP + SSE server exposing Orchard note CRUD and real‑time events for MCP tooling / external automation.

## Features
- Health check: `GET /health` (no auth)
- Authenticated endpoints under `/mcp/*` using API key (query `?key=` or `Authorization: Bearer`)
- Note operations:
  - `GET /mcp/notes` (filters: `?tag=foo`, `?search=substr`)
  - `GET /mcp/notes/:id`
  - `POST /mcp/notes` (create)
  - `PUT /mcp/notes/:id` (update with `version` for optimistic concurrency)
  - `DELETE /mcp/notes/:id?version=<v>`
- SSE stream: `GET /mcp/events?key=...` emits:
  - `ready`
  - heartbeat `ping` (interval configurable)
  - note events: `note.created`, `note.updated`, `note.deleted`
- Metrics: `GET /mcp/metrics` (counts clients, notes, ping interval)
- Graceful broadcast guard (no throw after stop)

## Environment Variables
| Name | Purpose | Default |
|------|---------|---------|
| `MCP_PORT` / `PORT` | Listening port | `27126` |
| `MCP_API_KEY` / `API_KEY` | API key for auth | (none) |
| `MCP_PING_INTERVAL_MS` | Heartbeat interval (ms). Values <1000 clamped to 1000; <1000 triggers immediate extra ping (tests) | `30000` |

Constructor options override env vars.

## Error Shape
All errors use `{ error: { code, message } }` with stable codes (e.g. `Unauthorized`, `MissingVersion`, `VersionConflict`, `NotFound`).

## Development
```
bun test packages/mcp-server/src/mcp-server.test.ts
bun run build.ts
```

## Example (Create + Stream)
```bash
API_KEY=devkey bun node ./dist/mcp-server.js &
# list notes
xh get :27126/mcp/notes key==devkey
# stream events
xh get :27126/mcp/events key==devkey
# create a note
xh post :27126/mcp/notes key==devkey id=TestNote body='Hello'
```

## Roadmap Ideas
- Pagination & detailed list variant
- Multi-tag filtering semantics
- Structured type exports for event payloads
- Optional rate limiting / metrics expansion
