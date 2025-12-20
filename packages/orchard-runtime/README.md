# Orchard Runtime

Orchestration helpers that sit above the pure domain layer (`@orchard/core`). These utilities handle environment setup, late discovery/attachment of infrastructure, and event bridging without polluting core domain objects.

## Exports

### `lateAttach(options)`
Polls for infrastructure (e.g. a `NoteService` created by another plugin) and applies it when available.

```ts
import { lateAttach } from "@orchard/runtime";

const handle = lateAttach({
  probe: () => maybeGetInfra(), // return { noteService, events? } or null
  apply: (infra) => server.setNoteService(infra.noteService),
  intervalMs: 1000,      // optional (default 1000ms, min 50ms)
  timeoutMs: 15000,      // optional (default 10000ms)
  onAttempt: (n) => console.debug("attach attempt", n),
  onAttached: (_, n) => console.info("attached after", n, "attempts"),
  onTimeout: (attempts) => console.warn("gave up after", attempts),
});

await handle.completed; // resolves true if attached, false if cancelled/timeout
// handle.cancel() to abort early
```

Behavior:
- Fires an immediate first probe (zero-delay) then repeats every `intervalMs`.
- Swallows probe errors to remain resilient until timeout.
- Resolves `completed` when attached or timed out/cancelled.

Use cases:
- Host loads server before core note plugin.
- Dynamic reloading / hot-swapping backends.

### `bridgeNoteEvents({ events, target })`
Subscribes to core note events and forwards minimal payloads to a broadcast target (e.g. an MCP server with a `broadcast(event, params)` method).

Forwarded events:
- `note.created` → `{ id, version }`
- `note.updated` → `{ id, version, previousVersion }`
- `note.deleted` → `{ id, previousVersion }`

Example:
```ts
bridgeNoteEvents({ events: coreEvents, target: mcpServer });
```

### `createInMemoryNoteEnv()`
Convenience factory returning an ephemeral `NoteService` + event bus for tests, demos, or isolated tooling.

```ts
import { createInMemoryNoteEnv } from "@orchard/runtime";

const { noteService, events } = createInMemoryNoteEnv();
await noteService.create({ id: "hello.md", body: "Hi" });
```

## Layering Rationale
- `@orchard/core`: Pure domain (no polling, no external side effects beyond supplied event bus).
- `@orchard/runtime`: Glue code that wires domain objects into real or deferred environments.

Keeping orchestration separate preserves testability and reduces churn in the core package when host integration patterns evolve.

## Roadmap Ideas
- Cancellation / replacement helper that coordinates multiple concurrent late attaches.
- Structured logging adapter injection.
- Optional metrics hooks for attachment timing.

## Development
No build step beyond repo root build; imported by sibling packages.

```bash
bun run build.ts   # from repo root
bun test            # run all tests (runtime currently has none)
```
