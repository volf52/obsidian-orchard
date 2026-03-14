# Orchard Core

Core domain library for Orchard notes: in-memory adapter, note service, hashing, and event bus utilities.

## Highlights

- `NoteService` with optimistic concurrency via version hashes
- In-memory adapter (pluggable future stores)
- Event bus for create/update/delete
- Deterministic `hash` helper

## API Sketch

```ts
const svc = new NoteService({ adapter: createMemoryAdapter() })
const note = await svc.create({ id: "hello.md", body: "Hi" })
const read = await svc.read("hello.md")
const updated = await svc.update("hello.md", { body: "New" }, note.version)
await svc.delete("hello.md", updated.version)
```

## Events

Subscribe via the adapter/service event emitter (see tests) for `note.created`, `note.updated`, `note.deleted` payloads.

## Layering

This package is intentionally free of orchestration concerns (no polling, server wiring, or host plugin assumptions). Utilities that adapt the domain to runtime environments live in `@orchard/runtime` (e.g. late attachment polling, event bridging, in‑memory env helpers). Keeping the core pure:

- Improves determinism and test coverage.
- Avoids churn when host integration patterns change.
- Encourages small focused abstractions.

## Development

```text
bun test packages/orchard-core/src/note-service.test.ts
```

## Roadmap

- Persistence adapters (filesystem, SQLite, remote)
- Batch operations & pagination
- Rich frontmatter querying
