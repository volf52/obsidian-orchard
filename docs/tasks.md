# Orchard Tasks Module

This guide documents the Orchard Task module that ships with the Obsidian plugin and MCP server. It covers the task note schema, folder layout, base configuration, naming guidance, and integration points for MCP-powered automations.

## Task note schema

Orchard task notes are Markdown files whose frontmatter is normalized to the following shape:

- `type`: Always `"orchard-task"`. Used to distinguish task notes from other Orchard records.
- `status`: Required status identifier (e.g., `Todo`, `Doing`, `Done`).
- `project`: Optional project bucket. `null` indicates an unassigned task.
- `due`: Optional ISO date string in `YYYY-MM-DD` (or `null`).
- `priority`: Optional priority identifier.
- `mcpSyncState`: Optional sync marker for external systems (commonly `pending`, `synced`, or `error`).

The core library validates and normalizes these values when reading or writing notes, ensuring the plugin and MCP tools can rely on consistent data.【F:packages/orchard-core/src/task.ts†L11-L109】

## Folder layout

By default the plugin writes task notes beneath `tasks/<year>/` using slugged filenames derived from the task title plus a timestamp suffix. The helper also exposes `expectedTaskFilePath` for reconciling legacy files that do not match the normalized layout.【F:packages/orchard/src/utils/task-files.ts†L1-L73】

Two companion files are managed automatically:

- **Task index note** – `Tasks/README.md` acts as the inline Dataview surface. The migration utilities ensure it always starts with the Orchard header and preserves any manually maintained "Inline Tasks" section.【F:packages/orchard/src/utils/task-files.ts†L74-L168】
- **Base definition** – `.obsidian/bases/orchard-tasks.base.json` stores the canonical Base description (columns for status, project, due date, priority, and MCP sync state). It is created or normalized as needed before task operations run.【F:packages/orchard/src/utils/task-files.ts†L8-L64】【F:packages/orchard/src/utils/task-files.ts†L104-L139】

## Base configuration

The runtime derives a `TaskSchema` from plugin settings. It normalizes the task folder and base path, deduplicates status and priority identifiers, and trims project group definitions so every group has a stable id/name pair and an allowed status whitelist. The schema is injected into the TaskService and reused anywhere task frontmatter must be validated or serialized.【F:packages/orchard/src/services/task/schema.ts†L1-L43】

During initialization the TaskService guarantees that the base definition file exists (respecting custom overrides) before creating or updating any tasks.【F:packages/orchard/src/services/task/service.ts†L37-L78】

## Recommended naming conventions

- **Task folders**: Keep the root directory short (`tasks`, `projects/tasks`, etc.). The generator lowercases paths and strips duplicate slashes, so use human-friendly casing in titles instead.【F:packages/orchard/src/services/task/schema.ts†L15-L28】
- **Task filenames**: Titles are slugged, spaces replaced with hyphens, and suffixed with a UTC timestamp (`<slug>-<YYYYMMDDHHMMSS>.md`). Avoid leading punctuation in titles if you want predictable slugs.【F:packages/orchard/src/utils/task-files.ts†L34-L73】
- **Project identifiers**: Configure `taskProjectGroups` so ids are lowercase machine keys and names are human-facing labels. Only populate statuses that the group should display in Base views.【F:packages/orchard/src/services/task/schema.ts†L29-L43】
- **Status & priority keys**: Treat them as opaque ids referenced across settings, task frontmatter, and automations. Deduplication occurs automatically, but keeping them Title Case improves Base readability.【F:packages/orchard/src/services/task/schema.ts†L20-L24】
- **External sync markers**: Reuse `mcpSyncState` for outbound integrations. Use a small vocabulary (`pending`, `synced`, `error`, or vendor-specific codes) so dashboards can group tasks easily.【F:packages/orchard-core/src/task.ts†L15-L63】

## MCP integration

### Authentication and session flow

The MCP server requires an API key on every `/mcp` request via the `key` query string or `Authorization: Bearer <key>` header. Clients must first call `initialize` without a session header, capture the `mcp-session-id` response header, and reuse it alongside `Mcp-Protocol-Version: 2024-11-05` on subsequent tool calls. Requests must advertise `Accept: application/json, text/event-stream` and `Content-Type: application/json` to satisfy transport checks.【F:packages/mcp-server/README.md†L1-L124】

### Available task tools

All task automation surfaces through `tools/call` with the following tool names:

- `list_tasks`: Filter by tag, text search, status, or project. Returns task summaries scoped to the configured task folder with Obsidian deep links for the note, base definition, and folder.【F:packages/mcp-server/src/task-service.ts†L37-L138】【F:packages/mcp-server/src/task-service.ts†L221-L240】
- `create_task`: Creates a normalized task note after validating the provided frontmatter and enforces folder boundaries.【F:packages/mcp-server/src/task-service.ts†L139-L161】【F:packages/mcp-server/src/task-service.ts†L221-L268】
- `update_task`: Updates title, tags, or frontmatter fields on an existing task (optimistic concurrency via note version).【F:packages/mcp-server/src/task-service.ts†L163-L207】
- `transition_task_status`: Convenience helper to move a task between statuses and optionally update project, due date, priority, or sync state in a single call.【F:packages/mcp-server/src/task-service.ts†L209-L219】

The plugin subscribes to MCP task events so in-app lists stay synchronized as external tools create, update, or delete tasks.【F:packages/orchard/src/modules/task.module.ts†L15-L188】

### Payload examples

Minimal JSON-RPC envelopes for common operations:

```jsonc
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "create_task",
    "arguments": {
      "id": "tasks/Alpha",
      "title": "Draft quarterly plan",
      "frontmatter": {
        "status": "Todo",
        "project": "Strategy",
        "due": "2025-01-31",
        "priority": "High",
        "mcpSyncState": "pending"
      }
    }
  }
}
```

```jsonc
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "transition_task_status",
    "arguments": {
      "id": "tasks/alpha-20250101083000.md",
      "version": "<note-version>",
      "status": "Done",
      "mcpSyncState": "synced"
    }
  }
}
```

Responses include a single text content part that embeds JSON describing the created or updated task, matching the server transport conventions.【F:packages/mcp-server/README.md†L125-L197】

### Syncing external systems

1. **Track mirror state with `mcpSyncState`** – Use values such as `pending`, `queued:<system>`, or `synced` when your automation pushes tasks into another tracker. Because the field is normalized in both the plugin and MCP tools, downstream clients will receive the sanitized string regardless of case or surrounding whitespace.【F:packages/orchard-core/src/task.ts†L15-L63】【F:packages/mcp-server/src/task-service.ts†L209-L219】
2. **Leverage folder boundaries** – The MCP server rejects tasks outside the configured folder, preventing accidental edits to non-Orchard notes. Configure the task folder to match the vault location you sync externally (e.g., `tasks` or `operations/tasks`).【F:packages/mcp-server/src/task-service.ts†L221-L240】
3. **Use `list_tasks` for incremental syncs** – Poll with `status` or `project` filters to minimize payload size and compare `updatedAt` timestamps to detect changes since your last run.【F:packages/mcp-server/src/task-service.ts†L37-L138】
4. **Rely on optimistic concurrency** – `update_task` and `transition_task_status` require the latest note `version`. Persist the version from list/create responses to avoid overwriting changes made in Obsidian.【F:packages/mcp-server/src/task-service.ts†L163-L219】
5. **Link back to Obsidian** – Each summary includes deep links for the note, the Task Base definition, and the task folder so external dashboards can give users direct navigation targets.【F:packages/mcp-server/src/task-service.ts†L221-L240】

Refer back to this document whenever you adjust Task settings or build new MCP automations.
