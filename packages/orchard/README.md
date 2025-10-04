# Orchard Obsidian Plugin

Svelte-based Obsidian plugin components & modules integrating Orchard core features (note creation, video, transcription, settings UI).

## Structure
- `src/components` – Svelte UI primitives & modals
- `src/modules` – Feature modules (note creator, video, transcribe)
- `src/services` – Service wrappers (video service, adapters)
- `src/stores` – Settings state management
- `src/utils` – General utilities & Obsidian helpers

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
