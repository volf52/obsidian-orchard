# Orchard HTTP Server

Primary Orchard HTTP API for status and (future) extended services. Separate from the MCP server.

## Endpoints

- `GET /health` – liveness check
- `GET /api/status` – protected; requires `Authorization: Bearer <API_KEY>`

## Environment

Use `API_KEY` to enable protected route authentication.

## Development

```text
bun test packages/server/src/server.test.ts
bun run build.ts
```

## Notes

- Designed as a baseline module host; features intentionally minimal.
- Future: integrate Orchard core services or proxy to MCP server.
