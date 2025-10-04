import builtins from "builtin-modules"
import type { BunPlugin } from "bun"
import { build } from "bun"

// Alias @orchard/core to source so server bundles latest core logic without prebuilding
const coreAliasPlugin: BunPlugin = {
  name: "core-alias",
  setup(b) {
    b.onResolve({ filter: /^@orchard\/core$/ }, () => ({
      path: new URL("../orchard-core/src/index.ts", import.meta.url).pathname,
    }))
  },
}

await build({
  entrypoints: ["./src/plugin.ts"],
  outdir: "./dist",
  naming: { entry: "[dir]/main.[ext]" },
  target: "node",
  format: "cjs",
  splitting: true,
  sourcemap: "linked",
  minify: true,
  external: [
    "obsidian",
    "electron",
    "@codemirror/autocomplete",
    "@codemirror/collab",
    "@codemirror/commands",
    "@codemirror/language",
    "@codemirror/lint",
    "@codemirror/search",
    "@codemirror/state",
    "@codemirror/view",
    "@lezer/common",
    "@lezer/highlight",
    "@lezer/lr",
    ...builtins,
  ],
  plugins: [coreAliasPlugin],
})

console.log("Server build completed successfully!")
