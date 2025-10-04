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