import type { BunPlugin } from "bun";

// Shared Bun plugin to alias @orchard/core to its source index.
// Keeps build scripts in other packages lean and avoids duplicated path logic.
export function coreAliasPlugin(): BunPlugin {
  return {
    name: "core-alias",
    setup(build) {
      build.onResolve({ filter: /^@orchard\/core$/ }, () => ({
        path: new URL("../src/index.ts", import.meta.url).pathname,
      }));
    },
  };
}
