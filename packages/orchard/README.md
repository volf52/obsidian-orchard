# Orchard Obsidian Plugin

Svelte-based Obsidian plugin components & modules integrating Orchard core features (note creation, video, transcription, settings UI, and Tasks).

## Features

- **Orchard Tasks module** – Task Base management, quick actions, and modal-driven task creation backed by normalized task notes. See [docs/tasks.md](../../docs/tasks.md) for schema and MCP integration details.
- **Note creator** – Modal for authoring Orchard-flavored notes with consistent frontmatter.
- **Video tooling** – Inline video module with upload and transcription entry points.
- **Settings hub** – Centralized configuration for folders, Bases, statuses, and API credentials.

## Structure
- `src/components` – Svelte UI primitives & modals
- `src/modules` – Feature modules (tasks, note creator, video, transcribe)
- `src/services` – Service wrappers (video service, adapters)
- `src/stores` – Settings state management
- `src/utils` – General utilities & Obsidian helpers

## Quickstart

1. Install dependencies with `bun install` in the repository root.
2. Build the plugin once via `bun run build.ts` (or `bun --bun run build.ts` if Bun is not the default).
3. Load the development plugin in Obsidian and open **Settings → Orchard**.
4. Configure the Tasks section (folder, Base file, statuses, priority definitions) following the guidance in [docs/tasks.md](../../docs/tasks.md).
5. Use the command palette to run **Create Task** or **Open Task Base** (listed under Orchard commands) to experience the modal flow and Base view.

> 📸 Screenshots of the Task Base view and modal will be added to `docs/assets/` once captured. Embed them in this README when available to illustrate the workflow.

## Development
```
bun run build.ts
bun run check   # Svelte + TS checks
bun test        # Core + util tests
```

## Styling
Custom CSS under `custom-css/` for gradients, link enhancements, etc.

## Roadmap
- Deeper MCP integration (live events)
- Extended transcription workflows
- Additional media module types
