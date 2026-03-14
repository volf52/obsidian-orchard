import type { BunPlugin } from 'bun'

// Shared Bun plugin to alias @orchard/core to its source index.
/**
 * Creates a Bun plugin that aliases the module specifier "@orchard/core" to the package's source index.
 *
 * The plugin resolves imports of "@orchard/core" to "../src/index.ts" relative to this file during Bun builds.
 *
 * @returns A BunPlugin that maps "@orchard/core" to the local source index file.
 */
export function coreAliasPlugin(): BunPlugin {
  return {
    name: 'core-alias',
    setup(build) {
      build.onResolve({ filter: /^@orchard\/core$/ }, () => ({
        path: new URL('../src/index.ts', import.meta.url).pathname,
      }))
    },
  }
}
