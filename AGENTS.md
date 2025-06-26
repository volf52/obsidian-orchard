# Agent Guidelines for obsidian-orchard

## Build/Lint/Test Commands
- **Build**: `bun --bun run build.ts`
- **Type check**: `bun run tc` (alias for `tsc --noEmit --pretty`)
- **Svelte check**: `bun run check` (runs `svelte-check --tsconfig tsconfig.json`)
- **Lint**: `bun run lint` (checks src/), `bun run lint:fix` (auto-fixes)
- **Format**: `bun run fmt` (formats src/ using Biome)
- **Test**: `bun test` (all tests), `bun test --watch` (watch mode)
- **Single test**: `bun test <filename>.test.ts`

## Code Style
- **Runtime**: Bun with TypeScript 5.8+ and Svelte 5
- **Formatter**: Biome with spaces, double quotes, semicolons as needed, trailing commas
- **Imports**: Use `@/*` path aliases, organize imports automatically
- **Types**: Strict TypeScript with `noImplicitAny`, `strictNullChecks`, prefer explicit types
- **Naming**: camelCase for variables/functions, PascalCase for components/classes
- **Svelte**: Use `$props()`, `$state()` for Svelte 5 runes syntax
- **File structure**: Organize by feature in src/ with components/, modules/, services/, utils/
- **Error handling**: Use type-safe error patterns, avoid throwing raw errors

## Key Notes
- This is an Obsidian plugin with video transcription and note management features
- Uses Hono for server module, Zustand for state, ky for HTTP client
- Follow existing module pattern (see VideoModule, TranscriptionModule, ServerModule)
- All Svelte components should use TypeScript and follow the established patterns