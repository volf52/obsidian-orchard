# Agent Guidelines for obsidian-orchard

Build: `bun --bun run build.ts`; Type: `bun run tc`; Svelte: `bun run check`
Lint: `bun run lint`; Fix: `bun run lint:fix`; Format (Biome): `bun run fmt`
Tests (all): `bun test`; Watch: `bun test --watch`; Single: `bun test path/to/file.test.ts`
Runtime: Bun + TS 5.8 strict (`noImplicitAny`, `strictNullChecks`)
Types: Prefer explicit exported return types; local inference OK
Imports: Use `@/*` alias, keep grouped/sorted, remove unused
Naming: camelCase vars/functions; PascalCase components/classes/types; UPPER_SNAKE consts
Svelte: Use runes `$props()`, `$state()`; avoid legacy patterns
Structure: Feature folders under `src/` (components, modules, services, utils)
Errors: Throw `Error` with context or typed helpers; never raw strings
Validation: Narrow external data early; use discriminated unions over enums for variants
Side Effects: Avoid at top-level (except constants/registration)
Formatting: Biome (2 spaces, double quotes, semicolons, trailing commas)
Diffs: Keep PRs minimal; no unrelated refactors or mass renames
Modules: ES modules only; avoid dynamic `require`
Async: Always `await`; handle rejections (`try/catch` or explicit `.catch`)
Performance: Stream/iterate large data; debounce high-frequency UI events
Search: Prefer `rg` (ripgrep) over grep; respect `.gitignore`
Security: Do not log secrets or API keys; sanitize user inputs
(If .cursor or Copilot rules are added later, integrate them here)

## MCP Server Environment Variables

- `MCP_PORT` / `PORT`: Override default MCP server port (default 27126). `MCP_PORT` takes precedence when both set.
- `MCP_API_KEY` / `API_KEY`: API key required for all `/mcp/*` endpoints and event stream. If unset, server returns `ServerNotReady` until a key is provided via constructor.
- `MCP_PING_INTERVAL_MS`: Interval (ms) for SSE heartbeat `ping` events (default 30000). Values < 1000 are clamped to 1000 internally, but an immediate initial ping is emitted when an interval < 1000 is requested (used in tests).

## MCP Server Behavior Notes

- SSE endpoint: `/mcp/events` emits `ready` then periodic `ping` events plus broadcasted note events (`note.created`, `note.updated`, `note.deleted`).
- Broadcasts after server stop are safely ignored (logged as skipped) to avoid errors during shutdown.
- Note listing (`GET /mcp/notes`) currently returns slim metadata (id, title, version). Frontmatter, tags, body require a follow-up read (`GET /mcp/notes/:id`).
