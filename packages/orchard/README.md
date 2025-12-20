# Orchard Obsidian Plugin

Svelte-based Obsidian plugin components & modules integrating Orchard core features (note creation, video, transcription, settings UI, and Tasks).

## Features

- **Orchard Tasks module** – Task Base management, quick actions, and modal-driven task creation backed by normalized task notes. See [docs/tasks.md](../../docs/tasks.md) for schema and MCP integration details.
- **Note creator** – Modal for authoring Orchard-flavored notes with consistent frontmatter.
- **Video tooling** – Inline video module with upload and transcription entry points.
- **Settings hub** – Centralized configuration for folders, Bases, statuses, and API credentials.

> **Terminology**: A "Base" is the structured Dataview/Obsidian database (stored under `.obsidian/bases/`) that powers Orchard's task index. The plugin keeps the Orchard Tasks Base definition in sync so filters and views stay consistent across the vault.

## Structure
- `src/components` – Svelte UI primitives & modals
- `src/modules` – Feature modules (tasks, note creator, video, transcribe)
- `src/services` – Service wrappers (video service, adapters)
- `src/stores` – Settings state management
- `src/utils` – General utilities & Obsidian helpers

## Quickstart

1. Install dependencies with `bun install` in the repository root.
2. Build the plugin once via `bun run build.ts`.
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
Custom CSS lives in `packages/orchard/custom-css/`. Enable snippets in Obsidian via **Settings → Appearance → CSS snippets**, then toggle the Orchard snippets you want (gradients, link enhancements, etc.).

## Roadmap
- Deeper MCP integration (live events) – see also `packages/mcp-server/README.md`
- Extended transcription workflows
- Additional media module types – see `packages/orchard-runtime/README.md` for runtime wiring details
